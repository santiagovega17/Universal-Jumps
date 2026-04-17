const {
  getListaVendedores,
  getTodosUsuarios,
  actualizarEstadoUsuarioService,
  crearNuevoUsuarioService,
  actualizarUsuarioService,
} = require('../lib/usuarioService');
const { getSupabaseAdmin } = require('../lib/supabaseAdmin');

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
      if (action === 'vendedores') {
        const data = await getListaVendedores();
        return res.status(200).json({ error: false, ...data });
      }

      if (action === 'todos') {
        const data = await getTodosUsuarios();
        return res.status(200).json({ error: false, ...data });
      }

      if (action === 'list') {
        const limit = Number(req.query.limit || 50);
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 50;
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from('usuario')
          .select('id, email, rol, nombre, activo, tipo_objetivo, created_at')
          .order('created_at', { ascending: false })
          .limit(safeLimit);

        if (error) return res.status(500).json({ error: true, mensaje: error.message });
        return res.status(200).json({ error: false, total: data.length, data });
      }

      return res.status(400).json({ error: true, mensaje: 'action no soportado' });
    }

    if (method === 'POST' || method === 'PUT') {
      const body = getBody(req);

      if (action === 'estado') {
        const result = await actualizarEstadoUsuarioService(body.email, body.activo);
        return res.status(200).json(result);
      }

      if (action === 'crear') {
        const result = await crearNuevoUsuarioService(body);
        return res.status(200).json(result);
      }

      if (action === 'actualizar') {
        const result = await actualizarUsuarioService(body);
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
