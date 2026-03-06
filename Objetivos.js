// --- 8. OBJETIVOS ---
function obtenerObjetivosBackend(trimestre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
  if (!sheet) {
    sheet = ss.insertSheet('CONFIG-OBJETIVOS');
    sheet.appendRow(['TRIMESTRE', 'TRIMESTRE_NUMERO', 'IDENTIFICADOR', 'PORCENTAJE_BOTAS', 'PORCENTAJE_CERTS', 'UNIDADES_BOTAS', 'UNIDADES_CERTS', 'FACTURACION_BOTAS', 'FACTURACION_CERTS']);
  }
  const datos = sheet.getDataRange().getValues();
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

function obtenerObjetivosEspecialesVendedor(vendedor, trimestre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
  if (!sheet) return { error: false, data: null };

  const datos = sheet.getDataRange().getValues();

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

function obtenerTodosLosObjetivos() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'todos_objetivos';
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
  if (!sheet) return { error: false, data: [] };

  const datos = sheet.getDataRange().getValues();
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

  try {
    cache.put(cacheKey, JSON.stringify(resultado), 600);
  } catch (e) {}

  return resultado;
}

function guardarObjetivosBackend(trimestre, listaObjetivos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
  if (!sheet) {
    sheet = ss.insertSheet('CONFIG-OBJETIVOS');
    sheet.appendRow(['TRIMESTRE', 'TRIMESTRE_NUMERO', 'IDENTIFICADOR', 'PORCENTAJE_BOTAS', 'PORCENTAJE_CERTS', 'UNIDADES_BOTAS', 'UNIDADES_CERTS', 'FACTURACION_BOTAS', 'FACTURACION_CERTS']);
  }
  const datos = sheet.getDataRange().getValues();
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

function guardarObjetivoEspecial(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('CONFIG-OBJETIVOS');
  if (!sheet) {
    sheet = ss.insertSheet('CONFIG-OBJETIVOS');
    sheet.appendRow(['TRIMESTRE', 'TRIMESTRE_NUMERO', 'IDENTIFICADOR', 'PORCENTAJE_BOTAS', 'PORCENTAJE_CERTS', 'UNIDADES_BOTAS', 'UNIDADES_CERTS', 'FACTURACION_BOTAS', 'FACTURACION_CERTS']);
  }

  const datosSheet = sheet.getDataRange().getValues();
  for (let i = datosSheet.length - 1; i >= 1; i--) {
    if (datosSheet[i][0] === datos.trimestre && datosSheet[i][2] && datosSheet[i][2].toString().toUpperCase() === datos.vendedor.toString().toUpperCase()) {
      sheet.deleteRow(i + 1);
    }
  }

  let trimestreNum = parseInt(datos.trimestre.toString().match(/\d/)[0]) || 1;
  sheet.appendRow([
    datos.trimestre,
    trimestreNum,
    datos.vendedor,
    parseFloat(datos.pctBotas || 0),
    parseFloat(datos.pctCerts || 0),
    parseInt(datos.botas || 0),
    parseInt(datos.certs || 0),
    parseFloat(datos.factBotas || 0),
    parseFloat(datos.factCerts || 0)
  ]);

  return { error: false, mensaje: "Objetivo especial guardado con éxito." };
}
