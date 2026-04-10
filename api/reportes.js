const {
  obtenerObjetivosBackendService,
  obtenerTodosLosObjetivosService,
  guardarObjetivosBackendService,
  guardarObjetivoEspecialService,
  obtenerReporteConsolidadoService,
  obtenerTodasLasComisionesService,
} = require('../lib/reportesService');

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
      if (action === 'objetivos-backend') {
        const anio = req.query.anio;
        const mes = req.query.mes;
        const vendedor = req.query.vendedor || '';
        if (anio === undefined || anio === null || anio === '') {
          return res.status(400).json({ error: true, mensaje: 'anio es requerido' });
        }
        if (mes === undefined || mes === null || mes === '') {
          return res.status(400).json({ error: true, mensaje: 'mes es requerido' });
        }
        const result = await obtenerObjetivosBackendService(anio, mes, vendedor);
        return res.status(200).json(result);
      }

      if (action === 'todos-objetivos') {
        const result = await obtenerTodosLosObjetivosService();
        return res.status(200).json(result);
      }

      if (action === 'consolidado') {
        const anio = req.query.anio;
        const result = await obtenerReporteConsolidadoService(anio);
        return res.status(200).json(result);
      }

      if (action === 'comisiones') {
        const result = await obtenerTodasLasComisionesService();
        return res.status(200).json(result);
      }

      return res.status(400).json({ error: true, mensaje: 'action no soportado en GET' });
    }

    if (method === 'POST' || method === 'PUT') {
      const body = getBody(req);

      if (action === 'guardar-objetivos') {
        const result = await guardarObjetivosBackendService(body.anio, body.mes, body.filas, body.vendedor || '');
        return res.status(200).json(result);
      }

      if (action === 'guardar-objetivo-especial') {
        const result = await guardarObjetivoEspecialService(body);
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
