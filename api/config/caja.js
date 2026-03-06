const { getConfiguracionCaja } = require('../../lib/configService');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  try {
    const data = await getConfiguracionCaja();
    return res.status(200).json({ error: false, data });
  } catch (e) {
    return res.status(500).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
