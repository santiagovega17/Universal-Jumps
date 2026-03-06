/**
 * Ventas: guardar/editar venta, checkbox y borrado de ventas.
 */
function guardarVenta(datos) { return procesarVenta(datos, false); }
function editarVenta(datos) { return procesarVenta(datos, true); }

function procesarVenta(datos, esEdicion) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(datos.vendedor);
  if (!sheet) {
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

  let divisor = 1.21;
  let pais = datos.pais ? datos.pais.toString().toUpperCase() : "";
  if (pais === "URUGUAY") divisor = 1.22;
  else if (["CHILE", "BRASIL"].includes(pais)) divisor = 1.19;
  else if (pais === "MEXICO") divisor = 1.16;
  else if (pais === "EEUU") divisor = 1.07;
  else if (pais === "RDM") divisor = 1.00;
  else if (pais === "ESPAÑA") divisor = 1.21;

  let cantidad = parseFloat(datos.cantidad) || 0;
  let precio = parseFloat(datos.precio) || 0;
  let cotizacion = parseFloat(datos.cotizacion) || 1;

  let total = cantidad * precio;
  let totalSinIva = total / divisor;

  let f = new Date(datos.fecha);
  let fechaStr = ('0' + f.getUTCDate()).slice(-2) + '/' + ('0' + (f.getUTCMonth() + 1)).slice(-2) + '/' + f.getUTCFullYear();

  let nuevaFila = [
    fechaStr, datos.estado, "NO", datos.pais, datos.cliente, datos.concepto, datos.formaPago,
    cantidad, precio, total, totalSinIva, datos.comentario, cotizacion
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

    try {
      const sheetCaja = ss.getSheetByName('CAJA');
      if (sheetCaja) {
        let paisCaja = pais.toUpperCase();
        if (paisCaja === 'ESPAÑA') paisCaja = 'ESPANA';
        if (paisCaja === 'USA') paisCaja = 'EEUU';
        let filaCaja = [
          fechaStr, 'INGRESO', datos.concepto, datos.concepto, datos.formaPago, total,
          datos.comentario || '', 'PAGADO', '', paisCaja
        ];
        sheetCaja.appendRow(filaCaja);
      }
    } catch (e) {
      Logger.log('Error al agregar venta a CAJA: ' + e.toString());
    }

    return { error: false, mensaje: "Venta registrada con éxito." };
  }
}

function actualizarCheck(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(d.vendedor);
  if (!sheet) {
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

  let filaIndex = parseInt(d.filaIndex);
  let datosVenta = sheet.getRange(filaIndex, 1, 1, 13).getValues()[0];

  let fechaVenta = datosVenta[0];
  let paisVenta = datosVenta[3] || '';
  let conceptoVenta = datosVenta[5] || '';
  let formaPagoVenta = datosVenta[6] || '';
  let totalConIvaVenta = datosVenta[9] || 0;
  let comentarioVenta = datosVenta[11] || '';

  let fechaStr = '';
  if (Object.prototype.toString.call(fechaVenta) === '[object Date]') {
    fechaStr = ('0' + fechaVenta.getDate()).slice(-2) + '/' + ('0' + (fechaVenta.getMonth() + 1)).slice(-2) + '/' + fechaVenta.getFullYear();
  } else if (typeof fechaVenta === 'string') {
    fechaStr = fechaVenta;
  }

  let paisNormalizado = paisVenta.toString().toUpperCase().trim();
  if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';
  if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';

  sheet.deleteRow(filaIndex);

  try {
    const sheetCaja = ss.getSheetByName('CAJA');
    if (sheetCaja) {
      let datosCaja = sheetCaja.getDataRange().getValues();
      for (let i = datosCaja.length - 1; i >= 1; i--) {
        let filaCaja = datosCaja[i];
        let fechaCaja = filaCaja[0];
        let tipoCaja = filaCaja[1];
        let conceptoCaja = filaCaja[2];
        let formaPagoCaja = filaCaja[4];
        let montoCaja = parseFloat(filaCaja[5]) || 0;
        let paisCaja = filaCaja[9] || '';

        let fechaCajaStr = '';
        if (Object.prototype.toString.call(fechaCaja) === '[object Date]') {
          fechaCajaStr = ('0' + fechaCaja.getDate()).slice(-2) + '/' + ('0' + (fechaCaja.getMonth() + 1)).slice(-2) + '/' + fechaCaja.getFullYear();
        } else if (typeof fechaCaja === 'string') {
          fechaCajaStr = fechaCaja;
        }

        let paisCajaNormalizado = paisCaja.toString().toUpperCase().trim();
        if (paisCajaNormalizado === 'ESPAÑA') paisCajaNormalizado = 'ESPANA';
        if (paisCajaNormalizado === 'USA') paisCajaNormalizado = 'EEUU';

        let montoVenta = parseFloat(totalConIvaVenta) || 0;
        let diferenciaMonto = Math.abs(montoCaja - montoVenta);

        if (tipoCaja === 'INGRESO' &&
            fechaCajaStr === fechaStr &&
            conceptoCaja.toString().trim() === conceptoVenta.toString().trim() &&
            formaPagoCaja.toString().trim() === formaPagoVenta.toString().trim() &&
            diferenciaMonto < 0.01 &&
            paisCajaNormalizado === paisNormalizado) {
          sheetCaja.deleteRow(i + 1);
          break;
        }
      }
    }
  } catch (e) {
    Logger.log('Error al borrar movimiento en CAJA: ' + e.toString());
  }

  return { error: false };
}
