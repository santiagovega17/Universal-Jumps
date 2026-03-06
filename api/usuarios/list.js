const { getSupabaseAdmin } = require('../../lib/supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  const limit = Number(req.query.limit || 50);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 50;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('usuario')
      .select('id, email, rol, nombre, activo, tipo_objetivo, created_at')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      return res.status(500).json({ error: true, mensaje: error.message });
    }

    return res.status(200).json({
      error: false,
      total: data.length,
      data,
    });
  } catch (e) {
    return res.status(500).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
