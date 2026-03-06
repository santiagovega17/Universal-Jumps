const { getHistorialCaja, normalizePais } = require('../../lib/cajaService');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  try {
    const pais = normalizePais(req.query.pais || 'ARGENTINA');
    const mes = Number(req.query.mes || 0);
    const anio = Number(req.query.anio || 2026);

    const data = await getHistorialCaja({
      pais,
      mes: Number.isFinite(mes) ? mes : 0,
      anio: Number.isFinite(anio) ? anio : 2026,
    });

    return res.status(200).json({ error: false, data });
  } catch (e) {
    return res.status(500).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
