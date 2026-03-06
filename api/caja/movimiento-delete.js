const { deleteMovimientoCaja } = require('../../lib/cajaService');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  try {
    const id = req.query.id || req.query.filaIndex || (req.body && (req.body.id || req.body.filaIndex));
    if (!id) return res.status(400).json({ error: true, mensaje: 'id es requerido' });
    await deleteMovimientoCaja(id);
    return res.status(200).json({ error: false });
  } catch (e) {
    return res.status(400).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
