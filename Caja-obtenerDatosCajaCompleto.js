/**
 * Añadir esta función al backend (Caja.js o Código.gs) para que el frontend
 * pueda cargar balance + medios de pago + historial en una sola llamada.
 * Reduce latencia y evita múltiples "despertadas" del script.
 *
 * Opcional: limita el historial a 500 movimientos (cambiar LIMITE_HISTORIAL).
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
