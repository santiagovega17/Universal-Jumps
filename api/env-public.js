module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) {
    return res.status(500).json({ error: true, mensaje: 'Configuracion de auth incompleta' });
  }
  return res.status(200).json({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey });
};
