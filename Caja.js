// --- 5. CAJA ---
  function procesarMovimientoCaja(d) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CAJA');
    if (!sheet) return { error: true, mensaje: "Falta hoja CAJA" };

    let f = new Date(d.fecha);
    let fechaStr = ('0' + f.getUTCDate()).slice(-2) + '/' + ('0' + (f.getUTCMonth() + 1)).slice(-2) + '/' + f.getUTCFullYear();

    let vencStr = "";
    if (d.vencimiento) {
      let v = new Date(d.vencimiento);
      let parts = d.vencimiento.split('-');
      // Asegurar formato fecha sin saltos horarios
      vencStr = parts[2] + '/' + parts[1] + '/' + parts[0];
    }

    // ESTRUCTURA COLUMNAS (11 Cols):
    // 0:Fecha, 1:Tipo, 2:Concepto, 3:Desc, 4:Forma, 5:Monto, 6:Obs, 7:ESTADO, 8:VENCIMIENTO, 9:PAIS, 10:COTIZACION_USADA

    let cotizacionGuardar = d.cotizacion || '';

    if (d.filaIndex) {
      // Modo edición: actualizar cotización SOLO cuando se editó el monto, es EGRESO, PENDIENTE y no Argentina
      let paisNorm = (d.pais || '').toString().toUpperCase().trim();
      if (paisNorm === 'USA') paisNorm = 'EEUU';
      if (paisNorm === 'ESPAÑA') paisNorm = 'ESPANA';
      if (d.actualizarCotizacion && d.tipo === 'EGRESO' && (d.estado || '').toString().toUpperCase() === 'PENDIENTE' && paisNorm !== 'ARGENTINA') {
        let cotizaciones = obtenerCotizacionesConCache();
        if (cotizaciones[paisNorm]) cotizacionGuardar = cotizaciones[paisNorm];
      } else {
        // Mantener cotización actual de la fila
        let filaActual = sheet.getRange(parseInt(d.filaIndex), 11).getValue();
        if (filaActual !== '' && filaActual !== null && filaActual !== undefined) cotizacionGuardar = filaActual;
      }
    } else {
      // Movimiento nuevo: si es EGRESO y no Argentina, usar cotización actual
      if (d.tipo === 'EGRESO' && d.pais && d.pais.toUpperCase() !== 'ARGENTINA' && !cotizacionGuardar) {
        let cotizaciones = obtenerCotizacionesConCache();
        let paisNormalizado = d.pais.toString().toUpperCase().trim();
        if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
        if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';
        if (cotizaciones[paisNormalizado]) cotizacionGuardar = cotizaciones[paisNormalizado];
      }
    }

    if (d.filaIndex) {
      let rowIndex = parseInt(d.filaIndex);
      let montoLimpio = parseFloat(d.pagos[0].monto);
      let fila = [fechaStr, d.tipo, d.concepto, d.descripcion, d.pagos[0].forma, montoLimpio, d.observaciones, d.estado, vencStr, d.pais, cotizacionGuardar];
      sheet.getRange(rowIndex, 1, 1, 11).setValues([fila]);
      return { error: false, mensaje: "Movimiento Actualizado" };
    } else {
      d.pagos.forEach(pago => {
        let montoLimpio = parseFloat(pago.monto);
        let fila = [fechaStr, d.tipo, d.concepto, d.descripcion, pago.forma, montoLimpio, d.observaciones, d.estado, vencStr, d.pais, cotizacionGuardar];
        sheet.appendRow(fila);
      });
      return { error: false, mensaje: "Movimientos Registrados" };
    }
  }

  function borrarMovimientoCajaBackend(rowIndex) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('CAJA');
      if (!sheet) return { error: true, mensaje: "Falta hoja CAJA" };
      sheet.deleteRow(parseInt(rowIndex));
      return { error: false };
    } catch (e) {
      return { error: true, mensaje: e.toString() };
    }
  }
  
  // Función para actualizar el estado de un movimiento de caja
  function actualizarEstadoMovimientoCaja(rowIndex, nuevoEstado) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('CAJA');
      if (!sheet) return { error: true, mensaje: "Falta hoja CAJA" };
      
      // Columna 7 (índice 7) es ESTADO
      sheet.getRange(parseInt(rowIndex), 8).setValue(nuevoEstado);
      
      // Si el nuevo estado es PAGADO, limpiar el campo de vencimiento (columna 8, índice 8)
      if (nuevoEstado === 'PAGADO') {
        sheet.getRange(parseInt(rowIndex), 9).setValue('');
      }
      
      return { error: false };
    } catch (e) {
      return { error: true, mensaje: e.toString() };
    }
  }


  // NUEVA FUNCIÓN: Obtener consolidado de balance de caja (mensual y anual en ARS)
  // NUEVA FUNCIÓN: Obtener balance de caja para un país y período específico
  function obtenerBalanceCaja(pais, mes, anio) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Forzar año 2026
    anio = 2026;
    
    // Normalizar país
    let paisNormalizado = pais ? pais.toString().toUpperCase().trim() : "";
    if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
    if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';
    
    // Obtener cotizaciones (con caché)
    let cotizaciones = obtenerCotizacionesConCache();
    
    let ingresos = 0;
    let egresos = 0;
    let pendientes = 0;
    let ingresosOriginal = 0; // Montos en moneda original
    let egresosOriginal = 0; // Montos en moneda original
    let pendientesOriginal = 0; // Montos pendientes en moneda original
    
    // 1. CALCULAR INGRESOS: Suma de todas las ventas de todos los vendedores
    let listaVendedores = obtenerListaVendedores();
    let todosVendedores = [...(listaVendedores.activos || []), ...(listaVendedores.inactivos || [])];
    
    todosVendedores.forEach(v => {
      let sheet = ss.getSheetByName(v.nombre);
      if (!sheet) return;
      
      let datos = sheet.getDataRange().getValues();
      if (datos.length <= 1) return;
      
      for (let i = 1; i < datos.length; i++) {
        let fila = datos[i];
        if (!fila[0]) continue; // Sin fecha
        
        let fecha = fila[0];
        let mesFila = -1;
        let anioFila = -1;
        
        // Parsear fecha
        if (Object.prototype.toString.call(fecha) === '[object Date]') {
          mesFila = fecha.getMonth() + 1; // Mes 1-12
          anioFila = fecha.getFullYear();
        } else if (typeof fecha === 'string') {
          let partes = fecha.split('/');
          if (partes.length === 3) {
            mesFila = parseInt(partes[1]);
            anioFila = parseInt(partes[2]);
          }
        }
        
        // Filtrar por mes y año
        if (mes === 0) {
          // Anual: solo filtrar por año
          if (anioFila !== anio) continue;
        } else {
          // Mensual: filtrar por mes y año
          if (mesFila !== mes || anioFila !== anio) continue;
        }
        
        // Filtrar por país
        let paisFila = fila[3] ? fila[3].toString().toUpperCase().trim() : "";
        if (paisFila === 'USA') paisFila = 'EEUU';
        if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';
        
        if (paisFila !== paisNormalizado) continue;
        
        // Obtener monto (total con IVA - columna 9)
        let montoVal = fila[9];
        if (typeof montoVal === 'string') {
          montoVal = parseFloat(montoVal.toString().replace(/[$.]/g, '').replace(',', '.').trim());
        }
        let montoOriginal = parseFloat(montoVal) || 0;
        let monto = montoOriginal;
        
        // Usar cotización guardada en columna M (índice 12) si existe
        let cotizacionUsada = fila[12];
        if (!cotizacionUsada || isNaN(cotizacionUsada) || cotizacionUsada <= 0) {
          cotizacionUsada = cotizaciones[paisNormalizado] || 1;
        } else {
          cotizacionUsada = parseFloat(cotizacionUsada);
        }
        
        // Convertir a ARS (excepto Argentina)
        if (paisNormalizado !== 'ARGENTINA') {
          monto = monto * cotizacionUsada;
        }
        
        ingresos += monto;
        ingresosOriginal += montoOriginal;
      }
    });
    
    // 2. CALCULAR EGRESOS: Suma de egresos de la hoja CAJA
    const sheetCaja = ss.getSheetByName('CAJA');
    if (sheetCaja) {
      let datosCaja = sheetCaja.getDataRange().getValues();
      if (datosCaja.length > 1) {
        for (let i = 1; i < datosCaja.length; i++) {
          let fila = datosCaja[i];
          if (!fila[0] || !fila[1]) continue; // Sin fecha o tipo
          
        let tipo = fila[1].toString().toUpperCase().trim();
        if (tipo !== 'EGRESO') continue;
        
        // Filtrar por estado - PAGADO suma a egresos, PENDIENTE suma a pendientes (columna 7 - ESTADO)
        let estado = fila[7] ? fila[7].toString().toUpperCase().trim() : 'PAGADO';
        if (estado !== 'PAGADO' && estado !== 'PENDIENTE') continue;
        
        // Filtrar por país (columna 9 - PAÍS)
        let paisCaja = fila[9] ? fila[9].toString().toUpperCase().trim() : "";
        if (paisCaja === 'USA') paisCaja = 'EEUU';
        if (paisCaja === 'ESPAÑA') paisCaja = 'ESPANA';
        
        if (paisCaja !== paisNormalizado) continue;
          
          // Parsear fecha (columna 0 - FECHA)
          let fechaCaja = fila[0];
          let mesCaja = -1;
          let anioCaja = -1;
          
          if (Object.prototype.toString.call(fechaCaja) === '[object Date]') {
            mesCaja = fechaCaja.getMonth() + 1;
            anioCaja = fechaCaja.getFullYear();
          } else if (typeof fechaCaja === 'string') {
            let partes = fechaCaja.split('/');
            if (partes.length === 3) {
              mesCaja = parseInt(partes[1]);
              anioCaja = parseInt(partes[2]);
            }
          }
          
          // Filtrar por mes y año
          if (mes === 0) {
            if (anioCaja !== anio) continue;
          } else {
            if (mesCaja !== mes || anioCaja !== anio) continue;
          }
          
          // Obtener monto (columna 5 - MONTO)
          let montoCaja = fila[5];
          if (typeof montoCaja === 'string') {
            montoCaja = parseFloat(montoCaja.toString().replace(/[$.]/g, '').replace(',', '.').trim());
          }
          let montoEgresoOriginal = parseFloat(montoCaja) || 0;
          let montoEgreso = montoEgresoOriginal;
          
          // Convertir a ARS si es necesario
          // Usar cotización guardada (columna 10, índice 10) si existe, sino usar la actual
          let cotizacionUsadaEgreso = fila[10]; // Columna K - cotización histórica
          if (!cotizacionUsadaEgreso || isNaN(cotizacionUsadaEgreso) || cotizacionUsadaEgreso <= 0) {
            // Si no hay cotización guardada, usar la actual como fallback
            cotizacionUsadaEgreso = cotizaciones[paisNormalizado] || 1;
          } else {
            cotizacionUsadaEgreso = parseFloat(cotizacionUsadaEgreso);
          }
          
          if (paisNormalizado !== 'ARGENTINA') {
            montoEgreso = montoEgreso * cotizacionUsadaEgreso;
          }
          
          if (estado === 'PAGADO') {
            egresos += montoEgreso;
            egresosOriginal += montoEgresoOriginal;
          } else {
            pendientes += montoEgreso;
            pendientesOriginal += montoEgresoOriginal;
          }
        }
      }
    }
    
    // 3. CALCULAR SALDO
    let saldo = ingresos - egresos;
    let saldoOriginal = ingresosOriginal - egresosOriginal;
    
    return {
      error: false,
      data: {
        ingresos: ingresos,
        egresos: egresos,
        pendientes: pendientes,
        saldo: saldo,
        ingresosOriginal: ingresosOriginal,
        egresosOriginal: egresosOriginal,
        pendientesOriginal: pendientesOriginal,
        saldoOriginal: saldoOriginal
      }
    };
  }

  // NUEVA FUNCIÓN: Obtener balance de caja por medios de pago
  function obtenerBalanceCajaMediosPago(pais, mes, anio) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Forzar año 2026
    anio = 2026;
    
    // Normalizar país
    let paisNormalizado = pais ? pais.toString().toUpperCase().trim() : "";
    if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
    if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';
    
    // Obtener cotizaciones (con caché)
    let cotizaciones = obtenerCotizacionesConCache();
    
    let mediosPago = {}; // { "Medio Pago": { ingresos: 0, egresos: 0, saldo: 0 } }
    
    // 1. CALCULAR INGRESOS POR MEDIO DE PAGO: Suma de ventas por forma de pago
    let listaVendedores = obtenerListaVendedores();
    let todosVendedores = [...(listaVendedores.activos || []), ...(listaVendedores.inactivos || [])];
    
    todosVendedores.forEach(v => {
      let sheet = ss.getSheetByName(v.nombre);
      if (!sheet) return;
      
      let datos = sheet.getDataRange().getValues();
      if (datos.length <= 1) return;
      
      for (let i = 1; i < datos.length; i++) {
        let fila = datos[i];
        if (!fila[0]) continue;
        
        let fecha = fila[0];
        let mesFila = -1;
        let anioFila = -1;
        
        if (Object.prototype.toString.call(fecha) === '[object Date]') {
          mesFila = fecha.getMonth() + 1;
          anioFila = fecha.getFullYear();
        } else if (typeof fecha === 'string') {
          let partes = fecha.split('/');
          if (partes.length === 3) {
            mesFila = parseInt(partes[1]);
            anioFila = parseInt(partes[2]);
          }
        }
        
        // Filtrar por mes y año
        if (mes === 0) {
          if (anioFila !== anio) continue;
        } else {
          if (mesFila !== mes || anioFila !== anio) continue;
        }
        
        // Filtrar por país
        let paisFila = fila[3] ? fila[3].toString().toUpperCase().trim() : "";
        if (paisFila === 'USA') paisFila = 'EEUU';
        if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';
        
        if (paisFila !== paisNormalizado) continue;
        
        // Obtener medio de pago (columna 6 - FORMA DE PAGO)
        let medioPago = fila[6] ? fila[6].toString().trim() : "Sin especificar";
        
        // Obtener monto (total con IVA - columna 9)
        let montoVal = fila[9];
        if (typeof montoVal === 'string') {
          montoVal = parseFloat(montoVal.toString().replace(/[$.]/g, '').replace(',', '.').trim());
        }
        let monto = parseFloat(montoVal) || 0;
        
        // Usar cotización guardada
        let cotizacionUsada = fila[12];
        if (!cotizacionUsada || isNaN(cotizacionUsada) || cotizacionUsada <= 0) {
          cotizacionUsada = cotizaciones[paisNormalizado] || 1;
        } else {
          cotizacionUsada = parseFloat(cotizacionUsada);
        }
        
        // Convertir a ARS
        if (paisNormalizado !== 'ARGENTINA') {
          monto = monto * cotizacionUsada;
        }
        
        // Inicializar medio de pago si no existe
        if (!mediosPago[medioPago]) {
          mediosPago[medioPago] = { ingresos: 0, egresos: 0, saldo: 0 };
        }
        
        mediosPago[medioPago].ingresos += monto;
      }
    });
    
    // 2. CALCULAR EGRESOS POR MEDIO DE PAGO: Suma de egresos de CAJA por forma de pago
    const sheetCaja = ss.getSheetByName('CAJA');
    if (sheetCaja) {
      let datosCaja = sheetCaja.getDataRange().getValues();
      if (datosCaja.length > 1) {
        for (let i = 1; i < datosCaja.length; i++) {
          let fila = datosCaja[i];
          if (!fila[0] || !fila[1]) continue;
          
          let tipo = fila[1].toString().toUpperCase().trim();
          if (tipo !== 'EGRESO') continue;
          
          // Filtrar por estado - solo contar PAGADO (columna 7 - ESTADO)
          let estado = fila[7] ? fila[7].toString().toUpperCase().trim() : 'PAGADO';
          if (estado !== 'PAGADO') continue; // No sumar PENDIENTE
          
          // Filtrar por país (columna 9 - PAÍS)
          let paisCaja = fila[9] ? fila[9].toString().toUpperCase().trim() : "";
          if (paisCaja === 'USA') paisCaja = 'EEUU';
          if (paisCaja === 'ESPAÑA') paisCaja = 'ESPANA';
          
          if (paisCaja !== paisNormalizado) continue;
          
          // Parsear fecha
          let fechaCaja = fila[0];
          let mesCaja = -1;
          let anioCaja = -1;
          
          if (Object.prototype.toString.call(fechaCaja) === '[object Date]') {
            mesCaja = fechaCaja.getMonth() + 1;
            anioCaja = fechaCaja.getFullYear();
          } else if (typeof fechaCaja === 'string') {
            let partes = fechaCaja.split('/');
            if (partes.length === 3) {
              mesCaja = parseInt(partes[1]);
              anioCaja = parseInt(partes[2]);
            }
          }
          
          // Filtrar por mes y año
          if (mes === 0) {
            if (anioCaja !== anio) continue;
          } else {
            if (mesCaja !== mes || anioCaja !== anio) continue;
          }
          
          // Obtener medio de pago (columna 4 - FORMA DE PAGO)
          let medioPago = fila[4] ? fila[4].toString().trim() : "Sin especificar";
          
          // Obtener monto (columna 5 - MONTO)
          let montoCaja = fila[5];
          if (typeof montoCaja === 'string') {
            montoCaja = parseFloat(montoCaja.toString().replace(/[$.]/g, '').replace(',', '.').trim());
          }
          let montoEgreso = parseFloat(montoCaja) || 0;
          
          // Convertir a ARS si es necesario
          // Usar cotización guardada (columna 10, índice 10) si existe, sino usar la actual
          let cotizacionUsadaEgreso = fila[10]; // Columna K - cotización histórica
          if (!cotizacionUsadaEgreso || isNaN(cotizacionUsadaEgreso) || cotizacionUsadaEgreso <= 0) {
            // Si no hay cotización guardada, usar la actual como fallback
            cotizacionUsadaEgreso = cotizaciones[paisNormalizado] || 1;
          } else {
            cotizacionUsadaEgreso = parseFloat(cotizacionUsadaEgreso);
          }
          
          if (paisNormalizado !== 'ARGENTINA') {
            montoEgreso = montoEgreso * cotizacionUsadaEgreso;
          }
          
          // Inicializar medio de pago si no existe
          if (!mediosPago[medioPago]) {
            mediosPago[medioPago] = { ingresos: 0, egresos: 0, saldo: 0 };
          }
          
          mediosPago[medioPago].egresos += montoEgreso;
        }
      }
    }
    
    // 3. CALCULAR SALDO POR MEDIO DE PAGO
    Object.keys(mediosPago).forEach(medio => {
      mediosPago[medio].saldo = mediosPago[medio].ingresos - mediosPago[medio].egresos;
    });
    
    return {
      error: false,
      data: mediosPago
    };
  }

  // NUEVA FUNCIÓN: Obtener historial de movimientos de caja
  function obtenerHistorialCaja(pais, mes, anio) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetCaja = ss.getSheetByName('CAJA');
    
    if (!sheetCaja) {
      return { error: true, mensaje: "Falta hoja CAJA" };
    }
    
    // Forzar año 2026
    anio = 2026;
    
    // Normalizar país
    let paisNormalizado = pais ? pais.toString().toUpperCase().trim() : "";
    if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
    if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';
    
    let datosCaja = sheetCaja.getDataRange().getValues();
    let historial = [];
    
    if (datosCaja.length > 1) {
      for (let i = 1; i < datosCaja.length; i++) {
        let fila = datosCaja[i];
        if (!fila[0] || !fila[1]) continue;
        
        // Filtrar por país (columna 9 - PAÍS)
        let paisCaja = fila[9] ? fila[9].toString().toUpperCase().trim() : "";
        if (paisCaja === 'USA') paisCaja = 'EEUU';
        if (paisCaja === 'ESPAÑA') paisCaja = 'ESPANA';
        
        if (paisCaja !== paisNormalizado) continue;
        
        // Parsear fecha (columna 0 - FECHA)
        let fechaCaja = fila[0];
        let mesCaja = -1;
        let anioCaja = -1;
        let fechaStr = '';
        
        if (Object.prototype.toString.call(fechaCaja) === '[object Date]') {
          mesCaja = fechaCaja.getMonth() + 1;
          anioCaja = fechaCaja.getFullYear();
          fechaStr = ('0' + fechaCaja.getDate()).slice(-2) + '/' + ('0' + (fechaCaja.getMonth() + 1)).slice(-2) + '/' + fechaCaja.getFullYear();
        } else if (typeof fechaCaja === 'string') {
          let partes = fechaCaja.split('/');
          if (partes.length === 3) {
            mesCaja = parseInt(partes[1]);
            anioCaja = parseInt(partes[2]);
            fechaStr = fechaCaja;
          }
        }
        
        // Filtrar por mes y año
        if (mes === 0) {
          if (anioCaja !== anio) continue;
        } else {
          if (mesCaja !== mes || anioCaja !== anio) continue;
        }
        
        // Parsear vencimiento (columna 8 - VENCIMIENTO)
        let vencimiento = '';
        if (fila[8]) {
          let venc = fila[8];
          if (Object.prototype.toString.call(venc) === '[object Date]') {
            vencimiento = ('0' + venc.getDate()).slice(-2) + '/' + ('0' + (venc.getMonth() + 1)).slice(-2) + '/' + venc.getFullYear();
          } else if (typeof venc === 'string') {
            vencimiento = venc;
          }
        }
        
        historial.push({
          fecha: fechaStr,
          tipo: fila[1] ? fila[1].toString() : '',
          concepto: fila[2] ? fila[2].toString() : '',
          descripcion: fila[3] ? fila[3].toString() : '',
          formaPago: fila[4] ? fila[4].toString() : '',
          monto: parseFloat(fila[5]) || 0,
          observaciones: fila[6] ? fila[6].toString() : '',
          estado: fila[7] ? fila[7].toString() : 'PAGADO',
          vencimiento: vencimiento,
          pais: fila[9] ? fila[9].toString() : '',
          filaIndex: i + 1
        });
      }
    }
    
    // Ordenar por fecha descendente
    historial.sort((a, b) => {
      let fechaA = parseFechaBalance(a.fecha);
      let fechaB = parseFechaBalance(b.fecha);
      return fechaB - fechaA;
    });
    
    return {
      error: false,
      data: historial
    };
  }

  // Función para obtener un movimiento individual de caja
  function obtenerMovimientoCaja(filaIndex) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetCaja = ss.getSheetByName('CAJA');
    
    if (!sheetCaja) {
      return { error: true, mensaje: "Falta hoja CAJA" };
    }
    
    let datosCaja = sheetCaja.getDataRange().getValues();
    if (filaIndex < 1 || filaIndex > datosCaja.length) {
      return { error: true, mensaje: "Fila no encontrada" };
    }
    
    let fila = datosCaja[filaIndex - 1]; // -1 porque getValues() devuelve índice base 0
    
    // Parsear fecha (columna 0)
    let fechaStr = '';
    if (fila[0]) {
      if (Object.prototype.toString.call(fila[0]) === '[object Date]') {
        fechaStr = ('0' + fila[0].getDate()).slice(-2) + '/' + ('0' + (fila[0].getMonth() + 1)).slice(-2) + '/' + fila[0].getFullYear();
      } else if (typeof fila[0] === 'string') {
        fechaStr = fila[0];
      }
    }
    
    // Parsear vencimiento (columna 8)
    let vencimientoStr = '';
    if (fila[8]) {
      if (Object.prototype.toString.call(fila[8]) === '[object Date]') {
        vencimientoStr = ('0' + fila[8].getDate()).slice(-2) + '/' + ('0' + (fila[8].getMonth() + 1)).slice(-2) + '/' + fila[8].getFullYear();
      } else if (typeof fila[8] === 'string') {
        vencimientoStr = fila[8];
      }
    }
    
    return {
      error: false,
      data: {
        fecha: fechaStr,
        tipo: fila[1] ? fila[1].toString() : '',
        concepto: fila[2] ? fila[2].toString() : '',
        descripcion: fila[3] ? fila[3].toString() : '',
        formaPago: fila[4] ? fila[4].toString() : '',
        monto: parseFloat(fila[5]) || 0,
        observaciones: fila[6] ? fila[6].toString() : '',
        estado: fila[7] ? fila[7].toString() : 'PAGADO',
        vencimiento: vencimientoStr,
        pais: fila[9] ? fila[9].toString() : '',
        filaIndex: filaIndex
      }
    };
  }

  function obtenerConsolidadoBalanceCaja(anio) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CAJA');
    if (!sheet) return { error: true, mensaje: "Falta hoja CAJA" };

    // Forzar año 2026
    anio = 2026;

    // Obtener cotizaciones
    const sheetCotizaciones = ss.getSheetByName('CONFIG-COTIZACIONES');
    let cotizaciones = {};
    if (sheetCotizaciones) {
      const datosCotizaciones = sheetCotizaciones.getDataRange().getValues();
      for (let i = 1; i < datosCotizaciones.length; i++) {
        let pais = datosCotizaciones[i][0].toString().toUpperCase();
        if (pais === 'ESPAÑA') pais = 'ESPANA';
        let factor = parseFloat(datosCotizaciones[i][2]);
        if (!isNaN(factor)) {
          cotizaciones[pais] = factor;
        }
      }
    }

    const datos = sheet.getDataRange().getValues();
    let meses = {}; // {1: {ingresos: 0, egresos: 0, saldo: 0}, ...}

    for (let i = 1; i < datos.length; i++) {
      let row = datos[i];
      let fechaObj = row[0];
      if (typeof fechaObj === 'string') {
        let parts = fechaObj.split('/');
        fechaObj = new Date(parts[2], parts[1] - 1, parts[0]);
      }
      let mes = fechaObj.getMonth() + 1;
      let anioFila = fechaObj.getFullYear();
      
      // Filtrar por año proporcionado
      if (anioFila !== anio) continue;

      let tipo = row[1];
      let monto = parseFloat(row[5]) || 0;
      let pais = (row[9] || 'ARGENTINA').toString().toUpperCase();
      
      // Normalizar nombres de países
      if (pais === 'ESPAÑA') pais = 'ESPANA';
      if (pais === 'USA') pais = 'EEUU';

      // Convertir a ARS si es necesario
      if (pais !== 'ARGENTINA' && cotizaciones[pais]) {
        monto = monto * cotizaciones[pais];
      }

      if (!meses[mes]) {
        meses[mes] = { ingresos: 0, egresos: 0, saldo: 0 };
      }

      if (tipo === 'INGRESO') {
        meses[mes].ingresos += monto;
      } else {
        meses[mes].egresos += monto;
      }
      meses[mes].saldo = meses[mes].ingresos - meses[mes].egresos;
    }

    return { error: false, data: meses };
  }
