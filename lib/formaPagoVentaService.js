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

async function borrarFormaPagoVentaService(id) {
  if (!id) return { error: true, mensaje: 'Id inválido' };
  const supabase = getSupabaseAdmin();

  const { data: row, error: fetchErr } = await supabase
    .from('configFormaPagoVenta')
    .select('nombre')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!row || !normalizeNombre(row.nombre)) {
    return { error: true, mensaje: 'Medio de pago no encontrado' };
  }

  const nombre = normalizeNombre(row.nombre);

  const { count: nVenta, error: errV } = await supabase
    .from('venta')
    .select('*', { count: 'exact', head: true })
    .eq('forma_pago', nombre);
  if (errV) throw new Error(errV.message);

  const { count: nCaja, error: errC } = await supabase
    .from('cajaMovimiento')
    .select('*', { count: 'exact', head: true })
    .eq('forma_pago', nombre);
  if (errC) throw new Error(errC.message);

  const cv = nVenta || 0;
  const cc = nCaja || 0;
  if (cv > 0 || cc > 0) {
    var partes = [];
    if (cv > 0) partes.push(cv + ' venta' + (cv === 1 ? '' : 's'));
    if (cc > 0) partes.push(cc + ' movimiento' + (cc === 1 ? '' : 's') + ' de caja');
    return {
      error: true,
      mensaje: 'No se puede eliminar: este medio de pago ya fue usado (' + partes.join(' y ') + ').',
    };
  }

  const { error } = await supabase.from('configFormaPagoVenta').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { error: false };
}

module.exports = {
  listFormasPagoVentaService,
  crearFormaPagoVentaService,
  borrarFormaPagoVentaService,
};
