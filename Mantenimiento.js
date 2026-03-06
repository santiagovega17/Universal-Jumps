// --- MANTENIMIENTO ---
function agregarColumnasFaltantes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vendedores = ['ADRIAN', 'NATALIA', 'MARIA LAURA', 'HERNAN', 'NESTOR', 'MARISOL', 'UNIVERSAL JUMPS'];

  vendedores.forEach(v => {
    let sheet = ss.getSheetByName(v);
    if (sheet) {
      let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      if (headers.length < 13 || headers[12] !== "COTIZACION") {
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
