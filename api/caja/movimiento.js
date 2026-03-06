const { saveMovimientoCaja } = require('../../lib/cajaService');

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
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  try {
    const payload = getBody(req);
    const result = await saveMovimientoCaja(payload);
    return res.status(200).json({ error: false, mensaje: result.mensaje });
  } catch (e) {
    return res.status(400).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
