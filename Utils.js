/**
 * Utilidades compartidas: parseo de fechas y conversiones.
 * Usado por Caja, Consolidado, Stock, etc.
 */
function parseFecha(fechaStr) {
  if (!fechaStr) return new Date(0);
  if (typeof fechaStr === 'string') {
    let parts = fechaStr.split('/');
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(fechaStr);
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

function ddmmyyyyToYYYYMMDD(fechaStr) {
  if (!fechaStr) return '';
  if (typeof fechaStr === 'string') {
    let parts = fechaStr.split('/');
    if (parts.length === 3) return parts[2] + '-' + parts[1] + '-' + parts[0];
  }
  return '';
}
