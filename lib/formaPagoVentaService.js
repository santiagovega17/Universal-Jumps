const { getSupabaseAdmin } = require('./supabaseAdmin');

function normalizeNombre(value) {
  return (value || '').toString().trim();
}

const PAGE_FORMAS_USADAS = 5000;

/** Nombres de forma_pago ya usados en venta o caja (normalizados a mayúsculas). */
async function fetchFormasPagoUsadasNormalized(supabase) {
  const used = new Set();
  const add = (v) => {
    const t = normalizeNombre(v);
    if (t) used.add(t.toUpperCase());
  };

  for (const table of ['venta', 'cajaMovimiento']) {
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select('forma_pago')
        .range(from, from + PAGE_FORMAS_USADAS - 1);
      if (error) throw error;
      if (!data || !data.length) break;
      data.forEach((r) => add(r.forma_pago));
      if (data.length < PAGE_FORMAS_USADAS) break;
      from += PAGE_FORMAS_USADAS;
    }
  }
  return used;
}

async function listFormasPagoVentaService() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('configFormaPagoVenta')
    .select('id, nombre, orden')
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data || [];

  let usedSet = new Set();
  try {
    usedSet = await fetchFormasPagoUsadasNormalized(supabase);
  } catch (_) {
    usedSet = new Set();
  }

  return rows.map((row) => {
    const n = normalizeNombre(row.nombre);
    return {
      ...row,
      enUso: n ? usedSet.has(n.toUpperCase()) : false,
    };
  });
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
