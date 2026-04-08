const {
  listFormasPagoVentaService,
  crearFormaPagoVentaService,
  borrarFormaPagoVentaService,
} = require('../lib/formaPagoVentaService');

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
  const method = (req.method || 'GET').toUpperCase();
  const action = (req.query.action || '').toString().trim();

  try {
    if (method === 'GET') {
      if (action === 'list') {
        const data = await listFormasPagoVentaService();
        return res.status(200).json({ error: false, data });
      }
      return res.status(400).json({ error: true, mensaje: 'action no soportado en GET' });
    }

    if (method === 'POST') {
      const body = getBody(req);
      if (action === 'crear') {
        const result = await crearFormaPagoVentaService(body.nombre);
        return res.status(200).json(result);
      }
      if (action === 'borrar') {
        const result = await borrarFormaPagoVentaService(body.id);
        return res.status(200).json(result);
      }
      return res.status(400).json({ error: true, mensaje: 'action no soportado' });
    }

    return res.status(405).json({ error: true, mensaje: 'Método no permitido' });
  } catch (e) {
    const status = method === 'GET' ? 500 : 400;
    return res.status(status).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
