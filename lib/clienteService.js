const { getSupabaseAdmin } = require('./supabaseAdmin');
const { normalizePais } = require('./cajaService');

function normalizeText(value) {
  return (value || '').toString().trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

async function getClientesVendedorService(_vendedor, pais) {
  const supabase = getSupabaseAdmin();
  const paisFiltro = normalizePais(pais || '');

  let query = supabase
    .from('cliente')
    .select('id, nombre, apellido, dni, telefono, correo, domicilio, provincia, pais, created_at')
    .order('created_at', { ascending: false });

  if (paisFiltro) {
    query = query.eq('pais', paisFiltro);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const clientes = (data || []).map((c) => ({
    id: c.id,
    nombre: c.nombre || '',
    apellido: c.apellido || '',
    dni: c.dni || '',
    telefono: c.telefono || '',
    correo: c.correo || '',
    domicilio: c.domicilio || '',
    provincia: c.provincia || '',
    pais: c.pais || '',
  }));

  return { error: false, data: clientes };
}

async function guardarClienteService(datos) {
  const supabase = getSupabaseAdmin();
  const payload = {
    nombre: normalizeText(datos && datos.nombre),
    apellido: normalizeText(datos && datos.apellido),
    dni: normalizeText(datos && datos.dni),
    telefono: normalizeText(datos && datos.telefono),
    correo: normalizeText(datos && datos.correo),
    domicilio: normalizeText(datos && datos.domicilio),
    provincia: normalizeText(datos && datos.provincia),
    pais: normalizePais((datos && datos.pais) || ''),
  };

  if (!payload.nombre || !payload.apellido) {
    throw new Error('Nombre y apellido son obligatorios');
  }

  if (normalizeUpper(datos && datos.filaIndex) === 'EDITAR') {
    const nombreOriginal = normalizeText(datos && datos.nombreOriginal);
    const apellidoOriginal = normalizeText(datos && datos.apellidoOriginal);
    if (!nombreOriginal || !apellidoOriginal) {
      return { error: true, mensaje: 'Cliente no encontrado para actualizar.' };
    }

    const { data: actual, error: fetchErr } = await supabase
      .from('cliente')
      .select('id')
      .eq('nombre', nombreOriginal)
      .eq('apellido', apellidoOriginal)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!actual) return { error: true, mensaje: 'Cliente no encontrado para actualizar.' };

    const { error } = await supabase
      .from('cliente')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', actual.id);

    if (error) throw new Error(error.message);
    return { error: false, mensaje: 'Cliente actualizado correctamente.' };
  }

  const { error } = await supabase.from('cliente').insert(payload);
  if (error) throw new Error(error.message);
  return { error: false, mensaje: 'Cliente guardado correctamente.' };
}

async function borrarClientePorDatosService(datos) {
  const supabase = getSupabaseAdmin();
  const nombre = normalizeText(datos && datos.nombre);
  const apellido = normalizeText(datos && datos.apellido);
  if (!nombre || !apellido) return { error: true, mensaje: 'Cliente no encontrado' };

  const { data: actual, error: fetchErr } = await supabase
    .from('cliente')
    .select('id')
    .eq('nombre', nombre)
    .eq('apellido', apellido)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!actual) return { error: true, mensaje: 'Cliente no encontrado' };

  const { error } = await supabase.from('cliente').delete().eq('id', actual.id);
  if (error) throw new Error(error.message);
  return { error: false };
}

module.exports = {
  getClientesVendedorService,
  guardarClienteService,
  borrarClientePorDatosService,
};
