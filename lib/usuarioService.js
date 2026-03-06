const { getSupabaseAdmin } = require('./supabaseAdmin');

async function getListaVendedores() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('usuario')
    .select('id, email, rol, nombre, activo, tipo_objetivo')
    .eq('rol', 'VENDEDOR');
  if (error) throw new Error(error.message);

  const activos = [];
  const inactivos = [];
  (data || []).forEach((u) => {
    const item = {
      id: u.id,
      nombre: u.nombre || '',
      email: u.email || '',
      rol: u.rol || 'VENDEDOR',
      activo: (u.activo || 'SI').toString().toUpperCase() === 'SI',
      tipoObjetivo: (u.tipo_objetivo || '').toString().toUpperCase(),
    };
    if (item.activo) activos.push(item);
    else inactivos.push(item);
  });

  return { activos, inactivos };
}

async function getPerfilDemo() {
  return {
    email: 'admin@local.dev',
    rol: 'ADMIN',
    hoja: 'TODAS',
    acceso: true,
    activo: 'SI',
    tipoObjetivo: '',
    modoDemo: true,
  };
}

module.exports = {
  getListaVendedores,
  getPerfilDemo,
};
