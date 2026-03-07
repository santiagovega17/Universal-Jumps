const { getSupabaseAdmin } = require('./supabaseAdmin');

function normalizeText(value) {
  return (value || '').toString().trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function toActivoFlag(value) {
  return normalizeUpper(value) === 'NO' ? 'NO' : 'SI';
}

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

async function getTodosUsuarios() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('usuario')
    .select('id, email, rol, nombre, activo, tipo_objetivo, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const usuarios = (data || []).map((u) => ({
    id: u.id,
    email: u.email || '',
    rol: normalizeUpper(u.rol || 'VENDEDOR'),
    nombre: u.nombre || '',
    activo: toActivoFlag(u.activo) === 'SI',
    tipoObjetivo: normalizeUpper(u.tipo_objetivo || ''),
  }));

  return { usuarios };
}

async function actualizarEstadoUsuarioService(email, activo) {
  const supabase = getSupabaseAdmin();
  const emailNorm = normalizeText(email).toLowerCase();
  if (!emailNorm) throw new Error('Email requerido');

  const { error } = await supabase
    .from('usuario')
    .update({ activo: activo ? 'SI' : 'NO' })
    .eq('email', emailNorm);

  if (error) throw new Error(error.message);
  return { error: false, mensaje: 'Estado actualizado correctamente.' };
}

async function crearNuevoUsuarioService(datos) {
  const supabase = getSupabaseAdmin();
  const email = normalizeText(datos && datos.email).toLowerCase();
  const nombre = normalizeText(datos && datos.nombre);
  const rol = normalizeUpper((datos && datos.rol) || 'VENDEDOR') || 'VENDEDOR';
  const tipoObjetivo = rol === 'VENDEDOR' ? normalizeUpper(datos && datos.tipoObjetivo) || 'RANGO' : '';

  if (!email || !nombre) {
    throw new Error('Email y nombre son obligatorios');
  }

  const { data: existente, error: exErr } = await supabase
    .from('usuario')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (exErr) throw new Error(exErr.message);
  if (existente) return { error: true, mensaje: 'Ya existe un usuario con este email.' };

  const { error } = await supabase.from('usuario').insert({
    email,
    rol,
    nombre,
    activo: 'SI',
    tipo_objetivo: tipoObjetivo,
  });

  if (error) throw new Error(error.message);
  return { error: false, mensaje: 'Usuario creado correctamente.' };
}

async function actualizarUsuarioService(datos) {
  const supabase = getSupabaseAdmin();
  const nombreOriginal = normalizeText(datos && datos.nombreOriginal);
  const email = normalizeText(datos && datos.email).toLowerCase();
  const rol = normalizeUpper(datos && datos.rol);
  const tipoObjetivo = normalizeUpper(datos && datos.tipoObjetivo);

  if (!nombreOriginal) throw new Error('nombreOriginal es obligatorio');
  if (!email) throw new Error('email es obligatorio');

  const { data: actual, error: actualErr } = await supabase
    .from('usuario')
    .select('id, email')
    .eq('nombre', nombreOriginal)
    .maybeSingle();

  if (actualErr) throw new Error(actualErr.message);
  if (!actual) return { error: true, mensaje: 'Usuario no encontrado.' };

  if ((actual.email || '').toLowerCase() !== email) {
    const { data: otro, error: otroErr } = await supabase
      .from('usuario')
      .select('id')
      .eq('email', email)
      .neq('id', actual.id)
      .maybeSingle();
    if (otroErr) throw new Error(otroErr.message);
    if (otro) return { error: true, mensaje: 'Ya existe otro usuario con este email.' };
  }

  const patch = { email };
  if (rol) patch.rol = rol;
  if (rol === 'VENDEDOR') {
    patch.tipo_objetivo = tipoObjetivo || 'RANGO';
  } else if (rol) {
    patch.tipo_objetivo = '';
  } else if (tipoObjetivo) {
    patch.tipo_objetivo = tipoObjetivo;
  }

  const { error } = await supabase.from('usuario').update(patch).eq('id', actual.id);
  if (error) throw new Error(error.message);
  return { error: false, mensaje: 'Usuario actualizado correctamente.' };
}

async function getUsuarioIdByNombre(vendedorNombre) {
  const supabase = getSupabaseAdmin();
  const nombre = normalizeText(vendedorNombre);
  if (!nombre) throw new Error('Vendedor faltante');

  const { data, error } = await supabase
    .from('usuario')
    .select('id, nombre')
    .eq('nombre', nombre)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !data.id) throw new Error(`No existe el vendedor "${nombre}" en usuario`);
  return data.id;
}

async function getPerfilByEmail(email) {
  const supabase = getSupabaseAdmin();
  const emailNorm = normalizeText(email).toLowerCase();
  if (!emailNorm) return null;

  const { data, error } = await supabase
    .from('usuario')
    .select('email, rol, nombre, activo, tipo_objetivo')
    .eq('email', emailNorm)
    .maybeSingle();

  if (error || !data) return null;
  if (toActivoFlag(data.activo) !== 'SI') return null;

  const rol = normalizeUpper(data.rol || 'VENDEDOR');
  const hoja = rol === 'VENDEDOR' ? (data.nombre || '') : 'TODAS';

  return {
    email: data.email || '',
    rol,
    hoja,
    acceso: true,
    activo: 'SI',
    tipoObjetivo: normalizeUpper(data.tipo_objetivo || ''),
  };
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
  getPerfilByEmail,
  getListaVendedores,
  getTodosUsuarios,
  actualizarEstadoUsuarioService,
  crearNuevoUsuarioService,
  actualizarUsuarioService,
  getUsuarioIdByNombre,
  getPerfilDemo,
};
