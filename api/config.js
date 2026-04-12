const {
  getCotizacionesBackend,
  getMonedasPaisBackend,
  getConfiguracionCaja,
  getConceptosPorPais,
  getDescripcionesPorPaisConcepto,
  getMediosPorPais,
  guardarItemConfigService,
  borrarItemConfigService,
  actualizarCotizacionesDesdeExternas,
} = require('../lib/configService');

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
  const method = (req.method || '').toUpperCase();

  const action = (req.query.action || '').toString().trim();

  try {
    if (method === 'GET') {
      if (action === 'cotizaciones') {
        const data = await getCotizacionesBackend();
        return res.status(200).json({ error: false, data });
      }

      if (action === 'caja') {
        const data = await getConfiguracionCaja();
        return res.status(200).json({ error: false, data });
      }

      if (action === 'monedas-pais') {
        const data = await getMonedasPaisBackend();
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
    }

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      const body = getBody(req);
      if (action === 'guardar-item') {
        const result = await guardarItemConfigService(body.tipo, body.nombre, body.padre, body.pais, body.sentido);
        return res.status(200).json(result);
      }
      if (action === 'borrar-item') {
        const result = await borrarItemConfigService(body.tipo, body.nombre, body.pais, body.padre);
        return res.status(200).json(result);
      }
      if (action === 'actualizar-cotizaciones') {
        const result = await actualizarCotizacionesDesdeExternas();
        return res.status(200).json(result);
      }
      return res.status(400).json({ error: true, mensaje: 'action no soportado en escritura' });
    }

    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  } catch (e) {
    const status = method === 'GET' ? 500 : 400;
    return res.status(status).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
