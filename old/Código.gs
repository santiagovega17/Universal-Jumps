function includeFile(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Universal Jumps App')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

  // --- 1. LOGIN Y SEGURIDAD ---
  function obtenerPerfilUsuario() {
    var emailUsuario = Session.getActiveUser().getEmail();
    if (!emailUsuario) emailUsuario = Session.getEffectiveUser().getEmail();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaUsuarios = ss.getSheetByName('USUARIOS');

    if (!hojaUsuarios) return { error: true, mensaje: "CRÍTICO: No existe la hoja 'USUARIOS'." };

    const lr = hojaUsuarios.getLastRow();
    const datos = (lr < 1) ? [] : hojaUsuarios.getRange(1, 1, lr, 5).getValues();
    let perfil = null;

    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().trim().toLowerCase() === emailUsuario.toString().trim().toLowerCase()) {
        perfil = { email: datos[i][0], rol: datos[i][1], hoja: datos[i][2] || '', acceso: true, activo: (datos[i][3] || 'SI').toString().toUpperCase(), tipoObjetivo: (datos[i][4] || '').toString().toUpperCase() };
        break;
      }
    }

    if (!perfil) return { error: true, authError: true, emailDetectado: emailUsuario, mensaje: "Acceso denegado." };
    return perfil;
  }

  // --- 2. GESTIÓN DE USUARIOS ---
  function obtenerListaVendedores() {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'lista_vendedores';
    const cached = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaUsuarios = ss.getSheetByName('USUARIOS');
    if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

    const lr = hojaUsuarios.getLastRow();
    const datos = (lr < 1) ? [] : hojaUsuarios.getRange(1, 1, lr, 5).getValues();
    let vendedores = [];
    let vendedoresInactivos = [];

    for (let i = 1; i < datos.length; i++) {
      let rol = (datos[i][1] || '').toString().toUpperCase();
      if (rol === 'VENDEDOR') {
        let nombreHoja = datos[i][2] || '';
        let activo = (datos[i][3] || 'SI').toString().toUpperCase();
        let tipoObjetivo = (datos[i][4] || '').toString().toUpperCase();
        
        let vendedor = {
          nombre: nombreHoja,
          email: datos[i][0] || '',
          rol: rol,
          activo: activo === 'SI',
          tipoObjetivo: tipoObjetivo
        };

        if (activo === 'SI') vendedores.push(vendedor);
        else vendedoresInactivos.push(vendedor);
      }
    }

    const resultado = { error: false, activos: vendedores, inactivos: vendedoresInactivos };
    try { cache.put(cacheKey, JSON.stringify(resultado), 600); } catch (e) {}
    return resultado;
  }

  function obtenerTodosUsuarios() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaUsuarios = ss.getSheetByName('USUARIOS');
    if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

    const lr = hojaUsuarios.getLastRow();
    const datos = (lr < 1) ? [] : hojaUsuarios.getRange(1, 1, lr, 5).getValues();
    let usuarios = [];

    for (let i = 1; i < datos.length; i++) {
      usuarios.push({
        email: datos[i][0] || '',
        rol: (datos[i][1] || '').toString().toUpperCase(),
        nombre: datos[i][2] || datos[i][0],
        activo: (datos[i][3] || 'SI').toString().toUpperCase() === 'SI',
        tipoObjetivo: (datos[i][4] || '').toString().toUpperCase()
      });
    }

    return { error: false, usuarios: usuarios };
  }

  function crearNuevoUsuario(datos) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaUsuarios = ss.getSheetByName('USUARIOS');
    if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

    const lr = hojaUsuarios.getLastRow();
    const datosUsuarios = (lr < 1) ? [] : hojaUsuarios.getRange(1, 1, lr, 5).getValues();
    const emailNuevo = datos.email.toString().trim().toLowerCase();
    
    for (let i = 1; i < datosUsuarios.length; i++) {
      if ((datosUsuarios[i][0] || '').toString().trim().toLowerCase() === emailNuevo) {
        return { error: true, mensaje: "Ya existe un usuario con este email." };
      }
    }
    
    const rol = (datos.rol || 'VENDEDOR').toString().toUpperCase();
    const nombreUsuario = datos.nombre.trim();
    
    if (rol === 'VENDEDOR') {
      if (ss.getSheetByName(nombreUsuario)) {
        return { error: true, mensaje: "Ya existe una hoja con este nombre." };
      }
      
      const nuevaHoja = ss.insertSheet(nombreUsuario);
      nuevaHoja.getRange(1, 1, 1, 13).setValues([[
        'FECHA', 'ESTADO', 'CHEQUEADO', 'PAIS', 'CLIENTE', 'CONCEPTO', 'FORMA DE PAGO', 
        'CANTIDAD', 'PRECIO', 'TOTAL', 'TOTAL (SIN IVA)', 'OBSERVACIONES', 'COTIZACION'
      ]]);
      nuevaHoja.getRange(1, 1, 1, 13).setFontWeight('bold');
    }
    
    hojaUsuarios.appendRow([
      datos.email,
      rol,
      nombreUsuario,
      'SI',
      rol === 'VENDEDOR' ? (datos.tipoObjetivo || 'RANGO') : ''
    ]);
    
    CacheService.getScriptCache().remove('lista_vendedores');
    return { error: false, mensaje: "Usuario creado correctamente." };
  }

  function actualizarUsuario(datos) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaUsuarios = ss.getSheetByName('USUARIOS');
    if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

    const lr = hojaUsuarios.getLastRow();
    const datosUsuarios = (lr < 1) ? [] : hojaUsuarios.getRange(1, 1, lr, 5).getValues();
    const nombreOriginal = datos.nombreOriginal ? datos.nombreOriginal.toString().trim() : "";
    
    for (let i = 1; i < datosUsuarios.length; i++) {
      if ((datosUsuarios[i][2] || '').toString().trim() === nombreOriginal) {
        // Validar que el nuevo email no esté en uso por otro
        if (datos.email !== datosUsuarios[i][0]) {
          for (let j = 1; j < datosUsuarios.length; j++) {
            if (j !== i && (datosUsuarios[j][0] || '').toString().trim().toLowerCase() === datos.email.toString().trim().toLowerCase()) {
              return { error: true, mensaje: "Ya existe otro usuario con este email." };
            }
          }
        }
        
        hojaUsuarios.getRange(i + 1, 1).setValue(datos.email);
        if (datos.rol) hojaUsuarios.getRange(i + 1, 2).setValue(datos.rol.toUpperCase());
        if (datos.tipoObjetivo) hojaUsuarios.getRange(i + 1, 5).setValue(datos.tipoObjetivo);
        
        CacheService.getScriptCache().remove('lista_vendedores');
        return { error: false, mensaje: "Usuario actualizado correctamente." };
      }
    }
    
    return { error: true, mensaje: "Usuario no encontrado." };
  }

  function actualizarEstadoUsuario(email, activo) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaUsuarios = ss.getSheetByName('USUARIOS');
    if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

    const lr = hojaUsuarios.getLastRow();
    const datos = (lr < 1) ? [] : hojaUsuarios.getRange(1, 1, lr, 5).getValues();
    const emailBusqueda = email.toString().trim().toLowerCase();
    
    for (let i = 1; i < datos.length; i++) {
      if ((datos[i][0] || '').toString().trim().toLowerCase() === emailBusqueda) {
        hojaUsuarios.getRange(i + 1, 4).setValue(activo ? 'SI' : 'NO');
        CacheService.getScriptCache().remove('lista_vendedores');
        return { error: false, mensaje: "Estado actualizado correctamente." };
      }
    }
    return { error: true, mensaje: "Usuario no encontrado." };
  }

  function cambiarRolUsuario(email, nuevoRol) {
    return actualizarUsuario({ email: email, nombreOriginal: email, rol: nuevoRol });
  }

  // --- 2. CONFIGURACIÓN Y COTIZACIONES ---
  function obtenerConfiguracion() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-CAJA');
    let config = {};

    if (sheet) {
      const lr = sheet.getLastRow();
      const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 5).getValues();
      // Estructura: TIPO, NOMBRE, PADRE, PAIS (Columna D/3), SENTIDO (Columna E/4)
      for (let i = 1; i < datos.length; i++) {
        let tipo = datos[i][0];
        let nombre = datos[i][1];
        let padre = datos[i][2];
        let pais = datos[i][3] || 'ARGENTINA';
        let sentido = datos[i][4] || 'EGRESO'; // Valor por defecto

        if (!config[pais]) {
          config[pais] = { conceptos: [], medios: [], descripciones: {}, sentidos: {} };
        }

        if (tipo === 'CONCEPTO') {
          config[pais].conceptos.push(nombre);
          config[pais].sentidos[nombre] = sentido;
        }
        if (tipo === 'MEDIO_PAGO') config[pais].medios.push(nombre);
        if (tipo === 'DESCRIPCION') {
          if (!config[pais].descripciones[padre]) config[pais].descripciones[padre] = [];
          config[pais].descripciones[padre].push(nombre);
        }
      }
    }
    return { error: false, data: config };
  }

  // Función para obtener conceptos filtrados por país
  function obtenerConceptosPorPais(pais) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-CAJA');
    if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };
    
    // Normalizar país
    let paisNormalizado = pais ? pais.toString().toUpperCase().trim() : "";
    if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
    if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';

    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 5).getValues();
    let conceptos = [];

    for (let i = 1; i < datos.length; i++) {
      let tipo = datos[i][0];
      let nombre = datos[i][1];
      let paisFila = datos[i][3] ? datos[i][3].toString().toUpperCase().trim() : "";

      // Normalizar país de la fila
      if (paisFila === 'USA') paisFila = 'EEUU';
      if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';

      if (tipo === 'CONCEPTO' && paisFila === paisNormalizado) {
        conceptos.push(nombre);
      }
    }

    return { error: false, data: conceptos };
  }

  // Función para obtener descripciones filtradas por concepto y país
  function obtenerDescripcionesPorPaisConcepto(pais, concepto) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-CAJA');
    if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };
    
    // Normalizar país
    let paisNormalizado = pais ? pais.toString().toUpperCase().trim() : "";
    if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
    if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';

    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 5).getValues();
    let descripciones = [];
    
    for (let i = 1; i < datos.length; i++) {
      let tipo = datos[i][0];
      let nombre = datos[i][1];
      let padre = datos[i][2];
      let paisFila = datos[i][3] ? datos[i][3].toString().toUpperCase().trim() : "";
      
      // Normalizar país de la fila
      if (paisFila === 'USA') paisFila = 'EEUU';
      if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';
      
      if (tipo === 'DESCRIPCION' && padre === concepto && paisFila === paisNormalizado) {
        descripciones.push(nombre);
      }
    }
    
    return { error: false, data: descripciones };
  }
  
  // Función para obtener medios de pago filtrados por país
  function obtenerMediosPorPais(pais) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-CAJA');
    if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };

    // Normalizar país
    let paisNormalizado = pais ? pais.toString().toUpperCase().trim() : "";
    if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
    if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';

    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 5).getValues();
    let medios = [];

    for (let i = 1; i < datos.length; i++) {
      let tipo = datos[i][0];
      let nombre = datos[i][1];
      let paisFila = datos[i][3] ? datos[i][3].toString().toUpperCase().trim() : "";

      // Normalizar país de la fila
      if (paisFila === 'USA') paisFila = 'EEUU';
      if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';

      if (tipo === 'MEDIO_PAGO' && paisFila === paisNormalizado) {
        medios.push(nombre);
      }
    }

    return { error: false, data: medios };
  }

  // Función auxiliar para obtener cotizaciones con caché
  function obtenerCotizacionesConCache() {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'cotizaciones';
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-COTIZACIONES');
    if (!sheet) return {};

    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 3).getValues();
    let cotizaciones = {};
    for (let j = 1; j < datos.length; j++) {
      let paisCot = datos[j][0].toString().toUpperCase();
      if (paisCot === 'ESPAÑA') paisCot = 'ESPANA';
      let factor = parseFloat(datos[j][2]);
      if (!isNaN(factor)) {
        cotizaciones[paisCot] = factor;
      }
    }
    
    // Guardar en caché por 30 minutos
    try {
      cache.put(cacheKey, JSON.stringify(cotizaciones), 1800);
    } catch (e) {}
    
    return cotizaciones;
  }

  function obtenerCotizacionesBackend() {
    const cotizaciones = obtenerCotizacionesConCache();
    if (Object.keys(cotizaciones).length === 0) {
      return { error: true, mensaje: "Falta hoja CONFIG-COTIZACIONES" };
    }
    return { error: false, data: cotizaciones };
  }

  function guardarItemConfig(tipo, nombre, padre, pais, sentido) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-CAJA');
    if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };
    sheet.appendRow([tipo, nombre, padre || '', pais || 'ARGENTINA', sentido || '']);
    // Al agregar concepto EGRESO o descripción de EGRESO: añadir a movimientos desde mes actual en adelante
    let esConceptoEgreso = (tipo === 'CONCEPTO' && (sentido || '').toString().toUpperCase() === 'EGRESO');
    let esDescripcion = (tipo === 'DESCRIPCION' && padre);
    if (esConceptoEgreso || esDescripcion) {
      agregarNuevoConceptoDescripcionAMovimientos(tipo, nombre, padre || '', pais || 'ARGENTINA');
    }
    return { error: false };
  }

  // Añade un nuevo concepto (o concepto+descripción) a CAJA desde mes actual hasta diciembre, como PENDIENTE y vacío
  function agregarNuevoConceptoDescripcionAMovimientos(tipo, nombre, padre, pais) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetCaja = ss.getSheetByName('CAJA');
    if (!sheetCaja) return;
    const hoy = new Date();
    const mesInicio = hoy.getMonth() + 1;
    const anio = 2026;
    let concepto = tipo === 'CONCEPTO' ? nombre : (padre || '');
    let descripcion = tipo === 'DESCRIPCION' ? nombre : '';
    let paisNorm = (pais || 'ARGENTINA').toString().toUpperCase().trim();
    if (paisNorm === 'USA') paisNorm = 'EEUU';
    if (paisNorm === 'ESPAÑA') paisNorm = 'ESPANA';

    const lrCaja = sheetCaja.getLastRow();
    const datosCaja = (lrCaja < 1) ? [] : sheetCaja.getRange(1, 1, lrCaja, 11).getValues();
    let cargados = {};
    for (let i = 1; i < datosCaja.length; i++) {
      let fecha = datosCaja[i][0];
      let tipoMov = (datosCaja[i][1] || '').toString();
      let conc = (datosCaja[i][2] || '').toString().trim();
      let desc = (datosCaja[i][3] || '').toString().trim();
      let paisFila = (datosCaja[i][9] || '').toString().toUpperCase().trim();
      if (paisFila === 'USA') paisFila = 'EEUU';
      if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';
      if (tipoMov !== 'EGRESO') continue;
      let mesFila = -1;
      let anioFila = -1;
      if (Object.prototype.toString.call(fecha) === '[object Date]') {
        mesFila = fecha.getMonth() + 1;
        anioFila = fecha.getFullYear();
      } else if (typeof fecha === 'string' && fecha) {
        let partes = fecha.split('/');
        if (partes.length === 3) {
          mesFila = parseInt(partes[1], 10) || 0;
          anioFila = parseInt(partes[2], 10) || 0;
        }
      }
      if (mesFila >= 1 && anioFila === anio && conc === concepto && desc === descripcion && paisFila === paisNorm) {
        cargados[mesFila] = true;
      }
    }

    for (let mes = mesInicio; mes <= 12; mes++) {
      if (cargados[mes]) continue;
      let fechaStr = '01/' + ('0' + mes).slice(-2) + '/' + anio;
      sheetCaja.appendRow([fechaStr, 'EGRESO', concepto, descripcion, '', 0, '', 'PENDIENTE', '', paisNorm, '']);
    }
  }

  // Genera todos los conceptos y descripciones configurados (EGRESO) como movimientos PENDIENTES desde mes actual hasta diciembre.
  // Sin forma de pago, sin monto, sin observaciones, sin vencimiento. Fecha = primer día del mes para asignar al mes.
  function generarTodosPendientesDesdeMesActual() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetCaja = ss.getSheetByName('CAJA');
    const sheetConfig = ss.getSheetByName('CONFIG-CAJA');
    if (!sheetCaja || !sheetConfig) return { error: true, mensaje: "Faltan hojas CAJA o CONFIG-CAJA" };

    const hoy = new Date();
    const mesInicio = hoy.getMonth() + 1;
    const anio = 2026;

    const lrConfig = sheetConfig.getLastRow();
    const datosConfig = (lrConfig < 1) ? [] : sheetConfig.getRange(1, 1, lrConfig, 5).getValues();
    let egresosConfig = [];
    let descripcionesMap = {};
    for (let i = 1; i < datosConfig.length; i++) {
      let tipoConfig = datosConfig[i][0];
      let nombre = datosConfig[i][1];
      let padre = datosConfig[i][2];
      let pais = (datosConfig[i][3] || 'ARGENTINA').toString().trim().toUpperCase();
      let sentido = (datosConfig[i][4] || '').toString().toUpperCase();
      if (pais === 'USA') pais = 'EEUU';
      if (pais === 'ESPAÑA') pais = 'ESPANA';
      if (tipoConfig === 'CONCEPTO' && sentido === 'EGRESO') {
        if (!egresosConfig.find(e => e.concepto === nombre && e.pais === pais)) {
          egresosConfig.push({ concepto: nombre, pais: pais, descripciones: [] });
        }
      } else if (tipoConfig === 'DESCRIPCION' && padre) {
        if (!descripcionesMap[padre]) descripcionesMap[padre] = [];
        descripcionesMap[padre].push(nombre);
      }
    }
    egresosConfig.forEach(eg => {
      eg.descripciones = descripcionesMap[eg.concepto] || [];
      if (eg.descripciones.length === 0) eg.descripciones.push('');
    });

    const lrCaja = sheetCaja.getLastRow();
    const datosCaja = (lrCaja < 1) ? [] : sheetCaja.getRange(1, 1, lrCaja, 11).getValues();
    let cargados = {};
    for (let i = 1; i < datosCaja.length; i++) {
      let fecha = datosCaja[i][0];
      let tipoMov = (datosCaja[i][1] || '').toString();
      let concepto = (datosCaja[i][2] || '').toString().trim();
      let descripcion = (datosCaja[i][3] || '').toString().trim();
      let paisCaja = (datosCaja[i][9] || '').toString().toUpperCase().trim();
      if (paisCaja === 'USA') paisCaja = 'EEUU';
      if (paisCaja === 'ESPAÑA') paisCaja = 'ESPANA';
      if (tipoMov !== 'EGRESO') continue;
      let mesFila = -1;
      let anioFila = -1;
      if (Object.prototype.toString.call(fecha) === '[object Date]') {
        mesFila = fecha.getMonth() + 1;
        anioFila = fecha.getFullYear();
      } else if (typeof fecha === 'string' && fecha) {
        let partes = fecha.split('/');
        if (partes.length === 3) {
          mesFila = parseInt(partes[1], 10) || 0;
          anioFila = parseInt(partes[2], 10) || 0;
        }
      }
      if (mesFila >= 1 && anioFila === anio) {
        cargados[mesFila + '-' + paisCaja + '-' + concepto + '-' + descripcion] = true;
      }
    }

    let contador = 0;
    for (let mes = mesInicio; mes <= 12; mes++) {
      let fechaStr = '01/' + ('0' + mes).slice(-2) + '/' + anio;
      egresosConfig.forEach(eg => {
        eg.descripciones.forEach(desc => {
          let key = mes + '-' + eg.pais + '-' + eg.concepto + '-' + desc;
          if (!cargados[key]) {
            sheetCaja.appendRow([fechaStr, 'EGRESO', eg.concepto, desc, '', 0, '', 'PENDIENTE', '', eg.pais, '']);
            contador++;
          }
        });
      });
    }
    return { error: false, mensaje: "Se generaron " + contador + " movimientos pendientes desde este mes." };
  }

  function borrarItemConfig(tipo, nombre, pais, padre) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-CAJA');
    if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };

    // Antes de borrar: eliminar de CAJA solo los egresos no usados (PENDIENTE, monto 0)
    if (tipo === 'CONCEPTO' || tipo === 'DESCRIPCION') {
      let conceptoParaCaja = (tipo === 'CONCEPTO') ? nombre : (padre || '');
      let descripcionParaCaja = (tipo === 'CONCEPTO') ? '' : nombre;
      eliminarEgresosNoUsadosDeCaja(conceptoParaCaja, descripcionParaCaja, pais);
    }

    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 5).getValues();
    for (let i = datos.length - 1; i >= 1; i--) {
      // Comparar tipo, nombre y país (columnas A, B, D)
      if (datos[i][0] === tipo && datos[i][1] === nombre && (datos[i][3] || 'ARGENTINA') === pais) {
        sheet.deleteRow(i + 1);
        return { error: false };
      }
    }

    return { error: true, mensaje: "No encontrado" };
  }

  // Elimina de CAJA solo los egresos PENDIENTES con monto 0 (no usados)
  // No toca los que tienen monto > 0 o estado PAGADO (histórico)
  function eliminarEgresosNoUsadosDeCaja(concepto, descripcion, pais) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetCaja = ss.getSheetByName('CAJA');
    if (!sheetCaja) return;

    let paisNorm = (pais || 'ARGENTINA').toString().toUpperCase().trim();
    if (paisNorm === 'USA') paisNorm = 'EEUU';
    if (paisNorm === 'ESPAÑA') paisNorm = 'ESPANA';

    const lr = sheetCaja.getLastRow();
    const datos = (lr < 1) ? [] : sheetCaja.getRange(1, 1, lr, 11).getValues();
    const filasAEliminar = []; // índices 1-based de filas a eliminar

    for (let i = 1; i < datos.length; i++) {
      let fila = datos[i];
      let tipoMov = fila[1] ? fila[1].toString().toUpperCase() : '';
      let conceptoFila = (fila[2] || '').toString().trim();
      let descFila = (fila[3] || '').toString().trim();
      let paisFila = (fila[9] || '').toString().toUpperCase().trim();
      if (paisFila === 'USA') paisFila = 'EEUU';
      if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';

      let monto = parseFloat(fila[5]) || 0;
      let estado = (fila[7] || '').toString().toUpperCase().trim();

      if (tipoMov === 'EGRESO' && conceptoFila === concepto && descFila === descripcion && paisFila === paisNorm) {
        // Solo eliminar si está PENDIENTE y monto es 0 (no usado)
        if (estado === 'PENDIENTE' && monto === 0) {
          filasAEliminar.push(i + 1);
        }
      }
    }

    // Eliminar de abajo hacia arriba para no desfasear índices
    for (let j = filasAEliminar.length - 1; j >= 0; j--) {
      sheetCaja.deleteRow(filasAEliminar[j]);
    }
  }

  // --- NUEVA FUNCIÓN: Generar egresos proyectados para el mes actual ---
  function generarEgresosProyectadosMes(mes, anio) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetCaja = ss.getSheetByName('CAJA');
    const sheetConfig = ss.getSheetByName('CONFIG-CAJA');
    if (!sheetCaja || !sheetConfig) return { error: true, mensaje: "Faltan hojas críticas" };

    // Si no se pasan parámetros, usar mes y año actual
    const hoy = new Date();
    const mesActual = mes || (hoy.getMonth() + 1);
    const anioActual = anio || hoy.getFullYear();
    const fechaInicioStr = `01/${('0' + mesActual).slice(-2)}/${anioActual}`;

    // 1. Obtener todos los conceptos de tipo EGRESO y sus descripciones
    const lrConfig = sheetConfig.getLastRow();
    const datosConfig = (lrConfig < 1) ? [] : sheetConfig.getRange(1, 1, lrConfig, 5).getValues();
    let egresosConfig = []; // { concepto, pais, descripciones: [] }
    let descripcionesMap = {}; // { concepto: [desc1, desc2, ...] }

    // Primero, recopilar conceptos y sus descripciones
    for (let i = 1; i < datosConfig.length; i++) {
      let tipoConfig = datosConfig[i][0];
      let nombre = datosConfig[i][1];
      let padre = datosConfig[i][2];
      let pais = datosConfig[i][3] || 'ARGENTINA';
      let sentido = datosConfig[i][4] || 'EGRESO';

      if (tipoConfig === 'CONCEPTO' && sentido === 'EGRESO') {
        if (!egresosConfig.find(e => e.concepto === nombre && e.pais === pais)) {
          egresosConfig.push({ concepto: nombre, pais: pais, descripciones: [] });
        }
      } else if (tipoConfig === 'DESCRIPCION' && padre) {
        if (!descripcionesMap[padre]) descripcionesMap[padre] = [];
        descripcionesMap[padre].push(nombre);
      }
    }

    // Asociar descripciones a conceptos
    egresosConfig.forEach(eg => {
      eg.descripciones = descripcionesMap[eg.concepto] || [];
      // Si no tiene descripciones, agregar una vacía para generar al menos uno
      if (eg.descripciones.length === 0) {
        eg.descripciones.push('');
      }
    });

    // 2. Verificar qué egresos ya están cargados para este mes en CAJA para evitar duplicados
    const lrCaja = sheetCaja.getLastRow();
    const datosCaja = (lrCaja < 1) ? [] : sheetCaja.getRange(1, 1, lrCaja, 11).getValues();
    let cargados = {}; // "PAIS-CONCEPTO-DESCRIPCION": true

    for (let i = 1; i < datosCaja.length; i++) {
      let fecha = datosCaja[i][0];
      let tipoMov = datosCaja[i][1];
      let concepto = datosCaja[i][2];
      let descripcion = datosCaja[i][3] || '';
      let paisCaja = datosCaja[i][9];

      if (!fecha) continue;

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

      if (mesFila === mesActual && anioFila === anioActual && tipoMov === 'EGRESO') {
        cargados[`${paisCaja}-${concepto}-${descripcion}`] = true;
      }
    }

    // 3. Cargar los que falten como PENDIENTES (uno por cada descripción)
    let contador = 0;
    egresosConfig.forEach(eg => {
      eg.descripciones.forEach(desc => {
        let key = `${eg.pais}-${eg.concepto}-${desc}`;
        if (!cargados[key]) {
          // ESTRUCTURA CAJA: 0:Fecha, 1:Tipo, 2:Concepto, 3:Desc, 4:Forma, 5:Monto, 6:Obs, 7:ESTADO, 8:VENCIMIENTO, 9:PAIS
          sheetCaja.appendRow([
            fechaInicioStr,
            'EGRESO',
            eg.concepto,
            desc, // Descripción específica (ej: "NANCY", "SANTI")
            'Efectivo', // Valor por defecto
            0,
            'MONTO A CONFIRMAR', // Aviso en observaciones
            'PENDIENTE',
            '',
            eg.pais
          ]);
          contador++;
        }
      });
    });

    return { error: false, mensaje: `Se generaron ${contador} egresos proyectados para el mes.` };
  }

  // Genera egresos proyectados para todos los meses del año (1-12)
  // Optimizado: lee config y CAJA una sola vez para evitar timeout
  function generarEgresosProyectadosAnual(anio) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetCaja = ss.getSheetByName('CAJA');
    const sheetConfig = ss.getSheetByName('CONFIG-CAJA');
    if (!sheetCaja || !sheetConfig) return { error: true, mensaje: "Faltan hojas críticas" };

    const anioUsar = anio || 2026;

    // 1. Leer config una sola vez
    const lrConfig = sheetConfig.getLastRow();
    const datosConfig = (lrConfig < 1) ? [] : sheetConfig.getRange(1, 1, lrConfig, 5).getValues();
    let egresosConfig = [];
    let descripcionesMap = {};
    for (let i = 1; i < datosConfig.length; i++) {
      let tipoConfig = datosConfig[i][0];
      let nombre = datosConfig[i][1];
      let padre = datosConfig[i][2];
      let pais = datosConfig[i][3] || 'ARGENTINA';
      let sentido = datosConfig[i][4] || 'EGRESO';
      if (tipoConfig === 'CONCEPTO' && sentido === 'EGRESO') {
        if (!egresosConfig.find(e => e.concepto === nombre && e.pais === pais)) {
          egresosConfig.push({ concepto: nombre, pais: pais, descripciones: [] });
        }
      } else if (tipoConfig === 'DESCRIPCION' && padre) {
        if (!descripcionesMap[padre]) descripcionesMap[padre] = [];
        descripcionesMap[padre].push(nombre);
      }
    }
    egresosConfig.forEach(eg => {
      eg.descripciones = descripcionesMap[eg.concepto] || [];
      if (eg.descripciones.length === 0) eg.descripciones.push('');
    });

    // 2. Leer CAJA una sola vez y marcar qué ya está cargado (por mes)
    const lrCaja = sheetCaja.getLastRow();
    const datosCaja = (lrCaja < 1) ? [] : sheetCaja.getRange(1, 1, lrCaja, 11).getValues();
    let cargados = {}; // "MES-PAIS-CONCEPTO-DESCRIPCION": true
    for (let i = 1; i < datosCaja.length; i++) {
      let fecha = datosCaja[i][0];
      let tipoMov = (datosCaja[i][1] || '').toString();
      let concepto = (datosCaja[i][2] || '').toString();
      let descripcion = (datosCaja[i][3] || '').toString();
      let paisCaja = (datosCaja[i][9] || 'ARGENTINA').toString().trim().toUpperCase();
      if (!fecha || tipoMov !== 'EGRESO') continue;
      let mesFila = -1;
      let anioFila = -1;
      if (Object.prototype.toString.call(fecha) === '[object Date]') {
        mesFila = fecha.getMonth() + 1;
        anioFila = fecha.getFullYear();
      } else if (typeof fecha === 'string') {
        let partes = fecha.split('/');
        if (partes.length === 3) {
          mesFila = parseInt(partes[1], 10) || 0;
          anioFila = parseInt(partes[2], 10) || 0;
        }
      }
      if (mesFila >= 1 && mesFila <= 12 && anioFila === anioUsar) {
        let pk = (paisCaja === 'USA') ? 'EEUU' : (paisCaja === 'ESPAÑA' ? 'ESPANA' : paisCaja);
        cargados[`${mesFila}-${pk}-${concepto}-${descripcion}`] = true;
      }
    }

    // 3. Preparar todas las filas a insertar
    let filasAInsertar = [];
    for (let mes = 1; mes <= 12; mes++) {
      let fechaStr = `01/${('0' + mes).slice(-2)}/${anioUsar}`;
      egresosConfig.forEach(eg => {
        let paisNorm = (eg.pais || 'ARGENTINA').toString().trim().toUpperCase();
        if (paisNorm === 'USA') paisNorm = 'EEUU';
        eg.descripciones.forEach(desc => {
          let key = `${mes}-${paisNorm}-${eg.concepto}-${desc}`;
          if (!cargados[key]) {
            filasAInsertar.push([
              fechaStr, 'EGRESO', eg.concepto, desc, 'Efectivo', 0,
              'MONTO A CONFIRMAR', 'PENDIENTE', '', eg.pais
            ]);
          }
        });
      });
    }

    // 4. Insertar en batch (máx 5000 por setValues, appendRow en lote)
    let contador = 0;
    const batchSize = 500;
    for (let i = 0; i < filasAInsertar.length; i += batchSize) {
      let lote = filasAInsertar.slice(i, i + batchSize);
      lote.forEach(fila => {
        sheetCaja.appendRow(fila);
        contador++;
      });
    }
    return { error: false, mensaje: `Se generaron ${contador} egresos proyectados para el año.` };
  }

  // --- 3. LECTURA GENERAL ---
  function obtenerDatosDeHoja(nombreHoja) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(nombreHoja);
      if (!sheet) return { error: true, mensaje: `La hoja "${nombreHoja}" no existe.` };
      
      // Forzar año 2026 - filtrar filas por año
      const anioFiltro = 2026;
      const lr = sheet.getLastRow();
      const lc = Math.max(1, sheet.getLastColumn());
      const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, lc).getDisplayValues();
      const datosFiltrados = datos.length ? [datos[0]] : []; // Incluir header
      
      for (let i = 1; i < datos.length; i++) {
        let fila = datos[i];
        let fecha = fila[0];
        if (!fecha) continue;
        
        let anioFila = -1;
        if (Object.prototype.toString.call(fecha) === '[object Date]') {
          anioFila = fecha.getFullYear();
        } else if (typeof fecha === 'string') {
          let partes = fecha.split('/');
          if (partes.length === 3) {
            anioFila = parseInt(partes[2]);
          }
        }
        
        // Solo incluir si es del año 2026
        if (anioFila === anioFiltro) {
          datosFiltrados.push(fila);
        }
      }
      
      return { error: false, data: datosFiltrados };
    } catch (e) {
      return { error: true, mensaje: e.toString() };
    }
  }

  // --- 4. VENTAS ---
  function guardarVenta(datos) { return procesarVenta(datos, false); }
  function editarVenta(datos) { return procesarVenta(datos, true); }

  function procesarVenta(datos, esEdicion) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Buscar la hoja del vendedor (intentar primero con el nombre exacto, luego buscar por coincidencia)
    let sheet = ss.getSheetByName(datos.vendedor);
    if (!sheet) {
      // Si no se encuentra con el nombre exacto, buscar todas las hojas y comparar sin considerar mayúsculas/minúsculas
      let nombreVendedorNormalizado = datos.vendedor.toString().trim();
      let todasLasHojas = ss.getSheets();
      for (let i = 0; i < todasLasHojas.length; i++) {
        let nombreHoja = todasLasHojas[i].getName().trim();
        if (nombreHoja.toString().toUpperCase() === nombreVendedorNormalizado.toUpperCase()) {
          sheet = todasLasHojas[i];
          break;
        }
      }
    }
    if (!sheet) return { error: true, mensaje: "Hoja de vendedor no encontrada. Nombre buscado: '" + datos.vendedor + "'" };

    // 1. Definir divisor de IVA
    let divisor = 1.21; // Por defecto 21% (Argentina, España)
    let pais = datos.pais ? datos.pais.toString().toUpperCase() : "";
    if (pais === "URUGUAY") divisor = 1.22; // 22%
    else if (["CHILE", "BRASIL"].includes(pais)) divisor = 1.19; // 19%
    else if (pais === "MEXICO") divisor = 1.16; // 16%
    else if (pais === "EEUU") divisor = 1.07; // 7%
    else if (pais === "RDM") divisor = 1.00; // 0%
    else if (pais === "ESPAÑA") divisor = 1.21; // 21%

    // 2. Cálculos
    let cantidad = parseFloat(datos.cantidad) || 0;
    let precio = parseFloat(datos.precio) || 0;
    let cotizacion = parseFloat(datos.cotizacion) || 1; // RECIBIMOS LA COTIZACION DEL MOMENTO

    let total = cantidad * precio;
    let totalSinIva = total / divisor;

    // 3. Fecha
    let f = new Date(datos.fecha);
    let fechaStr = ('0' + f.getUTCDate()).slice(-2) + '/' + ('0' + (f.getUTCMonth() + 1)).slice(-2) + '/' + f.getUTCFullYear();

    // 4. Armar fila (AHORA CON 13 COLUMNAS: LA ÚLTIMA ES LA COTIZACIÓN)
    let nuevaFila = [
      fechaStr,
      datos.estado,
      "NO",
      datos.pais,
      datos.cliente,
      datos.concepto,
      datos.formaPago,
      cantidad,
      precio,
      total,
      totalSinIva,
      datos.comentario,
      cotizacion // <--- COLUMNA M (Indice 12) - GUARDAMOS EL CAMBIO HISTÓRICO
    ];

    if (esEdicion) {
      let filaReal = parseInt(datos.filaIndex);
      let valorCheck = sheet.getRange(filaReal, 3).getValue();
      nuevaFila[2] = valorCheck;
      sheet.getRange(filaReal, 1, 1, nuevaFila.length).setValues([nuevaFila]);
      return { error: false, mensaje: "Venta actualizada correctamente." };
    } else {
      sheet.insertRowBefore(2);
      sheet.getRange(2, 1, 1, nuevaFila.length).setValues([nuevaFila]);
      
      // Agregar como ingreso en la hoja CAJA (para todos los países incluyendo Argentina)
      try {
        const sheetCaja = ss.getSheetByName('CAJA');
        if (sheetCaja) {
          // Normalizar país - convertir a mayúsculas y normalizar nombres especiales
          let paisCaja = pais.toUpperCase();
          if (paisCaja === 'ESPAÑA') paisCaja = 'ESPANA';
          if (paisCaja === 'USA') paisCaja = 'EEUU';
          // Argentina se guarda como 'ARGENTINA'
          
          // El monto se guarda en la moneda original (total con IVA) para mostrarlo en el historial
          // Para CAJA necesitamos: Fecha, Tipo='INGRESO', Concepto, Descripcion, FormaPago, Monto (total con IVA), Obs, Estado='PAGADO', Vencimiento='', Pais
          let filaCaja = [
            fechaStr,
            'INGRESO',
            datos.concepto,
            datos.concepto, // Descripción igual al concepto
            datos.formaPago,
            total, // Monto con IVA en la moneda original (para historial)
            datos.comentario || '',
            'PAGADO',
            '',
            paisCaja
          ];
          sheetCaja.appendRow(filaCaja);
        }
      } catch (e) {
        // Si falla agregar a CAJA, no fallar la venta
        Logger.log('Error al agregar venta a CAJA: ' + e.toString());
      }
      
      return { error: false, mensaje: "Venta registrada con éxito." };
    }
  }

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
    
    // Obtener cotización a guardar (solo para EGRESOS, y solo si se proporciona)
    let cotizacionGuardar = d.cotizacion || '';
    // Si es EGRESO y no es Argentina y no se proporcionó cotización, obtenerla actual
    if (d.tipo === 'EGRESO' && d.pais && d.pais.toUpperCase() !== 'ARGENTINA' && !cotizacionGuardar) {
      let cotizaciones = obtenerCotizacionesConCache();
      let paisNormalizado = d.pais.toString().toUpperCase().trim();
      if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
      if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';
      
      if (cotizaciones[paisNormalizado]) {
        cotizacionGuardar = cotizaciones[paisNormalizado];
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

      const lr = sheet.getLastRow();
      if (lr < 1) return;
      let datos = sheet.getRange(1, 1, lr, 13).getValues();
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
      const lrCaja = sheetCaja.getLastRow();
      let datosCaja = (lrCaja < 1) ? [] : sheetCaja.getRange(1, 1, lrCaja, 11).getValues();
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

      const lr = sheet.getLastRow();
      if (lr < 1) return;
      let datos = sheet.getRange(1, 1, lr, 13).getValues();
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
      const lrCaja = sheetCaja.getLastRow();
      let datosCaja = (lrCaja < 1) ? [] : sheetCaja.getRange(1, 1, lrCaja, 11).getValues();
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

    const lrCaja = sheetCaja.getLastRow();
    let datosCaja = (lrCaja < 1) ? [] : sheetCaja.getRange(1, 1, lrCaja, 11).getValues();
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

  /**
   * Obtiene balance, medios de pago e historial en una sola llamada (menos latencia, una sola ejecución GAS).
   * Opcional: limita el historial a los últimos 500 movimientos para reducir tiempo y payload.
   */
  function obtenerDatosCajaCompleto(pais, mes, anio) {
    var LIMITE_HISTORIAL = 500;
    try {
      var balance = obtenerBalanceCaja(pais, mes, anio);
      if (balance && balance.error) {
        return { error: true, mensaje: balance.mensaje || 'Error al obtener balance' };
      }
      var medios = obtenerBalanceCajaMediosPago(pais, mes, anio);
      if (medios && medios.error) {
        return { error: true, mensaje: medios.mensaje || 'Error al obtener medios de pago' };
      }
      var historial = obtenerHistorialCaja(pais, mes, anio);
      if (historial && historial.error) {
        return { error: true, mensaje: historial.mensaje || 'Error al obtener historial' };
      }
      var listaHistorial = (historial.data && Array.isArray(historial.data)) ? historial.data : [];
      if (listaHistorial.length > LIMITE_HISTORIAL) {
        listaHistorial = listaHistorial.slice(0, LIMITE_HISTORIAL);
      }
      return {
        error: false,
        data: {
          balance: balance.data,
          mediosPago: medios.data || {},
          historial: listaHistorial
        }
      };
    } catch (e) {
      return { error: true, mensaje: e.toString() };
    }
  }

  function parseFechaBalance(fechaStr) {
    if (!fechaStr) return new Date(0);
    if (typeof fechaStr === 'string') {
      let partes = fechaStr.split('/');
      if (partes.length === 3) {
        return new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
      }
    }
    return new Date(fechaStr);
  }
  
  // Función para obtener un movimiento individual de caja
  function obtenerMovimientoCaja(filaIndex) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetCaja = ss.getSheetByName('CAJA');
    
    if (!sheetCaja) {
      return { error: true, mensaje: "Falta hoja CAJA" };
    }

    const lrCaja = sheetCaja.getLastRow();
    let datosCaja = (lrCaja < 1) ? [] : sheetCaja.getRange(1, 1, lrCaja, 11).getValues();
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
      const lrCot = sheetCotizaciones.getLastRow();
      const datosCotizaciones = (lrCot < 1) ? [] : sheetCotizaciones.getRange(1, 1, lrCot, 3).getValues();
      for (let i = 1; i < datosCotizaciones.length; i++) {
        let pais = datosCotizaciones[i][0].toString().toUpperCase();
        if (pais === 'ESPAÑA') pais = 'ESPANA';
        let factor = parseFloat(datosCotizaciones[i][2]);
        if (!isNaN(factor)) {
          cotizaciones[pais] = factor;
        }
      }
    }

    const lrSheet = sheet.getLastRow();
    const datos = (lrSheet < 1) ? [] : sheet.getRange(1, 1, lrSheet, 11).getValues();
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

  function ddmmyyyyToYYYYMMDD(fechaStr) {
    if (!fechaStr) return '';
    if (typeof fechaStr === 'string') {
      let parts = fechaStr.split('/');
      if (parts.length === 3) return parts[2] + '-' + parts[1] + '-' + parts[0];
    }
    return '';
  }

  function parseFecha(fechaStr) {
    if (!fechaStr) return new Date(0);
    if (typeof fechaStr === 'string') {
      let parts = fechaStr.split('/');
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(fechaStr);
  }

  // --- 6. CHECKBOX Y BORRADO ---
  function actualizarCheck(d) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(d.vendedor);
    if (!sheet) {
      // Buscar por coincidencia sin considerar mayúsculas/minúsculas
      let nombreVendedorNormalizado = d.vendedor.toString().trim();
      let todasLasHojas = ss.getSheets();
      for (let i = 0; i < todasLasHojas.length; i++) {
        let nombreHoja = todasLasHojas[i].getName().trim();
        if (nombreHoja.toString().toUpperCase() === nombreVendedorNormalizado.toUpperCase()) {
          sheet = todasLasHojas[i];
          break;
        }
      }
    }
    if (!sheet) return { error: true };
    sheet.getRange(parseInt(d.filaIndex), 3).setValue(d.valor);
    return { error: false };
  }

  function borrarVenta(d) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(d.vendedor);
    if (!sheet) {
      // Buscar por coincidencia sin considerar mayúsculas/minúsculas
      let nombreVendedorNormalizado = d.vendedor.toString().trim();
      let todasLasHojas = ss.getSheets();
      for (let i = 0; i < todasLasHojas.length; i++) {
        let nombreHoja = todasLasHojas[i].getName().trim();
        if (nombreHoja.toString().toUpperCase() === nombreVendedorNormalizado.toUpperCase()) {
          sheet = todasLasHojas[i];
          break;
        }
      }
    }
    if (!sheet) return { error: true, mensaje: "Hoja no encontrada." };

    // Obtener los datos de la venta antes de borrarla para poder eliminar el movimiento en CAJA
    let filaIndex = parseInt(d.filaIndex);
    let datosVenta = sheet.getRange(filaIndex, 1, 1, 13).getValues()[0];
    
    // Extraer datos de la venta
    let fechaVenta = datosVenta[0]; // Fecha
    let paisVenta = datosVenta[3] || ''; // País
    let conceptoVenta = datosVenta[5] || ''; // Concepto
    let formaPagoVenta = datosVenta[6] || ''; // Forma de pago
    let totalConIvaVenta = datosVenta[9] || 0; // Total con IVA (CAJA guarda este valor para ingresos)
    let comentarioVenta = datosVenta[11] || ''; // Comentario
    
    // Formatear fecha para comparación
    let fechaStr = '';
    if (Object.prototype.toString.call(fechaVenta) === '[object Date]') {
      fechaStr = ('0' + fechaVenta.getDate()).slice(-2) + '/' + ('0' + (fechaVenta.getMonth() + 1)).slice(-2) + '/' + fechaVenta.getFullYear();
    } else if (typeof fechaVenta === 'string') {
      fechaStr = fechaVenta;
    }
    
    // Normalizar país
    let paisNormalizado = paisVenta.toString().toUpperCase().trim();
    if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';
    if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
    
    // Borrar la venta
    sheet.deleteRow(filaIndex);
    
    // Buscar y borrar el movimiento correspondiente en CAJA
    try {
      const sheetCaja = ss.getSheetByName('CAJA');
      if (sheetCaja) {
        const lrCaja = sheetCaja.getLastRow();
        let datosCaja = (lrCaja < 1) ? [] : sheetCaja.getRange(1, 1, lrCaja, 11).getValues();
        // Buscar desde el final hacia el principio para borrar el más reciente primero
        for (let i = datosCaja.length - 1; i >= 1; i--) {
          let filaCaja = datosCaja[i];
          // Comparar: Fecha, Tipo='INGRESO', Concepto, FormaPago, Monto, Pais
          let fechaCaja = filaCaja[0];
          let tipoCaja = filaCaja[1];
          let conceptoCaja = filaCaja[2];
          let formaPagoCaja = filaCaja[4];
          let montoCaja = parseFloat(filaCaja[5]) || 0;
          let paisCaja = filaCaja[9] || '';
          
          // Formatear fecha de CAJA para comparación
          let fechaCajaStr = '';
          if (Object.prototype.toString.call(fechaCaja) === '[object Date]') {
            fechaCajaStr = ('0' + fechaCaja.getDate()).slice(-2) + '/' + ('0' + (fechaCaja.getMonth() + 1)).slice(-2) + '/' + fechaCaja.getFullYear();
          } else if (typeof fechaCaja === 'string') {
            fechaCajaStr = fechaCaja;
          }
          
          // Normalizar país de CAJA
          let paisCajaNormalizado = paisCaja.toString().toUpperCase().trim();
          if (paisCajaNormalizado === 'ESPAÑA') paisCajaNormalizado = 'ESPANA';
          if (paisCajaNormalizado === 'USA') paisCajaNormalizado = 'EEUU';
          
          // Comparar con tolerancia para el monto (puede haber diferencias por redondeo)
          let montoVenta = parseFloat(totalConIvaVenta) || 0;
          let diferenciaMonto = Math.abs(montoCaja - montoVenta);
          
          // Verificar si coincide (con tolerancia de 0.01 para el monto)
          if (tipoCaja === 'INGRESO' &&
              fechaCajaStr === fechaStr &&
              conceptoCaja.toString().trim() === conceptoVenta.toString().trim() &&
              formaPagoCaja.toString().trim() === formaPagoVenta.toString().trim() &&
              diferenciaMonto < 0.01 &&
              paisCajaNormalizado === paisNormalizado) {
            // Encontrado, borrar el movimiento
            sheetCaja.deleteRow(i + 1);
            break; // Solo borrar el primero que coincida
          }
        }
      }
    } catch (e) {
      // Si falla al borrar en CAJA, no fallar la operación de borrado de venta
      Logger.log('Error al borrar movimiento en CAJA: ' + e.toString());
    }
    
    return { error: false };
  }

  // --- 11. MANTENIMIENTO ---
  function agregarColumnasFaltantes() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const vendedores = ['ADRIAN', 'NATALIA', 'MARIA LAURA', 'HERNAN', 'NESTOR', 'MARISOL', 'UNIVERSAL JUMPS'];

    vendedores.forEach(v => {
      let sheet = ss.getSheetByName(v);
      if (sheet) {
        let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

        // Chequear si existe la columna 13 (COTIZACION)
        // headers[12] seria la columna M
        if (headers.length < 13 || headers[12] !== "COTIZACION") {
          // Si no existe, la agregamos despues de OBS (columna 12)
          sheet.getRange('M1').setValue('COTIZACION').setFontWeight('bold');
          Logger.log('Columna COTIZACION agregada en: ' + v);
        } else {
          Logger.log('La hoja ' + v + ' ya estaba lista.');
        }
      } else {
        Logger.log('No se encontró hoja: ' + v);
      }
    });
    return "Proceso finalizado.";
  }

  // --- 8. OBJETIVOS (MODIFICADO PARA NUEVA ESTRUCTURA) ---
  function obtenerObjetivosBackend(trimestre) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
    if (!sheet) {
      sheet = ss.insertSheet('CONFIG-OBJETIVOS');
      sheet.appendRow(['TRIMESTRE', 'TRIMESTRE_NUMERO', 'IDENTIFICADOR', 'PORCENTAJE_BOTAS', 'PORCENTAJE_CERTS', 'UNIDADES_BOTAS', 'UNIDADES_CERTS', 'FACTURACION_BOTAS', 'FACTURACION_CERTS']);
    }
    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 9).getValues();
    let resultados = [];
    let objetivosEspeciales = [];

    // Buscar objetivos comunes (ID es número de rango)
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === trimestre && !isNaN(datos[i][2])) {
        resultados.push({ 
          id: datos[i][2], 
          rango: parseInt(datos[i][2]),
          pctBotas: parseFloat(datos[i][3]) || 0, 
          pctCerts: parseFloat(datos[i][4]) || 0,
          botas: parseInt(datos[i][5]) || 0, 
          certs: parseInt(datos[i][6]) || 0, 
          factBotas: parseFloat(datos[i][7]) || 0, 
          factCerts: parseFloat(datos[i][8]) || 0,
          esEspecial: false
        });
      } else if (datos[i][0] === trimestre && isNaN(datos[i][2])) {
        // Es un objetivo especial (IDENTIFICADOR es nombre de vendedor)
        objetivosEspeciales.push({
          id: datos[i][2],
          vendedor: datos[i][2],
          pctBotas: parseFloat(datos[i][3]) || 0,
          pctCerts: parseFloat(datos[i][4]) || 0,
          botas: parseInt(datos[i][5]) || 0,
          certs: parseInt(datos[i][6]) || 0,
          factBotas: parseFloat(datos[i][7]) || 0,
          factCerts: parseFloat(datos[i][8]) || 0,
          esEspecial: true
        });
      }
    }
    
    // Si no hay objetivos comunes, crear estructura vacía
    if (resultados.length === 0) { 
      for (let r = 1; r <= 4; r++) { 
        resultados.push({ 
          id: r, 
          rango: r,
          pctBotas: 0, 
          pctCerts: 0,
          botas: 0, 
          certs: 0, 
          factBotas: 0, 
          factCerts: 0,
          esEspecial: false
        }); 
      } 
    }
    
    resultados.sort((a, b) => a.rango - b.rango);
    return { error: false, data: resultados, especiales: objetivosEspeciales };
  }

  // NUEVA FUNCIÓN: Obtener objetivos especiales de un vendedor
  function obtenerObjetivosEspecialesVendedor(vendedor, trimestre) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
    if (!sheet) return { error: false, data: null };

    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 9).getValues();

    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === trimestre && datos[i][2] && datos[i][2].toString().toUpperCase() === vendedor.toString().toUpperCase()) {
        return { 
          error: false, 
          data: {
            id: datos[i][2],
            vendedor: datos[i][2],
            pctBotas: parseFloat(datos[i][3]) || 0,
            pctCerts: parseFloat(datos[i][4]) || 0,
            botas: parseInt(datos[i][5]) || 0,
            certs: parseInt(datos[i][6]) || 0,
            factBotas: parseFloat(datos[i][7]) || 0,
            factCerts: parseFloat(datos[i][8]) || 0,
            esEspecial: true
          }
        };
      }
    }
    
    return { error: false, data: null };
  }

  // NUEVA FUNCIÓN: Trae TODOS los objetivos para calcular rangos en el historial (con caché)
  function obtenerTodosLosObjetivos() {
    // Intentar obtener del caché primero
    const cache = CacheService.getScriptCache();
    const cacheKey = 'todos_objetivos';
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Si falla el parse, continuar sin caché
      }
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
    if (!sheet) return { error: false, data: [] };

    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 9).getValues();
    let todos = [];
    for (let i = 1; i < datos.length; i++) {
      todos.push({
        trimestre: datos[i][0],
        id: datos[i][2],
        rango: isNaN(datos[i][2]) ? null : parseInt(datos[i][2]),
        vendedor: isNaN(datos[i][2]) ? datos[i][2] : null,
        pctBotas: parseFloat(datos[i][3]) || 0,
        pctCerts: parseFloat(datos[i][4]) || 0,
        botas: parseInt(datos[i][5]) || 0,
        certs: parseInt(datos[i][6]) || 0,
        factBotas: parseFloat(datos[i][7]) || 0,
        factCerts: parseFloat(datos[i][8]) || 0,
        esEspecial: isNaN(datos[i][2])
      });
    }
    const resultado = { error: false, data: todos };
    
    // Guardar en caché por 10 minutos
    try {
      cache.put(cacheKey, JSON.stringify(resultado), 600);
    } catch (e) {
      // Si falla el caché, continuar sin él
    }
    
    return resultado;
  }

  function guardarObjetivosBackend(trimestre, listaObjetivos) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
    if (!sheet) { 
      sheet = ss.insertSheet('CONFIG-OBJETIVOS'); 
      sheet.appendRow(['TRIMESTRE', 'TRIMESTRE_NUMERO', 'IDENTIFICADOR', 'PORCENTAJE_BOTAS', 'PORCENTAJE_CERTS', 'UNIDADES_BOTAS', 'UNIDADES_CERTS', 'FACTURACION_BOTAS', 'FACTURACION_CERTS']);
    }
    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 9).getValues();
    // Eliminar objetivos comunes del trimestre (ID numérico)
    for (let i = datos.length - 1; i >= 1; i--) { 
      if (datos[i][0] === trimestre && !isNaN(datos[i][2])) {
        sheet.deleteRow(i + 1); 
      }
    }
    listaObjetivos.forEach(obj => {
      let trimestreNum = parseInt(trimestre.toString().match(/\d/)[0]) || 1;
      sheet.appendRow([
        trimestre, 
        trimestreNum,
        obj.id || obj.rango, 
        parseFloat(obj.pctBotas || 0), 
        parseFloat(obj.pctCerts || 0),
        parseInt(obj.botas || 0), 
        parseInt(obj.certs || 0), 
        parseFloat(obj.factBotas || 0), 
        parseFloat(obj.factCerts || 0)
      ]);
    });
    return { error: false, mensaje: "Objetivos guardados con éxito." };
  }

  // NUEVA FUNCIÓN: Guardar objetivo especial (ADMIN)
  function guardarObjetivoEspecial(datos) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
    if (!sheet) { 
      sheet = ss.insertSheet('CONFIG-OBJETIVOS'); 
      sheet.appendRow(['TRIMESTRE', 'TRIMESTRE_NUMERO', 'IDENTIFICADOR', 'PORCENTAJE_BOTAS', 'PORCENTAJE_CERTS', 'UNIDADES_BOTAS', 'UNIDADES_CERTS', 'FACTURACION_BOTAS', 'FACTURACION_CERTS']);
    }

    const lr = sheet.getLastRow();
    const datosSheet = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 9).getValues();
    // Eliminar objetivo especial existente para este vendedor y trimestre
    for (let i = datosSheet.length - 1; i >= 1; i--) { 
      if (datosSheet[i][0] === datos.trimestre && datosSheet[i][2] && datosSheet[i][2].toString().toUpperCase() === datos.vendedor.toString().toUpperCase()) {
        sheet.deleteRow(i + 1); 
      }
    }
    
    // Agregar nuevo objetivo especial
    let trimestreNum = parseInt(datos.trimestre.toString().match(/\d/)[0]) || 1;
    sheet.appendRow([
      datos.trimestre, 
      trimestreNum,
      datos.vendedor, // IDENTIFICADOR = nombre del vendedor
      parseFloat(datos.pctBotas || 0), 
      parseFloat(datos.pctCerts || 0),
      parseInt(datos.botas || 0), 
      parseInt(datos.certs || 0), 
      parseFloat(datos.factBotas || 0), 
      parseFloat(datos.factCerts || 0)
    ]);
    
    return { error: false, mensaje: "Objetivo especial guardado con éxito." };
  }

  // --- 9. CONSOLIDADO ---
  function obtenerReporteConsolidado(anio) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Forzar año 2026
    anio = 2026;
    
    // Obtener lista de vendedores activos e inactivos
    let listaVendedores = obtenerListaVendedores();
    let todosVendedores = [...(listaVendedores.activos || []), ...(listaVendedores.inactivos || [])];
    let nombresVendedores = todosVendedores.map(v => v.nombre).filter(n => n);
    
    // Si no hay vendedores en la lista, usar lista hardcodeada como fallback
    if (nombresVendedores.length === 0) {
      nombresVendedores = ['ADRIAN', 'NATALIA', 'MARIA LAURA', 'HERNAN', 'NESTOR', 'MARISOL', 'UNIVERSAL JUMPS'];
    }
    
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

    // Obtener cotizaciones una sola vez (para usar como fallback)
    const sheetCotizaciones = ss.getSheetByName('CONFIG-COTIZACIONES');
    let cotizaciones = {};
    if (sheetCotizaciones) {
      const lrCot = sheetCotizaciones.getLastRow();
      const datosCotizaciones = (lrCot < 1) ? [] : sheetCotizaciones.getRange(1, 1, lrCot, 3).getValues();
      for (let j = 1; j < datosCotizaciones.length; j++) {
        let paisCot = datosCotizaciones[j][0].toString().toUpperCase();
        if (paisCot === 'ESPAÑA') paisCot = 'ESPANA';
        let factor = parseFloat(datosCotizaciones[j][2]);
        if (!isNaN(factor)) {
          cotizaciones[paisCot] = factor;
        }
      }
    }

    // Estructura base
    let reporte = {};
    meses.forEach(m => {
      reporte[m] = {
        ARGENTINA: { EFECTIVO: 0, BANCO: 0, CTACTE: 0, MP: 0, TOTAL: 0 },
        CHILE: 0, MEXICO: 0, ESPANA: 0, BRASIL: 0, URUGUAY: 0, RDM: 0, EEUU: 0
      };
    });

    nombresVendedores.forEach(v => {
      let sheet = ss.getSheetByName(v);
      if (sheet) {
        // Optimización: leer solo las columnas necesarias (0=fecha, 3=país, 6=pago, 9=total con IVA, 12=cotizacion)
        // Columnas: A=0, D=3, G=6, J=9, M=12
        let lastRow = sheet.getLastRow();
        if (lastRow <= 1) return; // Solo headers o vacío
        
        // Leer columnas específicas: A, D, G, J, M (índices 0, 3, 6, 9, 12)
        let colFechas = sheet.getRange(2, 1, lastRow - 1, 1).getValues(); // Columna A
        let colPaises = sheet.getRange(2, 4, lastRow - 1, 1).getValues(); // Columna D
        let colPagos = sheet.getRange(2, 7, lastRow - 1, 1).getValues(); // Columna G
        let colMontos = sheet.getRange(2, 10, lastRow - 1, 1).getValues(); // Columna J (total con IVA)
        let colCotizaciones = sheet.getRange(2, 13, lastRow - 1, 1).getValues(); // Columna M
        
        for (let i = 0; i < colFechas.length; i++) {
          let fecha = colFechas[i][0];
          if (!fecha) continue;

          // Detectar mes y año
          let mesIndex = -1;
          let anioFila = -1;
          if (Object.prototype.toString.call(fecha) === '[object Date]') {
            mesIndex = fecha.getMonth();
            anioFila = fecha.getFullYear();
          } else if (typeof fecha === 'string') {
            let partes = fecha.split('/');
            if (partes.length === 3) {
              mesIndex = parseInt(partes[1]) - 1;
              anioFila = parseInt(partes[2]);
            }
          }

          // Filtrar por año 2026
          if (anioFila !== anio) continue;

          if (mesIndex >= 0 && mesIndex < 12) {
            let mesNombre = meses[mesIndex];
            let pais = colPaises[i][0] ? colPaises[i][0].toString().toUpperCase().trim() : "";

            // Normalizar nombres de países
            if (pais === 'USA') pais = 'EEUU';
            if (pais === 'ESPAÑA') pais = 'ESPANA';

            let pago = colPagos[i][0] ? colPagos[i][0].toString().toUpperCase() : "";

            // Usar total con IVA (columna 9) en lugar de totalSinIva (columna 10)
            let montoVal = colMontos[i][0];
            if (typeof montoVal === 'string') {
              montoVal = parseFloat(montoVal.replace(/[$.]/g, '').replace(',', '.').trim());
            }
            let monto = parseFloat(montoVal) || 0;
            
            // Usar cotización guardada en la columna M (índice 12) si existe, sino usar la actual
            let cotizacionUsada = colCotizaciones[i][0]; // Columna M - cotización histórica
            if (!cotizacionUsada || isNaN(cotizacionUsada) || cotizacionUsada <= 0) {
              cotizacionUsada = cotizaciones[pais] || 1;
            } else {
              cotizacionUsada = parseFloat(cotizacionUsada);
            }
            
            // Convertir a ARS usando la cotización guardada (excepto Argentina)
            let montoEnArs = monto;
            if (pais !== 'ARGENTINA') {
              montoEnArs = monto * cotizacionUsada;
            }

            if (pais === 'ARGENTINA') {
              if (pago.includes('EFECTIVO')) reporte[mesNombre].ARGENTINA.EFECTIVO += montoEnArs;
              else if (pago.includes('TRANSFERENCIA') || pago.includes('BANCO')) reporte[mesNombre].ARGENTINA.BANCO += montoEnArs;
              else if (pago.includes('CTA') || pago.includes('CORRIENTE')) reporte[mesNombre].ARGENTINA.CTACTE += montoEnArs;
              else if (pago.includes('MERCADO')) reporte[mesNombre].ARGENTINA.MP += montoEnArs;

              reporte[mesNombre].ARGENTINA.TOTAL += montoEnArs;
            } else {
              if (reporte[mesNombre][pais] !== undefined) {
                reporte[mesNombre][pais] += montoEnArs;
              }
            }
          }
        }
      }
    });

    return { error: false, data: reporte };
  }

  // NUEVA FUNCIÓN: Obtener comisiones por trimestre
  function obtenerComisionesTrimestre(trimestre) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Obtener lista de vendedores
    let listaVendedores = obtenerListaVendedores();
    let todosVendedores = [...(listaVendedores.activos || []), ...(listaVendedores.inactivos || [])];
    
    // Obtener cotizaciones (con caché)
    let cotizaciones = obtenerCotizacionesConCache();
    
    // Determinar meses del trimestre
    let mesesTrim = [];
    if (trimestre === 'T1') mesesTrim = [0, 1, 2]; // Ene, Feb, Mar
    else if (trimestre === 'T2') mesesTrim = [3, 4, 5]; // Abr, May, Jun
    else if (trimestre === 'T3') mesesTrim = [6, 7, 8]; // Jul, Ago, Sep
    else if (trimestre === 'T4') mesesTrim = [9, 10, 11]; // Oct, Nov, Dic
    
    let ventas = {};
    
    // Procesar ventas de cada vendedor
    todosVendedores.forEach(v => {
      let sheet = ss.getSheetByName(v.nombre);
      if (!sheet) {
        ventas[v.nombre] = { mes1: 0, mes2: 0, mes3: 0 };
        return;
      }

      const lr = sheet.getLastRow();
      if (lr < 1) { ventas[v.nombre] = { mes1: 0, mes2: 0, mes3: 0 }; return; }
      let datos = sheet.getRange(1, 1, lr, 13).getValues();
      let totales = { mes1: 0, mes2: 0, mes3: 0 };

      for (let i = 1; i < datos.length; i++) {
        let fila = datos[i];
        let fecha = fila[0];
        if (!fecha) continue;

        let mesIndex = -1;
        if (Object.prototype.toString.call(fecha) === '[object Date]') {
          mesIndex = fecha.getMonth();
        } else if (typeof fecha === 'string') {
          let partes = fecha.split('/');
          if (partes.length === 3) mesIndex = parseInt(partes[1]) - 1;
        }

        if (mesesTrim.includes(mesIndex)) {
          let pais = fila[3] ? fila[3].toString().toUpperCase().trim() : "";
          if (pais === 'USA') pais = 'EEUU';
          if (pais === 'ESPAÑA') pais = 'ESPANA';
          
          let montoVal = fila[9];
          if (typeof montoVal === 'string') {
            montoVal = parseFloat(montoVal.replace(/[$.]/g, '').replace(',', '.').trim());
          }
          let monto = parseFloat(montoVal) || 0;
          
          // Convertir a ARS
          if (pais !== 'ARGENTINA' && cotizaciones[pais]) {
            monto = monto * cotizaciones[pais];
          }
          
          let mesPos = mesesTrim.indexOf(mesIndex);
          if (mesPos === 0) totales.mes1 += monto;
          else if (mesPos === 1) totales.mes2 += monto;
          else if (mesPos === 2) totales.mes3 += monto;
        }
      }
      
      ventas[v.nombre] = totales;
    });
    
    return { error: false, vendedores: todosVendedores, ventas: ventas };
  }

  // NUEVA FUNCIÓN: Obtener comisiones de todos los trimestres
  function obtenerTodasLasComisiones() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Forzar año 2026
    const anioFiltro = 2026;
    
    // Obtener lista de vendedores
    let listaVendedores = obtenerListaVendedores();
    let todosVendedores = [...(listaVendedores.activos || []), ...(listaVendedores.inactivos || [])];
    
    // Obtener cotizaciones
    const sheetCotizaciones = ss.getSheetByName('CONFIG-COTIZACIONES');
    let cotizaciones = {};
    if (sheetCotizaciones) {
      const lrCot = sheetCotizaciones.getLastRow();
      const datosCotizaciones = (lrCot < 1) ? [] : sheetCotizaciones.getRange(1, 1, lrCot, 3).getValues();
      for (let i = 1; i < datosCotizaciones.length; i++) {
        let pais = datosCotizaciones[i][0].toString().toUpperCase();
        if (pais === 'ESPAÑA') pais = 'ESPANA';
        let factor = parseFloat(datosCotizaciones[i][2]);
        if (!isNaN(factor)) {
          cotizaciones[pais] = factor;
        }
      }
    }

    // Obtener objetivos (rangos comunes y especiales)
    const sheetObjetivos = ss.getSheetByName('CONFIG-OBJETIVOS');
    let objetivos = {};
    let objetivosEspeciales = {}; // { trimestre: { vendedor: { factBotas, factCerts } } }
    if (sheetObjetivos) {
      const lrObj = sheetObjetivos.getLastRow();
      const datosObjetivos = (lrObj < 1) ? [] : sheetObjetivos.getRange(1, 1, lrObj, 9).getValues();
      for (let i = 1; i < datosObjetivos.length; i++) {
        let trimestre = datosObjetivos[i][0];
        let identificador = datosObjetivos[i][2];
        if (trimestre && !isNaN(identificador)) {
          // Es un objetivo por rango
          if (!objetivos[trimestre]) objetivos[trimestre] = [];
          objetivos[trimestre].push({
            rango: parseInt(identificador),
            factBotas: parseFloat(datosObjetivos[i][7]) || 0,
            factCerts: parseFloat(datosObjetivos[i][8]) || 0
          });
        } else if (trimestre && identificador) {
          // Es un objetivo especial (identificador es nombre de vendedor)
          let nombreVendedor = identificador.toString().trim();
          if (!objetivosEspeciales[trimestre]) objetivosEspeciales[trimestre] = {};
          objetivosEspeciales[trimestre][nombreVendedor] = {
            factBotas: parseFloat(datosObjetivos[i][7]) || 0,
            factCerts: parseFloat(datosObjetivos[i][8]) || 0
          };
        }
      }
      // Ordenar objetivos por rango
      Object.keys(objetivos).forEach(t => {
        objetivos[t].sort((a, b) => a.rango - b.rango);
      });
    }
    
    const nombresMeses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const trimestres = [
      { key: 'T1', nombre: '1° TRIMESTRE', meses: [0, 1, 2], nombresMeses: ['ENERO', 'FEBRERO', 'MARZO'], trimestreObj: 'OBJETIVOS 1°T' },
      { key: 'T2', nombre: '2° TRIMESTRE', meses: [3, 4, 5], nombresMeses: ['ABRIL', 'MAYO', 'JUNIO'], trimestreObj: 'OBJETIVOS 2°T' },
      { key: 'T3', nombre: '3° TRIMESTRE', meses: [6, 7, 8], nombresMeses: ['JULIO', 'AGOSTO', 'SEPTIEMBRE'], trimestreObj: 'OBJETIVOS 3°T' },
      { key: 'T4', nombre: '4° TRIMESTRE', meses: [9, 10, 11], nombresMeses: ['OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'], trimestreObj: 'OBJETIVOS 4°T' }
    ];
    
    let resultado = {};
    
    trimestres.forEach(trim => {
      let ventasTrim = {};
      
      todosVendedores.forEach(v => {
        let sheet = ss.getSheetByName(v.nombre);
        if (!sheet) {
          ventasTrim[v.nombre] = {
            mes1: 0, mes2: 0, mes3: 0,
            nombreMes1: trim.nombresMeses[0],
            nombreMes2: trim.nombresMeses[1],
            nombreMes3: trim.nombresMeses[2],
            total: 0,
            rangoMes1: 0,
            porcentajeMes1: 0,
            rangoMes2: 0,
            porcentajeMes2: 0,
            rangoMes3: 0,
            porcentajeMes3: 0
          };
          return;
        }

        const lr = sheet.getLastRow();
        if (lr < 1) {
          ventasTrim[v.nombre] = { mes1: 0, mes2: 0, mes3: 0, nombreMes1: trim.nombresMeses[0], nombreMes2: trim.nombresMeses[1], nombreMes3: trim.nombresMeses[2], total: 0, rangoMes1: 0, porcentajeMes1: 0, rangoMes2: 0, porcentajeMes2: 0, rangoMes3: 0, porcentajeMes3: 0 };
          return;
        }
        let datos = sheet.getRange(1, 1, lr, 13).getValues();
        let totales = { mes1: 0, mes2: 0, mes3: 0 };

        for (let i = 1; i < datos.length; i++) {
          let fila = datos[i];
          let fecha = fila[0];
          if (!fecha) continue;

          let mesIndex = -1;
          let anioFila = -1;
          if (Object.prototype.toString.call(fecha) === '[object Date]') {
            mesIndex = fecha.getMonth();
            anioFila = fecha.getFullYear();
          } else if (typeof fecha === 'string') {
            let partes = fecha.split('/');
            if (partes.length === 3) {
              mesIndex = parseInt(partes[1]) - 1;
              anioFila = parseInt(partes[2]);
            }
          }

          // Filtrar por año 2026
          if (anioFila !== anioFiltro) continue;
          
          if (trim.meses.includes(mesIndex)) {
            let pais = fila[3] ? fila[3].toString().toUpperCase().trim() : "";
            if (pais === 'USA') pais = 'EEUU';
            if (pais === 'ESPAÑA') pais = 'ESPANA';
            
            // Usar total con IVA (columna 9) en lugar de totalSinIva (columna 10)
            let montoVal = fila[9];
            if (typeof montoVal === 'string') {
              montoVal = parseFloat(montoVal.replace(/[$.]/g, '').replace(',', '.').trim());
            }
            let monto = parseFloat(montoVal) || 0;
            
            // Usar cotización guardada en la columna M (índice 12) si existe, sino usar la actual
            let cotizacionUsada = fila[12]; // Columna M - cotización histórica
            if (!cotizacionUsada || isNaN(cotizacionUsada) || cotizacionUsada <= 0) {
              cotizacionUsada = cotizaciones[pais] || 1;
            } else {
              cotizacionUsada = parseFloat(cotizacionUsada);
            }
            
            // Convertir a ARS usando la cotización guardada
            if (pais !== 'ARGENTINA') {
              monto = monto * cotizacionUsada;
            }
            
            let mesPos = trim.meses.indexOf(mesIndex);
            if (mesPos === 0) totales.mes1 += monto;
            else if (mesPos === 1) totales.mes2 += monto;
            else if (mesPos === 2) totales.mes3 += monto;
          }
        }
        
        let total = totales.mes1 + totales.mes2 + totales.mes3;
        let objsTrim = objetivos[trim.trimestreObj] || [];
        
        // Verificar si este vendedor tiene objetivo especial para este trimestre
        let objetivoEspecialVendedor = null;
        if (objetivosEspeciales[trim.trimestreObj] && objetivosEspeciales[trim.trimestreObj][v.nombre]) {
          objetivoEspecialVendedor = objetivosEspeciales[trim.trimestreObj][v.nombre];
        }
        
        // Función para calcular rango y porcentaje por mes
        function calcularRangoPorcentajeMes(montoMes) {
          let rangoMes = 0;
          let porcentajeMes = 0;
          
          // Si el vendedor tiene objetivo especial, usar ese
          if (objetivoEspecialVendedor) {
            let objetivoMensual = objetivoEspecialVendedor.factBotas / 3;
            if (objetivoMensual > 0) {
              porcentajeMes = (montoMes / objetivoMensual) * 100;
              if (porcentajeMes > 100) porcentajeMes = 100;
              // Para objetivos especiales, no hay rangos, solo porcentaje
              rangoMes = porcentajeMes >= 100 ? 1 : 0; // 1 si alcanzó el objetivo, 0 si no
            }
          } else if (objsTrim.length > 0) {
            // Usar rangos comunes
            // Objetivo mensual = objetivo trimestral / 3
            for (let i = objsTrim.length - 1; i >= 0; i--) {
              let obj = objsTrim[i];
              let objetivoMensual = obj.factBotas / 3;
              if (montoMes >= objetivoMensual && objetivoMensual > 0) {
                rangoMes = obj.rango;
                break;
              }
            }
            
            // Calcular porcentaje
            if (rangoMes > 0 && rangoMes <= objsTrim.length) {
              let objActual = objsTrim.find(o => o.rango === rangoMes);
              if (objActual && objActual.factBotas > 0) {
                let objetivoMensual = objActual.factBotas / 3;
                porcentajeMes = (montoMes / objetivoMensual) * 100;
                if (porcentajeMes > 100) porcentajeMes = 100;
              }
            } else if (objsTrim.length > 0) {
              // Si no alcanzó ningún rango, calcular porcentaje del rango 1
              let objRango1 = objsTrim[0];
              if (objRango1 && objRango1.factBotas > 0) {
                let objetivoMensual = objRango1.factBotas / 3;
                porcentajeMes = (montoMes / objetivoMensual) * 100;
              }
            }
          }
          
          return { rango: rangoMes, porcentaje: porcentajeMes };
        }
        
        let mes1Calc = calcularRangoPorcentajeMes(totales.mes1);
        let mes2Calc = calcularRangoPorcentajeMes(totales.mes2);
        let mes3Calc = calcularRangoPorcentajeMes(totales.mes3);
        
        ventasTrim[v.nombre] = {
          mes1: totales.mes1,
          mes2: totales.mes2,
          mes3: totales.mes3,
          nombreMes1: trim.nombresMeses[0],
          nombreMes2: trim.nombresMeses[1],
          nombreMes3: trim.nombresMeses[2],
          total: total,
          rangoMes1: mes1Calc.rango,
          porcentajeMes1: mes1Calc.porcentaje,
          rangoMes2: mes2Calc.rango,
          porcentajeMes2: mes2Calc.porcentaje,
          rangoMes3: mes3Calc.rango,
          porcentajeMes3: mes3Calc.porcentaje
        };
      });
      
      resultado[trim.key] = {
        nombre: trim.nombre,
        vendedores: todosVendedores,
        ventas: ventasTrim
      };
    });
    
    return { error: false, data: resultado };
  }

  // --- 10. CLIENTES (NUEVO) ---
  function obtenerClientesVendedor(vendedor, pais) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTES');
    if (!sheet) return { error: false, data: [] };

    const lr = sheet.getLastRow();
    const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 9).getValues();
    let clientes = [];

    // Normalizar país si se proporciona
    let paisNormalizado = null;
    if (pais && pais.toString().trim() !== '') {
      paisNormalizado = pais.toString().trim().toUpperCase();
      // Normalizar nombres especiales (después de convertir a mayúsculas)
      if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
      if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';
    }

    // Siempre devolver todos los clientes (filtrados solo por país si se especifica)
    // Ya no se filtra por vendedor
    // Nueva estructura: A:ID, B:NOMBRE, C:APELLIDO, D:DNI, E:TELEFONO, F:CORREO, G:DOMICILIO, H:PROVINCIA, I:PAIS
    for (let i = 1; i < datos.length; i++) {
      let paisCliente = (datos[i][8] || '').toString().trim().toUpperCase(); // Columna I (índice 8)
      // Normalizar país del cliente
      if (paisCliente === 'USA') paisCliente = 'EEUU';
      if (paisCliente === 'ESPAÑA') paisCliente = 'ESPANA';
      
      // Si se especificó país, filtrar por él
      if (paisNormalizado && paisCliente !== paisNormalizado) continue;
      
      clientes.push({
        id: datos[i][0] || '', // ID (columna A, índice 0)
        nombre: datos[i][1] || '', // NOMBRE (columna B, índice 1)
        apellido: datos[i][2] || '', // APELLIDO (columna C, índice 2)
        dni: datos[i][3] || '', // DNI (columna D, índice 3)
        telefono: datos[i][4] || '', // TELEFONO (columna E, índice 4)
        correo: datos[i][5] || '', // CORREO (columna F, índice 5)
        domicilio: datos[i][6] || '', // DOMICILIO (columna G, índice 6)
        provincia: datos[i][7] || '', // PROVINCIA (columna H, índice 7)
        pais: datos[i][8] || '' // PAIS (columna I, índice 8)
      });
    }

    return { error: false, data: clientes };
  }

  function guardarCliente(datos) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('CLIENTES');
    if (!sheet) {
      sheet = ss.insertSheet('CLIENTES');
      sheet.appendRow(['ID', 'NOMBRE', 'APELLIDO', 'DNI', 'TELEFONO', 'CORREO', 'DOMICILIO', 'PROVINCIA', 'PAIS']);
      sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    }

    if (datos.filaIndex === 'EDITAR' && datos.nombreOriginal && datos.apellidoOriginal) {
      // Editar - buscar por nombre original + apellido original
      const lr = sheet.getLastRow();
      const filas = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 9).getValues();
      for (let i = filas.length - 1; i >= 1; i--) {
        if ((filas[i][1] || '').toString().trim() === datos.nombreOriginal.toString().trim() &&
            (filas[i][2] || '').toString().trim() === datos.apellidoOriginal.toString().trim()) {
          // Mantener el ID existente (columna A, índice 0)
          let idExistente = filas[i][0] || '';
          sheet.getRange(i + 1, 1, i + 1, 9).setValues([[
            idExistente, // ID (no se modifica)
            datos.nombre,
            datos.apellido,
            datos.dni,
            datos.telefono,
            datos.correo,
            datos.domicilio,
            datos.provincia || '',
            datos.pais
          ]]);
          return { error: false, mensaje: "Cliente actualizado correctamente." };
        }
      }
      return { error: true, mensaje: "Cliente no encontrado para actualizar." };
    } else {
      // Crear nuevo - generar ID automático
      const lr = sheet.getLastRow();
      const filas = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 9).getValues();
      let nuevoId = 1;
      
      // Si hay filas de datos (más allá del header), encontrar el ID máximo
      if (filas.length > 1) {
        let maxId = 0;
        for (let i = 1; i < filas.length; i++) {
          let idActual = filas[i][0];
          // Intentar convertir a número si es posible
          if (idActual !== '' && idActual !== null && idActual !== undefined) {
            let idNum = parseInt(idActual);
            if (!isNaN(idNum) && idNum > maxId) {
              maxId = idNum;
            }
          }
        }
        nuevoId = maxId + 1;
      }
      
      sheet.appendRow([
        nuevoId, // ID autogenerado
        datos.nombre,
        datos.apellido,
        datos.dni,
        datos.telefono,
        datos.correo,
        datos.domicilio,
        datos.provincia || '',
        datos.pais
      ]);
      return { error: false, mensaje: "Cliente guardado correctamente." };
    }
  }

  function borrarCliente(filaIndex) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('CLIENTES');
      if (!sheet) return { error: true, mensaje: "Falta hoja CLIENTES" };
      sheet.deleteRow(parseInt(filaIndex));
      return { error: false };
    } catch (e) {
      return { error: true, mensaje: e.toString() };
    }
  }

  // NUEVA FUNCIÓN: Borrar cliente por datos (para cuando no tenemos el índice exacto)
  function borrarClientePorDatos(datos) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('CLIENTES');
      if (!sheet) return { error: true, mensaje: "Falta hoja CLIENTES" };

      const lr = sheet.getLastRow();
      const filas = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 9).getValues();
      for (let i = filas.length - 1; i >= 1; i--) {
        // Buscar solo por nombre y apellido
        // Nueva estructura: A:ID, B:NOMBRE, C:APELLIDO, ...
        if ((filas[i][1] || '').toString().trim() === (datos.nombre || '').toString().trim() &&
            (filas[i][2] || '').toString().trim() === (datos.apellido || '').toString().trim()) {
          sheet.deleteRow(i + 1);
          return { error: false };
        }
      }
      return { error: true, mensaje: "Cliente no encontrado" };
    } catch (e) {
      return { error: true, mensaje: e.toString() };
    }
  }

  // --- 11. GESTIÓN DE INVENTARIO DE BOTAS ---
  
  /**
   * Función para obtener el stock actual de botas
   * Lee STOCK_DEFINICION y STOCK_MOVIMIENTOS, calcula el stock agrupado por ID de producto y Talle
   * Retorna una lista de productos con sus datos fijos y cantidades disponibles por cada talle
   * Nueva estructura STOCK_DEFINICION: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
   * Estructura STOCK_MOVIMIENTOS: A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION USUARIO, G:(vacía), H:PAIS
   * @param {String} pais - País para filtrar (opcional, por defecto ARGENTINA)
   * @returns {Object} - Resultado con lista de productos y stock por talle
   */
  function obtenerStockBotas(pais) {
    // Si no se proporciona país, usar ARGENTINA por defecto
    if (!pais || pais.toString().trim() === '') {
      pais = 'ARGENTINA';
    }
    pais = pais.toString().trim().toUpperCase();
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      
      // 1. Obtener hoja de definiciones (catálogo)
      const sheetDefiniciones = ss.getSheetByName('STOCK_DEFINICION');
      if (!sheetDefiniciones) {
        return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
      }
      
      // 2. Obtener hoja de movimientos (historial)
      const sheetMovimientos = ss.getSheetByName('STOCK_MOVIMIENTOS');
      if (!sheetMovimientos) {
        return { error: true, mensaje: "No existe la hoja 'STOCK_MOVIMIENTOS'" };
      }
      
      // 3. Leer datos de definiciones
      // Nueva estructura: A:ID, B:MARCA, C:MODELO, D:COLOR, E:DESCRIPCION, F:IMAGEN_URL, G:ACTIVO
      const lrDef = sheetDefiniciones.getLastRow();
      const datosDefiniciones = (lrDef < 1) ? [] : sheetDefiniciones.getRange(1, 1, lrDef, 10).getValues();
      if (datosDefiniciones.length <= 1) {
        return { error: false, data: [] }; // No hay productos definidos
      }
      
      // Crear un mapa de productos por ID para acceso rápido
      // Estructura nueva: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
      // Compatible con estructuras antiguas (8 cols sin TIPO/DIVIDE_TALLES, 7 cols sin MARCA)
      const productos = {};
      for (let i = 1; i < datosDefiniciones.length; i++) {
        const fila = datosDefiniciones[i];
        const id = fila[0] ? fila[0].toString().trim() : '';
        if (!id) continue;
        const tieneEstructuraNueva = fila.length >= 10; // ID,MARCA,TIPO,MODELO,COLOR,DESC,IMAGEN,ACTIVO,DIVIDE_TALLES,PAIS
        const tieneMarcaYTipo = fila.length >= 9;
        const paisProducto = (fila.length >= 10 && fila[9]) ? fila[9].toString().trim().toUpperCase() : 
                            (fila.length >= 8 && fila[7]) ? fila[7].toString().trim().toUpperCase() : 'ARGENTINA';
        if (paisProducto !== pais) continue;

        productos[id] = {
          id: id,
          marca: (fila.length >= 7 && fila[1]) ? (fila[1] || '').toString().trim() : '',
          tipo: tieneEstructuraNueva ? (fila[2] || '').toString().trim() : (tieneMarcaYTipo ? (fila[2] || '').toString().trim() : ''),
          modelo: tieneEstructuraNueva ? (fila[3] || '').toString().trim() : (fila.length >= 7 ? (fila[2] || '') : (fila[1] || '')).toString().trim(),
          color: tieneEstructuraNueva ? (fila[4] || '').toString().trim() : (fila.length >= 7 ? (fila[3] || '') : (fila[2] || '')).toString().trim(),
          descripcion: tieneEstructuraNueva ? (fila[5] || '').toString().trim() : (fila.length >= 7 ? (fila[4] || '') : (fila[3] || '')).toString().trim(),
          imagenUrl: tieneEstructuraNueva ? (fila[6] || '').toString().trim() : (fila.length >= 7 ? (fila[5] || '') : (fila[4] || '')).toString().trim(),
          activo: (tieneEstructuraNueva ? (fila[7] || 'SI') : (fila.length >= 7 ? (fila[6] || 'SI') : (fila[5] || 'SI'))).toString().toUpperCase(),
          divideTalles: tieneEstructuraNueva ? ((fila[8] || 'SI').toString().toUpperCase() === 'NO' ? 'NO' : 'SI') : 'SI',
          pais: paisProducto
        };
      }
      
      // 4. Leer datos de movimientos y calcular stock (talle vacío = UNICO para productos sin talles)
      const lrMov = sheetMovimientos.getLastRow();
      const datosMovimientos = (lrMov < 1) ? [] : sheetMovimientos.getRange(1, 1, lrMov, 7).getValues();

      // Estructura para acumular stock: { "id-talle": cantidad }
      const stockAcumulado = {};
      
      for (let i = 1; i < datosMovimientos.length; i++) {
        const fila = datosMovimientos[i];
        if (!fila[0] || !fila[1]) continue; // Saltar filas sin fecha o sin ID
        
        const idProducto = fila[1] ? fila[1].toString().trim() : '';
        let talle = fila[2] ? fila[2].toString().trim() : '';
        if (!idProducto) continue;
        if (!talle) talle = 'UNICO'; // Productos sin talles usan UNICO
        
        // Obtener país del movimiento (columna G, índice 6)
        const paisMovimiento = (fila.length >= 7 && fila[6]) ? fila[6].toString().trim().toUpperCase() : 'ARGENTINA';
        
        // Filtrar por país: solo incluir movimientos del país seleccionado
        if (paisMovimiento !== pais) {
          continue;
        }
        
        // Obtener tipo y cantidad
        const tipo = fila[3] ? fila[3].toString().trim().toUpperCase() : '';  // Columna D: TIPO
        let cantidad = parseFloat(fila[4]) || 0;                               // Columna E: CANTIDAD
        
        // Si el tipo es EGRESO y la cantidad es positiva, convertirla a negativa
        // Esto asegura que la matemática funcione correctamente
        if (tipo === 'EGRESO' && cantidad > 0) {
          cantidad = -cantidad;
        }
        
        // Clave única: "id-talle"
        const clave = `${idProducto}-${talle}`;
        
        // Inicializar si no existe
        if (!stockAcumulado[clave]) {
          stockAcumulado[clave] = 0;
        }
        
        // Sumar la cantidad (puede ser positiva o negativa)
        stockAcumulado[clave] += cantidad;
      }
      
      // 5. Combinar datos de productos con stock por talle
      const resultado = [];
      
      for (const id in productos) {
        const producto = productos[id];
        
        // Buscar todos los talles de este producto
        const talles = {};
        for (const clave in stockAcumulado) {
          const partes = clave.split('-');
          if (partes.length >= 2 && partes[0] === id) {
            // Reconstruir el talle (por si contiene guiones)
            const talle = partes.slice(1).join('-');
            talles[talle] = stockAcumulado[clave];
          }
        }
        
        // Si no hay movimientos, el producto aparece con talles vacíos
        // Estructura del resultado:
        // { id, modelo, color, descripcion, imagenUrl, activo, talles: { "38": 5, "39": 3, ... } }
        resultado.push({
          ...producto,
          talles: talles
        });
      }
      
      return { error: false, data: resultado };
      
    } catch (e) {
      return { error: true, mensaje: "Error al obtener stock: " + e.toString() };
    }
  }
  
  /**
   * Función para crear un nuevo producto de bota en STOCK_DEFINICION
   * Genera un ID único automáticamente
   * Estructura: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
   * @param {Object} datos - { marca, tipo, modelo, color, descripcion, imagenUrl, activo, divideTalles, pais }
   * @returns {Object} - Resultado de la operación { error, mensaje, id }
   */
  function crearProductoBota(datos) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('STOCK_DEFINICION');
      
      if (!sheet) {
        return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
      }
      
      if (!datos.marca || datos.marca.toString().trim() === '') {
        return { error: true, mensaje: "La marca del producto es requerida" };
      }
      if (!datos.modelo || datos.modelo.toString().trim() === '') {
        return { error: true, mensaje: "El modelo del producto es requerido" };
      }
      const tipo = (datos.tipo || '').toString().trim();
      const divideTalles = (datos.divideTalles || 'SI').toString().toUpperCase() === 'NO' ? 'NO' : 'SI';

      const lrSheet = sheet.getLastRow();
      const datosExistentes = (lrSheet < 1) ? [] : sheet.getRange(1, 1, lrSheet, 10).getValues();
      const headers = datosExistentes.length > 0 ? datosExistentes[0] : [];
      const tieneEstructuraCompleta = headers.length >= 10 && headers[1] && headers[1].toString().trim().toUpperCase() === 'MARCA' && headers[2] && headers[2].toString().trim().toUpperCase() === 'TIPO';

      // Generar ID único
      // Buscar el ID máximo existente
      let maxId = 0;
      for (let i = 1; i < datosExistentes.length; i++) {
        const idActual = datosExistentes[i][0];
        if (idActual !== '' && idActual !== null && idActual !== undefined) {
          // Intentar convertir a número si es posible
          const idNum = parseInt(idActual);
          if (!isNaN(idNum) && idNum > maxId) {
            maxId = idNum;
          }
        }
      }
      
      // Nuevo ID: máximo + 1
      const nuevoId = maxId + 1;
      
      const paisProducto = (datos.pais && datos.pais.toString().trim()) ? datos.pais.toString().trim().toUpperCase() : 'ARGENTINA';
      const nuevaFila = [
        nuevoId, datos.marca.toString().trim(), tipo, datos.modelo.toString().trim(),
        datos.color || '', datos.descripcion || '', datos.imagenUrl || '',
        (datos.activo || 'SI').toString().toUpperCase(), divideTalles, paisProducto
      ];
      
      // Insertar la nueva fila
      sheet.appendRow(nuevaFila);
      
      return { 
        error: false, 
        mensaje: "Producto creado correctamente",
        id: nuevoId
      };
      
    } catch (e) {
      return { error: true, mensaje: "Error al crear producto: " + e.toString() };
    }
  }
  
  /**
   * Función para registrar un movimiento de stock (Ingreso o Egreso)
   * Si es Egreso, guarda la cantidad como número negativo para que la matemática funcione
   * Estructura: A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION USUARIO, G:PAIS
   * @param {Object} datos - Objeto con los datos del movimiento { fecha, idProducto, talle, tipo, cantidad, observacion, pais }
   * @returns {Object} - Resultado de la operación { error, mensaje, tipo, cantidad }
   */
  function registrarMovimientoStock(datos) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('STOCK_MOVIMIENTOS');
      
      if (!sheet) {
        return { error: true, mensaje: "No existe la hoja 'STOCK_MOVIMIENTOS'" };
      }
      
      // Validar datos requeridos
      if (!datos.idProducto || datos.idProducto.toString().trim() === '') {
        return { error: true, mensaje: "El ID del producto es requerido" };
      }
      
      let talleVal = (datos.talle || '').toString().trim();
      if (!talleVal) talleVal = 'UNICO'; // Productos sin talles
      
      if (!datos.tipo || (datos.tipo.toString().toUpperCase() !== 'INGRESO' && datos.tipo.toString().toUpperCase() !== 'EGRESO')) {
        return { error: true, mensaje: "El tipo debe ser 'INGRESO' o 'EGRESO'" };
      }
      
      const cantidad = parseFloat(datos.cantidad);
      if (isNaN(cantidad) || cantidad <= 0) {
        return { error: true, mensaje: "La cantidad debe ser un número positivo" };
      }
      
      // Validar que el producto existe en STOCK_DEFINICION
      const sheetDefiniciones = ss.getSheetByName('STOCK_DEFINICION');
      if (!sheetDefiniciones) {
        return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
      }

      const lrDef = sheetDefiniciones.getLastRow();
      const datosDefiniciones = (lrDef < 1) ? [] : sheetDefiniciones.getRange(1, 1, lrDef, 10).getValues();
      let productoExiste = false;
      let paisProducto = 'ARGENTINA';
      let divideTallesProducto = 'SI';
      for (let i = 1; i < datosDefiniciones.length; i++) {
        const filaP = datosDefiniciones[i];
        const idExistente = filaP[0] ? filaP[0].toString().trim() : '';
        if (idExistente === datos.idProducto.toString().trim()) {
          productoExiste = true;
          if (filaP.length >= 10 && filaP[9]) paisProducto = filaP[9].toString().trim().toUpperCase();
          else if (filaP.length >= 8 && filaP[7]) paisProducto = filaP[7].toString().trim().toUpperCase();
          if (filaP.length >= 10 && filaP[8]) divideTallesProducto = (filaP[8] || 'SI').toString().toUpperCase() === 'NO' ? 'NO' : 'SI';
          break;
        }
      }
      if (!productoExiste) {
        return { error: true, mensaje: "El producto con ID " + datos.idProducto + " no existe en el catálogo" };
      }
      if (divideTallesProducto === 'SI' && !talleVal) {
        return { error: true, mensaje: "Este producto tiene talles. Selecciona un talle." };
      }
      
      // Si se proporciona país en los datos, usarlo; si no, usar el país del producto
      const paisMovimiento = (datos.pais && datos.pais.toString().trim()) ? datos.pais.toString().trim().toUpperCase() : paisProducto;
      
      // Preparar fecha
      let fechaStr = '';
      if (datos.fecha) {
        const f = new Date(datos.fecha);
        fechaStr = ('0' + f.getUTCDate()).slice(-2) + '/' + ('0' + (f.getUTCMonth() + 1)).slice(-2) + '/' + f.getUTCFullYear();
      } else {
        // Usar fecha actual si no se proporciona
        const hoy = new Date();
        fechaStr = ('0' + hoy.getUTCDate()).slice(-2) + '/' + ('0' + (hoy.getUTCMonth() + 1)).slice(-2) + '/' + hoy.getUTCFullYear();
      }
      
      // Preparar cantidad: si es EGRESO, convertir a negativo
      const tipo = datos.tipo.toString().toUpperCase();
      let cantidadGuardar = cantidad;
      if (tipo === 'EGRESO') {
        cantidadGuardar = -cantidad;
      }
      
      // A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION, G:PAIS
      const nuevaFila = [
        fechaStr,                              // Columna A: FECHA
        datos.idProducto.toString().trim(),    // Columna B: ID_PRODUCTO
        talleVal,                              // Columna C: TALLE (o UNICO para productos sin talles)
        tipo,                                  // Columna D: TIPO
        cantidadGuardar,                       // Columna E: CANTIDAD (negativo si es egreso)
        datos.observacion || '',               // Columna F: OBSERVACION USUARIO
        paisMovimiento                         // Columna G: PAIS
      ];
      
      // Insertar el movimiento
      sheet.appendRow(nuevaFila);
      
      return { 
        error: false, 
        mensaje: "Movimiento registrado correctamente",
        tipo: tipo,
        cantidad: cantidadGuardar
      };
      
    } catch (e) {
      return { error: true, mensaje: "Error al registrar movimiento: " + e.toString() };
    }
  }

  // --- 12. GESTIÓN DE MARCAS Y MODELOS ---
  
  /**
   * Función para obtener todas las marcas y modelos configurados
   * @returns {Object} - { error, data: { marcas: [], modelos: { marca: [modelos] } } }
   */
  function obtenerMarcasModelos() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName('CONFIG-MARCAS-MODELOS');
      
      if (!sheet) {
        sheet = ss.insertSheet('CONFIG-MARCAS-MODELOS');
        sheet.appendRow(['MARCA', 'TIPO', 'MODELO']);
        sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
        return { error: false, data: { marcas: [], tiposPorMarca: {}, modelosPorMarcaTipo: {}, modelos: {}, modelosConProductosActivos: {} } };
      }
      
      const lr = sheet.getLastRow();
      const datos = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 3).getValues();
      if (datos.length <= 1) {
        return { error: false, data: { marcas: [], tiposPorMarca: {}, modelosPorMarcaTipo: {}, modelos: {}, modelosConProductosActivos: verificarProductosActivosPorModelo() } };
      }

      const modelosConProductosActivos = verificarProductosActivosPorModelo();
      const marcasSet = new Set();
      const tiposPorMarca = {};
      const modelosPorMarcaTipo = {};
      const modelosPorMarca = {};
      const tieneTipo = datos[0].length >= 3 && (datos[0][1] || '').toString().trim().toUpperCase() === 'TIPO';
      
      for (let i = 1; i < datos.length; i++) {
        const marca = (datos[i][0] || '').toString().trim();
        const tipo = tieneTipo ? (datos[i][1] || '').toString().trim() : '';
        const modelo = tieneTipo ? (datos[i][2] || '').toString().trim() : (datos[i][1] || '').toString().trim();
        
        if (marca) {
          marcasSet.add(marca);
          const tipoKey = tipo || 'General';
          if (!tiposPorMarca[marca]) tiposPorMarca[marca] = [];
          if (tipoKey && !tiposPorMarca[marca].includes(tipoKey)) tiposPorMarca[marca].push(tipoKey);
          const clave = marca + '|' + tipoKey;
          if (!modelosPorMarcaTipo[clave]) modelosPorMarcaTipo[clave] = [];
          if (modelo && !modelosPorMarcaTipo[clave].includes(modelo)) modelosPorMarcaTipo[clave].push(modelo);
          if (!modelosPorMarca[marca]) modelosPorMarca[marca] = [];
          if (modelo && !modelosPorMarca[marca].includes(modelo)) modelosPorMarca[marca].push(modelo);
        }
      }
      
      const marcas = Array.from(marcasSet).sort();
      Object.keys(tiposPorMarca).forEach(m => tiposPorMarca[m].sort());
      Object.keys(modelosPorMarcaTipo).forEach(k => modelosPorMarcaTipo[k].sort());
      Object.keys(modelosPorMarca).forEach(m => modelosPorMarca[m].sort());
      
      return { error: false, data: { marcas, tiposPorMarca, modelosPorMarcaTipo, modelos: modelosPorMarca, modelosConProductosActivos } };
      
    } catch (e) {
      return { error: true, mensaje: "Error al obtener marcas y modelos: " + e.toString() };
    }
  }
  
  /**
   * Verifica qué modelos tienen productos activos
   * Retorna un objeto con formato { "MARCA|MODELO": true/false }
   * true = tiene productos activos, false = no tiene productos activos (o todos están inactivos)
   */
  function verificarProductosActivosPorModelo() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetDefiniciones = ss.getSheetByName('STOCK_DEFINICION');
      
      if (!sheetDefiniciones) {
        return {};
      }

      const lr = sheetDefiniciones.getLastRow();
      const datos = (lr < 1) ? [] : sheetDefiniciones.getRange(1, 1, lr, 10).getValues();
      if (datos.length <= 1) {
        return {};
      }

      const modelosConProductosActivos = {};

      // Estructura: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
      // Compatible con estructura antigua (8 cols)
      for (let i = 1; i < datos.length; i++) {
        const fila = datos[i];
        const marca = (fila[1] || '').toString().trim();
        const tipo = fila.length >= 10 ? (fila[2] || '').toString().trim() : '';
        const modelo = fila.length >= 10 ? (fila[3] || '').toString().trim() : (fila[2] || '').toString().trim();
        const activo = (fila.length >= 10 ? fila[7] : fila[6] || '').toString().trim().toUpperCase();
        
        if (marca && modelo) {
          const clave = marca + '|' + (tipo || '') + '|' + modelo;
          // Si el producto está activo (ACTIVO = 'SI'), marcar el modelo como teniendo productos activos
          if (activo === 'SI') {
            modelosConProductosActivos[clave] = true;
          } else {
            // Si no está activo, solo marcar como false si no estaba ya marcado como true
            if (modelosConProductosActivos[clave] !== true) {
              modelosConProductosActivos[clave] = false;
            }
          }
        }
      }
      
      return modelosConProductosActivos;
      
    } catch (e) {
      return {};
    }
  }
  
  /**
   * Función para obtener el historial de movimientos de stock
   * Estructura STOCK_MOVIMIENTOS: A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION USUARIO, G:(vacía), H:PAIS
   * @param {String} pais - País para filtrar (opcional, por defecto ARGENTINA)
   * @returns {Object} - Resultado con lista de movimientos
   */
  function obtenerMovimientosStock(pais) {
    try {
      // Si no se proporciona país, usar ARGENTINA por defecto
      if (!pais || pais.toString().trim() === '') {
        pais = 'ARGENTINA';
      }
      pais = pais.toString().trim().toUpperCase();
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) {
        return { error: true, mensaje: "No se pudo acceder a la planilla" };
      }
      
      // 1. Obtener hoja de movimientos
      const sheetMovimientos = ss.getSheetByName('STOCK_MOVIMIENTOS');
      if (!sheetMovimientos) {
        return { error: true, mensaje: "No existe la hoja 'STOCK_MOVIMIENTOS'" };
      }
      
      // 2. Obtener hoja de definiciones para obtener información del producto
      const sheetDefiniciones = ss.getSheetByName('STOCK_DEFINICION');
      if (!sheetDefiniciones) {
        return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
      }
      
      // 3. Leer datos de definiciones para crear un mapa de productos por ID
      const lrDef = sheetDefiniciones.getLastRow();
      const datosDefiniciones = (lrDef < 1) ? [] : sheetDefiniciones.getRange(1, 1, lrDef, 10).getValues();
      const productosMap = {};

      // Estructura nueva: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
      for (let i = 1; i < datosDefiniciones.length; i++) {
        const fila = datosDefiniciones[i];
        const id = fila[0] ? fila[0].toString().trim() : '';
        if (!id) continue;
        const tieneNueva = fila.length >= 10;
        productosMap[id] = {
          id, marca: (fila[1] || '').toString().trim(),
          tipo: tieneNueva ? (fila[2] || '').toString().trim() : '',
          modelo: tieneNueva ? (fila[3] || '').toString().trim() : (fila[2] || '').toString().trim(),
          color: tieneNueva ? (fila[4] || '').toString().trim() : (fila[3] || '').toString().trim(),
          descripcion: tieneNueva ? (fila[5] || '').toString().trim() : (fila[4] || '').toString().trim(),
          imagenUrl: tieneNueva ? (fila[6] || '').toString().trim() : (fila[5] || '').toString().trim()
        };
      }
      
      // 4. Leer movimientos y filtrar por país
      const lrMov = sheetMovimientos.getLastRow();
      const datosMovimientos = (lrMov < 1) ? [] : sheetMovimientos.getRange(1, 1, lrMov, 8).getValues();
      const movimientos = [];

      // Estructura: A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION USUARIO, G:(vacía), H:PAIS
      for (let i = 1; i < datosMovimientos.length; i++) {
        const fila = datosMovimientos[i];
        
        // Validar que la fila tenga al menos fecha e ID de producto
        if (!fila[0] && !fila[1]) continue; // Saltar filas vacías
        
        // Obtener ID del producto primero (necesario para buscar país del producto si falta)
        const idProducto = fila[1] ? fila[1].toString().trim() : '';
        if (!idProducto) continue; // Saltar si no hay ID de producto
        
        // Obtener país del movimiento (columna H, índice 7)
        let paisMovimiento = '';
        if (fila.length > 7 && fila[7] !== null && fila[7] !== undefined && fila[7] !== '') {
          paisMovimiento = fila[7].toString().trim().toUpperCase();
        }
        
        // Si el movimiento no tiene país, intentar obtenerlo del producto
        if (!paisMovimiento || paisMovimiento === '') {
          if (idProducto) {
            // Buscar el país del producto en STOCK_DEFINICION (columna H, índice 7)
            for (let j = 1; j < datosDefiniciones.length; j++) {
              const filaDef = datosDefiniciones[j];
              const idDef = filaDef[0] ? filaDef[0].toString().trim() : '';
              if (idDef === idProducto && filaDef.length > 7 && filaDef[7] !== null && filaDef[7] !== undefined && filaDef[7] !== '') {
                paisMovimiento = filaDef[7].toString().trim().toUpperCase();
                break;
              }
            }
          }
        }
        
        // Filtrar por país
        if (!paisMovimiento || paisMovimiento === '' || paisMovimiento !== pais) continue;
        
        const producto = productosMap[idProducto] || {};
        
        // Parsear fecha
        let fechaStr = '';
        if (fila[0]) {
          const fecha = fila[0];
          if (Object.prototype.toString.call(fecha) === '[object Date]') {
            fechaStr = ('0' + fecha.getDate()).slice(-2) + '/' + ('0' + (fecha.getMonth() + 1)).slice(-2) + '/' + fecha.getFullYear();
          } else if (typeof fecha === 'string') {
            fechaStr = fecha;
          }
        }
        
        // Convertir fechaOriginal a string si es un objeto Date
        let fechaOriginalStr = '';
        if (fila[0]) {
          if (Object.prototype.toString.call(fila[0]) === '[object Date]') {
            fechaOriginalStr = ('0' + fila[0].getDate()).slice(-2) + '/' + ('0' + (fila[0].getMonth() + 1)).slice(-2) + '/' + fila[0].getFullYear();
          } else {
            fechaOriginalStr = fila[0].toString();
          }
        }
        
        movimientos.push({
          fecha: fechaStr,
          fechaOriginal: fechaOriginalStr,
          idProducto: idProducto,
          marca: producto.marca || 'Sin Marca',
          tipo: producto.tipo || '',
          modelo: producto.modelo || 'Sin Modelo',
          color: producto.color || 'Sin Color',
          talle: (fila[2] ? fila[2].toString().trim() : '') || 'UNICO',
          tipo: fila[3] ? fila[3].toString().trim() : '',
          cantidad: parseFloat(fila[4]) || 0,
          observacion: fila[5] ? fila[5].toString().trim() : '',
          pais: paisMovimiento
        });
      }
      
      // 5. Ordenar por fecha descendente (más recientes primero)
      movimientos.sort((a, b) => {
        try {
          let fechaA = parseFechaStock(a.fecha);
          let fechaB = parseFechaStock(b.fecha);
          // Si fechaB es más reciente que fechaA, retornar positivo (fechaB antes)
          // Si fechaA es más reciente que fechaB, retornar negativo (fechaA antes)
          let diff = fechaB.getTime() - fechaA.getTime();
          return diff;
        } catch (sortError) {
          // Si hay error al ordenar, mantener orden original
          Logger.log('Error al ordenar movimientos: ' + sortError.toString());
          return 0;
        }
      });
      
      // Asegurar que siempre retornemos un objeto válido y serializable
      const resultado = { 
        error: false, 
        data: movimientos || [] 
      };
      
      // Verificar que el resultado sea válido antes de retornarlo
      if (!resultado || typeof resultado !== 'object') {
        Logger.log('Error: resultado no es un objeto válido');
        return { error: true, mensaje: "Error al procesar los movimientos" };
      }
      
      return resultado;
      
    } catch (e) {
      Logger.log('Error en obtenerMovimientosStock: ' + e.toString());
      Logger.log('Stack trace: ' + (e.stack || 'No disponible'));
      // Asegurar que siempre retornemos un objeto válido incluso en caso de error
      const errorResult = { 
        error: true, 
        mensaje: "Error al obtener movimientos: " + (e.toString() || 'Error desconocido') 
      };
      return errorResult;
    }
  }
  
  /**
   * Función auxiliar para parsear fecha en formato DD/MM/YYYY
   */
  function parseFechaStock(fechaStr) {
    if (!fechaStr) return new Date(0);
    if (typeof fechaStr === 'string') {
      const partes = fechaStr.split('/');
      if (partes.length === 3) {
        return new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
      }
    }
    return new Date(fechaStr);
  }

  /**
   * Función para guardar una marca, tipo y modelo
   * @param {Object} datos - { marca, tipo, modelo }
   * @returns {Object} - Resultado de la operación
   */
  function guardarMarcaModelo(datos) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName('CONFIG-MARCAS-MODELOS');
      
      if (!sheet) {
        sheet = ss.insertSheet('CONFIG-MARCAS-MODELOS');
        sheet.appendRow(['MARCA', 'TIPO', 'MODELO']);
        sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
      }
      
      const marca = (datos.marca || '').toString().trim();
      const tipo = (datos.tipo || 'General').toString().trim() || 'General';
      const modelo = (datos.modelo || '').toString().trim();
      
      if (!marca) return { error: true, mensaje: "La marca es requerida" };
      if (!modelo) return { error: true, mensaje: "El modelo es requerido" };

      const lr = sheet.getLastRow();
      const datosExistentes = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 3).getValues();
      const tieneTipo = datosExistentes[0] && datosExistentes[0].length >= 3 && (datosExistentes[0][1] || '').toString().trim().toUpperCase() === 'TIPO';

      for (let i = 1; i < datosExistentes.length; i++) {
        const m = (datosExistentes[i][0] || '').toString().trim();
        const t = tieneTipo ? (datosExistentes[i][1] || 'General').toString().trim() : 'General';
        const mod = tieneTipo ? (datosExistentes[i][2] || '').toString().trim() : (datosExistentes[i][1] || '').toString().trim();
        if (m === marca && t === tipo && mod === modelo) {
          return { error: true, mensaje: "Esta combinación de marca, tipo y modelo ya existe" };
        }
      }
      
      if (!tieneTipo && datosExistentes[0] && datosExistentes[0].length < 3) {
        sheet.insertColumnAfter(1);
        sheet.getRange(1, 2).setValue('TIPO');
        for (let r = 2; r <= sheet.getLastRow(); r++) {
          sheet.getRange(r, 2).setValue('General');
        }
      }
      sheet.appendRow([marca, tipo || 'General', modelo]);
      
      return { error: false, mensaje: "Marca y modelo guardados correctamente" };
      
    } catch (e) {
      return { error: true, mensaje: "Error al guardar marca y modelo: " + e.toString() };
    }
  }
  
  /**
   * Función para eliminar una marca, tipo y modelo
   * @param {Object} datos - { marca, tipo, modelo }
   * @returns {Object} - Resultado de la operación
   */
  function eliminarMarcaModelo(datos) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('CONFIG-MARCAS-MODELOS');
      
      if (!sheet) {
        return { error: true, mensaje: "No existe la hoja de configuración" };
      }
      
      const marca = (datos.marca || '').toString().trim();
      const tipo = (datos.tipo || 'General').toString().trim() || 'General';
      const modelo = (datos.modelo || '').toString().trim();
      
      const tieneProductosActivos = verificarProductosActivosPorModelo();
      const clave = marca + '|' + tipo + '|' + modelo;
      if (tieneProductosActivos[clave] === true) {
        return { error: true, mensaje: "No se puede eliminar porque tiene productos activos. Desactive los productos primero." };
      }

      const lr = sheet.getLastRow();
      const datosExistentes = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 3).getValues();
      const tieneTipo = datosExistentes[0] && datosExistentes[0].length >= 3;
      for (let i = datosExistentes.length - 1; i >= 1; i--) {
        const m = (datosExistentes[i][0] || '').toString().trim();
        const t = tieneTipo ? (datosExistentes[i][1] || 'General').toString().trim() : 'General';
        const mod = tieneTipo ? (datosExistentes[i][2] || '').toString().trim() : (datosExistentes[i][1] || '').toString().trim();
        if (m === marca && t === tipo && mod === modelo) {
          sheet.deleteRow(i + 1);
          return { error: false, mensaje: "Marca, tipo y modelo eliminados correctamente" };
        }
      }
      return { error: true, mensaje: "No se encontró la combinación" };
      
    } catch (e) {
      return { error: true, mensaje: "Error al eliminar marca y modelo: " + e.toString() };
    }
  }

  /**
   * Función para actualizar el estado (activo/inactivo) de un producto
   * @param {Object} datos - { id, activo }
   * @returns {Object} - Resultado de la operación
   */
  function actualizarEstadoProducto(datos) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('STOCK_DEFINICION');
      
      if (!sheet) {
        return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
      }
      
      if (!datos.id) {
        return { error: true, mensaje: "El ID del producto es requerido" };
      }
      
      const nuevoEstado = (datos.activo && datos.activo.toString().toUpperCase() === 'NO') ? 'NO' : 'SI';

      // Buscar el producto por ID
      const lr = sheet.getLastRow();
      const datosExistentes = (lr < 1) ? [] : sheet.getRange(1, 1, lr, 10).getValues();
      let productoEncontrado = false;

      for (let i = 1; i < datosExistentes.length; i++) {
        const idExistente = datosExistentes[i][0] ? datosExistentes[i][0].toString().trim() : '';
        if (idExistente === datos.id.toString().trim()) {
          // Actualizar la columna ACTIVO (columna G, índice 6)
          // Si la estructura tiene MARCA, ACTIVO está en la columna G (índice 6)
          // Si no tiene MARCA, ACTIVO está en la columna F (índice 5)
          const tieneMarca = datosExistentes[i].length >= 7;
          const columnaActivo = tieneMarca ? 6 : 5; // Columna G o F
          
          sheet.getRange(i + 1, columnaActivo + 1).setValue(nuevoEstado);
          productoEncontrado = true;
          break;
        }
      }
      
      if (!productoEncontrado) {
        return { error: true, mensaje: "No se encontró el producto con ID " + datos.id };
      }
      
      return { 
        error: false, 
        mensaje: "Estado del producto actualizado correctamente",
        activo: nuevoEstado
      };
      
    } catch (e) {
      return { error: true, mensaje: "Error al actualizar estado: " + e.toString() };
    }
  }