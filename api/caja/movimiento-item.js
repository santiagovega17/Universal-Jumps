const { getMovimientoCajaById } = require('../../lib/cajaService');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  try {
    const id = req.query.id || req.query.filaIndex;
    if (!id) return res.status(400).json({ error: true, mensaje: 'id es requerido' });
    const data = await getMovimientoCajaById(id);
    return res.status(200).json({ error: false, data });
  } catch (e) {
    return res.status(404).json({ error: true, mensaje: e.message || 'Movimiento no encontrado' });
  }
};
