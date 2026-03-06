// --- 10. CLIENTES ---
function obtenerClientesVendedor(vendedor, pais) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CLIENTES');
  if (!sheet) return { error: false, data: [] };

  const datos = sheet.getDataRange().getValues();
  let clientes = [];

  let paisNormalizado = null;
  if (pais && pais.toString().trim() !== '') {
    paisNormalizado = pais.toString().trim().toUpperCase();
    if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
    if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';
  }

  for (let i = 1; i < datos.length; i++) {
    let paisCliente = (datos[i][8] || '').toString().trim().toUpperCase();
    if (paisCliente === 'USA') paisCliente = 'EEUU';
    if (paisCliente === 'ESPAÑA') paisCliente = 'ESPANA';

    if (paisNormalizado && paisCliente !== paisNormalizado) continue;

    clientes.push({
      id: datos[i][0] || '',
      nombre: datos[i][1] || '',
      apellido: datos[i][2] || '',
      dni: datos[i][3] || '',
      telefono: datos[i][4] || '',
      correo: datos[i][5] || '',
      domicilio: datos[i][6] || '',
      provincia: datos[i][7] || '',
      pais: datos[i][8] || ''
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
    const filas = sheet.getDataRange().getValues();
    for (let i = filas.length - 1; i >= 1; i--) {
      if ((filas[i][1] || '').toString().trim() === datos.nombreOriginal.toString().trim() &&
          (filas[i][2] || '').toString().trim() === datos.apellidoOriginal.toString().trim()) {
        let idExistente = filas[i][0] || '';
        sheet.getRange(i + 1, 1, 1, 9).setValues([[
          idExistente,
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
    const filas = sheet.getDataRange().getValues();
    let nuevoId = 1;

    if (filas.length > 1) {
      let maxId = 0;
      for (let i = 1; i < filas.length; i++) {
        let idActual = filas[i][0];
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
      nuevoId,
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

function borrarClientePorDatos(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTES');
    if (!sheet) return { error: true, mensaje: "Falta hoja CLIENTES" };

    const filas = sheet.getDataRange().getValues();
    for (let i = filas.length - 1; i >= 1; i--) {
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
