const { actualizarCotizacionesDesdeExternas } = require('../../lib/configService');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: true, mensaje: 'Método no permitido' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (token !== cronSecret) {
      return res.status(401).json({ error: true, mensaje: 'No autorizado' });
    }
  }

  try {
    const result = await actualizarCotizacionesDesdeExternas();
    return res.status(200).json(result);
  } catch (e) {
    console.error('actualizar-cotizaciones:', e);
    return res.status(500).json({ error: true, mensaje: e.message || 'Error al actualizar cotizaciones' });
  }
};
