/**
 * Punto de entrada de la aplicación y lectura general de hojas.
 */
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

function obtenerDatosDeHoja(nombreHoja) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(nombreHoja);
    if (!sheet) return { error: true, mensaje: `La hoja "${nombreHoja}" no existe.` };

    const anioFiltro = 2026;
    const datos = sheet.getDataRange().getDisplayValues();
    const datosFiltrados = [datos[0]];

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

      if (anioFila === anioFiltro) {
        datosFiltrados.push(fila);
      }
    }

    return { error: false, data: datosFiltrados };
  } catch (e) {
    return { error: true, mensaje: e.toString() };
  }
}
