const {
  getCotizacionesBackend,
  getConfiguracionCaja,
  getConceptosPorPais,
  getDescripcionesPorPaisConcepto,
  getMediosPorPais,
} = require('../lib/configService');

module.exports = async (req, res) => {
  if ((req.method || '').toUpperCase() !== 'GET') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  const action = (req.query.action || '').toString().trim();

  try {
    if (action === 'cotizaciones') {
      const data = await getCotizacionesBackend();
      return res.status(200).json({ error: false, data });
    }

    if (action === 'caja') {
      const data = await getConfiguracionCaja();
      return res.status(200).json({ error: false, data });
    }

    if (action === 'conceptos') {
      const data = await getConceptosPorPais(req.query.pais || 'ARGENTINA');
      return res.status(200).json({ error: false, data });
    }

    if (action === 'descripciones') {
      const data = await getDescripcionesPorPaisConcepto(req.query.pais || 'ARGENTINA', req.query.concepto || '');
      return res.status(200).json({ error: false, data });
    }

    if (action === 'medios') {
      const data = await getMediosPorPais(req.query.pais || 'ARGENTINA');
      return res.status(200).json({ error: false, data });
    }

    return res.status(400).json({ error: true, mensaje: 'action no soportado' });
  } catch (e) {
    return res.status(500).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
