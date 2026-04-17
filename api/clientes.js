const {
  getClientesVendedorService,
  guardarClienteService,
  borrarClientePorDatosService,
} = require('../lib/clienteService');

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
      if (action === 'list') {
        const vendedor = req.query.vendedor || 'TODOS';
        const pais = req.query.pais || '';
        const result = await getClientesVendedorService(vendedor, pais);
        return res.status(200).json(result);
      }
      return res.status(400).json({ error: true, mensaje: 'action no soportado en GET' });
    }

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      const body = getBody(req);

      if (action === 'guardar') {
        const result = await guardarClienteService(body);
        return res.status(200).json(result);
      }

      if (action === 'borrar-por-datos') {
        const result = await borrarClientePorDatosService(body);
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
