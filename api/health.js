const { getSupabaseAdmin } = require('../lib/supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('usuario').select('id', { count: 'exact', head: true });

    if (error) {
      return res.status(500).json({
        ok: false,
        provider: 'supabase',
        error: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: 'supabase',
      env: process.env.VERCEL_ENV || 'local',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || 'Error inesperado',
    });
  }
};
