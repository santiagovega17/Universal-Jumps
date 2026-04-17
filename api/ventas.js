const {
  obtenerDatosDeHojaVentas,
  obtenerDashboardHomeService,
  guardarVentaService,
  editarVentaService,
  actualizarCheckService,
  borrarVentaService,
  confirmarVentaConStockService,
} = require('../lib/ventasService');

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
      if (action === 'datos-hoja') {
        const nombreHoja = req.query.nombreHoja || req.query.vendedor || '';
        if (!nombreHoja) return res.status(400).json({ error: true, mensaje: 'nombreHoja es requerido' });
        const result = await obtenerDatosDeHojaVentas(nombreHoja);
        return res.status(200).json(result);
      }
      if (action === 'dashboard-home') {
        const mes = req.query.mes;
        const anio = req.query.anio;
        const vendedor = (req.query.vendedor || '').toString().trim();
        const result = await obtenerDashboardHomeService({ mes, anio, vendedor });
        return res.status(200).json(result);
      }
      return res.status(400).json({ error: true, mensaje: 'action no soportado en GET' });
    }

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      const body = getBody(req);

      if (action === 'guardar') {
        const result = await guardarVentaService(body);
        return res.status(200).json(result);
      }
      if (action === 'confirmar-con-stock') {
        const result = await confirmarVentaConStockService(body);
        return res.status(200).json(result);
      }
      if (action === 'editar') {
        const result = await editarVentaService(body);
        return res.status(200).json(result);
      }
      if (action === 'check') {
        const result = await actualizarCheckService(body);
        return res.status(200).json(result);
      }
      if (action === 'borrar') {
        const result = await borrarVentaService(body);
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
