const { getSupabaseAdmin } = require('./supabaseAdmin');

function normalizeNombre(value) {
  return (value || '').toString().trim();
}

async function listFormasPagoVentaService() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('configFormaPagoVenta')
    .select('id, nombre, orden')
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function crearFormaPagoVentaService(nombre) {
  const n = normalizeNombre(nombre);
  if (!n) return { error: true, mensaje: 'El nombre es obligatorio' };

  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase
    .from('configFormaPagoVenta')
    .select('orden')
    .order('orden', { ascending: false })
    .limit(1);
  const maxOrden = rows && rows[0] && Number.isFinite(Number(rows[0].orden)) ? Number(rows[0].orden) : -1;

  const { error } = await supabase.from('configFormaPagoVenta').insert({
    nombre: n,
    orden: maxOrden + 1,
  });
  if (error) {
    if (String(error.message || '').toLowerCase().includes('unique')) {
      return { error: true, mensaje: 'Ya existe un medio de pago con ese nombre' };
    }
    throw new Error(error.message);
  }
  return { error: false };
}

async function actualizarFormaPagoVentaService(id, nombre) {
  const n = normalizeNombre(nombre);
  if (!id || !n) return { error: true, mensaje: 'Id y nombre son obligatorios' };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('configFormaPagoVenta').update({ nombre: n }).eq('id', id);
  if (error) {
    if (String(error.message || '').toLowerCase().includes('unique')) {
      return { error: true, mensaje: 'Ya existe un medio de pago con ese nombre' };
    }
    throw new Error(error.message);
  }
  return { error: false };
}

async function borrarFormaPagoVentaService(id) {
  if (!id) return { error: true, mensaje: 'Id inválido' };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('configFormaPagoVenta').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { error: false };
}

module.exports = {
  listFormasPagoVentaService,
  crearFormaPagoVentaService,
  actualizarFormaPagoVentaService,
  borrarFormaPagoVentaService,
};
