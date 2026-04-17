const { createClient } = require('@supabase/supabase-js');
const { getPerfilByEmail } = require('../../lib/usuarioService');

function getBearerToken(req) {
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || typeof auth !== 'string') return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: true,
        authError: true,
        mensaje: 'Debes iniciar sesión con Google.',
        emailDetectado: '',
      });
    }

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return res.status(500).json({
        error: true,
        authError: true,
        mensaje: 'Configuración de autenticación incompleta. Verificá SUPABASE_URL y SUPABASE_ANON_KEY en Vercel.',
        emailDetectado: '',
      });
    }

    const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user || !user.email) {
      return res.status(401).json({
        error: true,
        authError: true,
        mensaje: 'Sesión inválida o expirada.',
        emailDetectado: user && user.email ? user.email : '',
      });
    }

    const perfil = await getPerfilByEmail(user.email);
    if (!perfil) {
      return res.status(200).json({
        error: true,
        authError: true,
        mensaje: 'Tu usuario no tiene permisos.',
        emailDetectado: user.email,
      });
    }

    return res.status(200).json(perfil);
  } catch (e) {
    return res.status(500).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
