const { updateEstadoMovimientoCaja } = require('../../lib/cajaService');

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
    const body = getBody(req);
    const id = body.id || body.filaIndex;
    const nuevoEstado = body.nuevoEstado || body.estado;
    if (!id || !nuevoEstado) {
      return res.status(400).json({ error: true, mensaje: 'id y nuevoEstado son requeridos' });
    }
    await updateEstadoMovimientoCaja(id, nuevoEstado);
    return res.status(200).json({ error: false });
  } catch (e) {
    return res.status(400).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
