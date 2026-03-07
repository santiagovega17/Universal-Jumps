const {
  obtenerStockBotas,
  obtenerMovimientosStock,
  obtenerMarcasModelos,
  crearProductoBota,
  registrarMovimientoStock,
  guardarMarcaModelo,
  eliminarMarcaModelo,
  actualizarEstadoProducto,
} = require('../lib/stockService');

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return req.body;
}

module.exports = async (req, res) => {
  const action = (req.query.action || '').toString().trim();
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      if (action === 'stock-botas') {
        const pais = req.query.pais || 'ARGENTINA';
        const result = await obtenerStockBotas(pais);
        return res.status(200).json({ error: false, ...result });
      }
      if (action === 'movimientos') {
        const pais = req.query.pais || 'ARGENTINA';
        const result = await obtenerMovimientosStock(pais);
        return res.status(200).json({ error: false, ...result });
      }
      if (action === 'marcas-modelos') {
        const result = await obtenerMarcasModelos();
        return res.status(200).json({ error: false, ...result });
      }
      return res.status(400).json({ error: true, mensaje: 'action no soportado en GET' });
    }

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      const body = getBody(req);

      if (action === 'crear-producto') {
        const result = await crearProductoBota(body);
        return res.status(200).json({ error: false, ...result });
      }
      if (action === 'registrar-movimiento') {
        const result = await registrarMovimientoStock(body);
        return res.status(200).json({ error: false, ...result });
      }
      if (action === 'guardar-marca-modelo') {
        const result = await guardarMarcaModelo(body);
        return res.status(200).json({ error: false, ...result });
      }
      if (action === 'eliminar-marca-modelo') {
        const result = await eliminarMarcaModelo(body);
        return res.status(200).json({ error: false, ...result });
      }
      if (action === 'actualizar-estado-producto') {
        const result = await actualizarEstadoProducto(body);
        return res.status(200).json({ error: false, ...result });
      }

      return res.status(400).json({ error: true, mensaje: 'action no soportado' });
    }

    return res.status(405).json({ error: true, mensaje: 'Método no permitido' });
  } catch (e) {
    const status = method === 'GET' ? 500 : 400;
    return res.status(status).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
