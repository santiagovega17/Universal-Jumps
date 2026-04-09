const { getSupabaseAdmin } = require('./supabaseAdmin');
const { normalizePais } = require('./cajaService');
const { getUsuarioIdByNombre } = require('./usuarioService');

const ANIO_ACTIVO = 2026;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return (value || '').toString().trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function sameText(a, b) {
  return normalizeUpper(a) === normalizeUpper(b);
}

function parseInputDate(value) {
  if (!value) return null;
  const text = value.toString().trim();
  if (!text) return null;

  if (text.includes('-')) {
    const [yyyy, mm, dd] = text.split('-').map(Number);
    if (!yyyy || !mm || !dd) return null;
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  if (text.includes('/')) {
    const [dd, mm, yyyy] = text.split('/').map(Number);
    if (!yyyy || !mm || !dd) return null;
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

function toDdMmYyyy(value) {
  if (!value) return '';
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getIvaDivisorByPais(pais) {
  const p = normalizeUpper(pais);
  if (p === 'URUGUAY') return 1.22;
  if (p === 'CHILE' || p === 'BRASIL') return 1.19;
  if (p === 'MEXICO') return 1.16;
  if (p === 'EEUU') return 1.07;
  if (p === 'RDM') return 1.0;
  return 1.21;
}

function formatMoneyForSheet(value) {
  const n = toNumber(value, 0);
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatCantidadForSheet(value) {
  const n = toNumber(value, 0);
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

function ventaRowToLegacyRow(row) {
  return [
    toDdMmYyyy(row.fecha),
    row.estado || '',
    row.chequeado || 'NO',
    row.pais || '',
    row.cliente || '',
    row.concepto || '',
    row.forma_pago || '',
    formatCantidadForSheet(row.cantidad),
    formatMoneyForSheet(row.precio),
    formatMoneyForSheet(row.total),
    formatMoneyForSheet(row.total_sin_iva),
    row.observaciones || '',
    row.cotizacion !== null && row.cotizacion !== undefined ? String(row.cotizacion) : '',
    row.id,
  ];
}

function buildLegacyHeader() {
  return [
    'FECHA',
    'ESTADO',
    'CHEQUEADO',
    'PAIS',
    'CLIENTE',
    'CONCEPTO',
    'FORMA DE PAGO',
    'CANTIDAD',
    'PRECIO',
    'TOTAL',
    'TOTAL (SIN IVA)',
    'OBSERVACIONES',
    'COTIZACION',
  ];
}

async function getVentasByVendedor(vendedor) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('venta')
    .select('id, vendedor, fecha, estado, chequeado, pais, cliente, concepto, forma_pago, cantidad, precio, total, total_sin_iva, observaciones, cotizacion, anio, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (data || []).filter((row) => sameText(row.vendedor, vendedor));
}

async function obtenerDatosDeHojaVentas(nombreHoja) {
  const ventas = await getVentasByVendedor(nombreHoja);
  const filtradas = ventas.filter((row) => {
    if (toNumber(row.anio, 0) === ANIO_ACTIVO) return true;
    const dt = parseInputDate(row.fecha);
    return dt ? dt.getUTCFullYear() === ANIO_ACTIVO : false;
  });

  const rows = filtradas.map(ventaRowToLegacyRow);
  return {
    error: false,
    data: [buildLegacyHeader(), ...rows],
  };
}

async function insertarIngresoCajaDesdeVenta(venta) {
  const supabase = getSupabaseAdmin();
  const pais = normalizePais(venta.pais || '');
  const fecha = parseInputDate(venta.fecha);
  if (!fecha) return;

  const payload = {
    fecha: fecha.toISOString().slice(0, 10),
    tipo: 'INGRESO',
    concepto: venta.concepto || '',
    descripcion: venta.concepto || '',
    forma_pago: venta.formaPago || '',
    monto: toNumber(venta.total, 0),
    observaciones: venta.comentario || '',
    estado: 'PAGADO',
    pais,
    anio: fecha.getUTCFullYear(),
  };
  await supabase.from('cajaMovimiento').insert(payload);
}

async function guardarVentaService(datos) {
  const supabase = getSupabaseAdmin();

  const fecha = parseInputDate(datos.fecha);
  if (!fecha) throw new Error('Fecha invalida');

  const cantidad = toNumber(datos.cantidad, 0);
  const precio = toNumber(datos.precio, 0);
  const total = cantidad * precio;
  const divisor = getIvaDivisorByPais(datos.pais);
  const totalSinIva = total / divisor;
  const usuarioId = await getUsuarioIdByNombre(datos.vendedor);

  const payload = {
    usuario_id: usuarioId,
    vendedor: normalizeText(datos.vendedor),
    fecha: fecha.toISOString().slice(0, 10),
    estado: normalizeText(datos.estado),
    chequeado: 'NO',
    pais: normalizePais(datos.pais || ''),
    cliente: normalizeText(datos.cliente),
    concepto: normalizeText(datos.concepto),
    forma_pago: normalizeText(datos.formaPago),
    cantidad,
    precio,
    total,
    total_sin_iva: totalSinIva,
    observaciones: normalizeText(datos.comentario),
    cotizacion: toNumber(datos.cotizacion, 1),
    anio: fecha.getUTCFullYear(),
  };

  const { error } = await supabase.from('venta').insert(payload);
  if (error) throw new Error(error.message);

  await insertarIngresoCajaDesdeVenta({ ...datos, total });
  return { error: false, mensaje: 'Venta registrada con éxito.' };
}

async function editarVentaService(datos) {
  const supabase = getSupabaseAdmin();
  const id = normalizeText(datos.filaIndex || datos.id);
  if (!id) throw new Error('ID de venta faltante');

  const { data: actual, error: fetchErr } = await supabase
    .from('venta')
    .select('id, chequeado')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!actual) throw new Error('Venta no encontrada');

  const fecha = parseInputDate(datos.fecha);
  if (!fecha) throw new Error('Fecha invalida');

  const cantidad = toNumber(datos.cantidad, 0);
  const precio = toNumber(datos.precio, 0);
  const total = cantidad * precio;
  const divisor = getIvaDivisorByPais(datos.pais);
  const totalSinIva = total / divisor;
  const usuarioId = await getUsuarioIdByNombre(datos.vendedor);

  const update = {
    usuario_id: usuarioId,
    vendedor: normalizeText(datos.vendedor),
    fecha: fecha.toISOString().slice(0, 10),
    estado: normalizeText(datos.estado),
    chequeado: actual.chequeado || 'NO',
    pais: normalizePais(datos.pais || ''),
    cliente: normalizeText(datos.cliente),
    concepto: normalizeText(datos.concepto),
    forma_pago: normalizeText(datos.formaPago),
    cantidad,
    precio,
    total,
    total_sin_iva: totalSinIva,
    observaciones: normalizeText(datos.comentario),
    cotizacion: toNumber(datos.cotizacion, 1),
    anio: fecha.getUTCFullYear(),
  };

  const { error } = await supabase.from('venta').update(update).eq('id', id);
  if (error) throw new Error(error.message);
  return { error: false, mensaje: 'Venta actualizada correctamente.' };
}

async function actualizarCheckService(datos) {
  const supabase = getSupabaseAdmin();
  const id = normalizeText(datos.filaIndex || datos.id);
  const valor = normalizeUpper(datos.valor) === 'SI' ? 'SI' : 'NO';
  if (!id) throw new Error('ID de venta faltante');
  const { error } = await supabase.from('venta').update({ chequeado: valor }).eq('id', id);
  if (error) throw new Error(error.message);
  return { error: false };
}

function ventaPerteneceAnioActivo(row) {
  if (toNumber(row.anio, 0) === ANIO_ACTIVO) return true;
  const dt = parseInputDate(row.fecha);
  return dt ? dt.getUTCFullYear() === ANIO_ACTIVO : false;
}

function fechaIsoCorta(row) {
  if (!row || row.fecha == null) return '';
  const t = row.fecha.toString().trim().slice(0, 10);
  return t;
}

function getMonthRangeIso(anio, mes) {
  const y = toNumber(anio, ANIO_ACTIVO);
  const m = Math.min(12, Math.max(1, toNumber(mes, new Date().getUTCMonth() + 1)));
  const pad = (n) => String(n).padStart(2, '0');
  const start = `${y}-${pad(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${pad(m)}-${pad(lastDay)}`;
  return { y, m, start, end, lastDay };
}

function getPrevMonth(anio, mes) {
  const m = Math.min(12, Math.max(1, toNumber(mes, new Date().getUTCMonth() + 1)));
  let y = toNumber(anio, ANIO_ACTIVO);
  let pm = m - 1;
  if (pm <= 0) {
    pm = 12;
    y -= 1;
  }
  return { y, m: pm };
}

function minIso(a, b) {
  return a <= b ? a : b;
}

function maxIso(a, b) {
  return a >= b ? a : b;
}

function toSerieDiaria({ y, m, lastDay, rows }) {
  const pad = (n) => String(n).padStart(2, '0');
  const byDay = {};
  rows.forEach((r) => {
    const k = fechaIsoCorta(r);
    if (!k) return;
    byDay[k] = (byDay[k] || 0) + toNumber(r.total, 0);
  });
  const serieDiaria = [];
  for (let d = 1; d <= lastDay; d += 1) {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    serieDiaria.push({ fecha: key, total: byDay[key] || 0 });
  }
  return serieDiaria;
}

function toSerieSemanal(serieDiaria) {
  const weeks = [];
  (serieDiaria || []).forEach((p) => {
    const parts = (p.fecha || '').split('-');
    const day = parts.length === 3 ? toNumber(parts[2], 0) : 0;
    if (!day) return;
    const idx = Math.floor((day - 1) / 7);
    weeks[idx] = (weeks[idx] || 0) + toNumber(p.total, 0);
  });
  return weeks.map((total, i) => ({ semana: i + 1, total: toNumber(total, 0) }));
}

/**
 * KPI mes, serie diaria, últimas ventas y ranking (solo si no hay filtro por vendedor).
 */
async function obtenerDashboardHomeService({ mes, anio, vendedor }) {
  const supabase = getSupabaseAdmin();
  const cur = getMonthRangeIso(anio, mes);
  const prev = getPrevMonth(cur.y, cur.m);
  const prevRange = getMonthRangeIso(prev.y, prev.m);

  const utcNow = new Date();
  const hoyIso = utcNow.toISOString().slice(0, 10);
  const ayerUtc = new Date(utcNow);
  ayerUtc.setUTCDate(ayerUtc.getUTCDate() - 1);
  const ayerIso = ayerUtc.toISOString().slice(0, 10);
  const utcY = utcNow.getUTCFullYear();

  const ytdStart = `${cur.y}-01-01`;
  const fetchStart = minIso(prevRange.start, ytdStart);
  let fetchEnd = cur.end;
  if (cur.y === utcY) {
    fetchEnd = maxIso(cur.end, hoyIso);
  } else if (cur.y < utcY) {
    fetchEnd = maxIso(cur.end, `${cur.y}-12-31`);
  }

  const { data, error } = await supabase
    .from('venta')
    .select('id, vendedor, fecha, total, cliente, estado, forma_pago, created_at, anio')
    .gte('fecha', fetchStart)
    .lte('fecha', fetchEnd)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const base = (data || []).filter((row) => ventaPerteneceAnioActivo(row));
  const vStr = normalizeText(vendedor);
  const scoped = vStr ? base.filter((r) => sameText(r.vendedor, vStr)) : base;

  const curRows = scoped.filter((r) => {
    const f = fechaIsoCorta(r);
    return f >= cur.start && f <= cur.end;
  });
  const prevRows = scoped.filter((r) => {
    const f = fechaIsoCorta(r);
    return f >= prevRange.start && f <= prevRange.end;
  });

  const totalMes = curRows.reduce((acc, r) => acc + toNumber(r.total, 0), 0);
  const totalMesPrev = prevRows.reduce((acc, r) => acc + toNumber(r.total, 0), 0);

  let ytdEndCap;
  if (cur.y < utcY) {
    ytdEndCap = `${cur.y}-12-31`;
  } else if (cur.y > utcY) {
    ytdEndCap = `${cur.y}-12-31`;
  } else {
    ytdEndCap = minIso(hoyIso, `${cur.y}-12-31`);
  }
  const totalAnualYtd = scoped.reduce((acc, r) => {
    const f = fechaIsoCorta(r);
    if (f < ytdStart || f > ytdEndCap) return acc;
    return acc + toNumber(r.total, 0);
  }, 0);
  const totalHoy = scoped.reduce((acc, r) => {
    const f = fechaIsoCorta(r);
    return f === hoyIso ? acc + toNumber(r.total, 0) : acc;
  }, 0);
  const totalAyer = scoped.reduce((acc, r) => {
    const f = fechaIsoCorta(r);
    return f === ayerIso ? acc + toNumber(r.total, 0) : acc;
  }, 0);

  const serieDiariaActual = toSerieDiaria({ y: cur.y, m: cur.m, lastDay: cur.lastDay, rows: curRows });
  const serieDiariaAnterior = toSerieDiaria({
    y: prevRange.y,
    m: prevRange.m,
    lastDay: prevRange.lastDay,
    rows: prevRows,
  });
  const serieSemanalActual = toSerieSemanal(serieDiariaActual);
  const serieSemanalAnterior = toSerieSemanal(serieDiariaAnterior);

  let rankingVendedores = [];
  if (!vStr) {
    const rankingMap = {};
    curRows.forEach((r) => {
      const name = normalizeText(r.vendedor) || '(sin nombre)';
      rankingMap[name] = (rankingMap[name] || 0) + toNumber(r.total, 0);
    });
    rankingVendedores = Object.entries(rankingMap)
      .map(([nombre, total]) => ({ vendedor: nombre, total }))
      .sort((a, b) => b.total - a.total);
  }

  const ultimasVentas = curRows.slice(0, 5).map((r) => ({
    id: r.id,
    fecha: fechaIsoCorta(r),
    vendedor: r.vendedor || '',
    cliente: r.cliente || '',
    total: toNumber(r.total, 0),
    estado: r.estado || '',
    forma_pago: r.forma_pago || '',
  }));

  return {
    error: false,
    data: {
      totalMes,
      totalMesPrev,
      totalHoy,
      totalAyer,
      totalAnualYtd,
      hoyIso,
      ayerIso,
      lastDayMes: cur.lastDay,
      serieDiariaActual,
      serieDiariaAnterior,
      serieSemanalActual,
      serieSemanalAnterior,
      rankingVendedores,
      ultimasVentas,
      mes: cur.m,
      anio: cur.y,
      mesAnterior: prevRange.m,
      anioAnterior: prevRange.y,
    },
  };
}

async function borrarVentaService(datos) {
  const supabase = getSupabaseAdmin();
  const id = normalizeText(datos.filaIndex || datos.id);
  if (!id) throw new Error('ID de venta faltante');

  const { data: venta, error: ventaErr } = await supabase
    .from('venta')
    .select('id, fecha, pais, concepto, forma_pago, total')
    .eq('id', id)
    .maybeSingle();
  if (ventaErr) throw new Error(ventaErr.message);
  if (!venta) throw new Error('Venta no encontrada');

  const { error: delErr } = await supabase.from('venta').delete().eq('id', id);
  if (delErr) throw new Error(delErr.message);

  const fecha = parseInputDate(venta.fecha);
  const pais = normalizePais(venta.pais || '');
  const monto = toNumber(venta.total, 0);

  const { data: ingresos, error: ingErr } = await supabase
    .from('cajaMovimiento')
    .select('id, fecha, tipo, concepto, forma_pago, monto, pais, created_at')
    .eq('tipo', 'INGRESO')
    .eq('pais', pais)
    .order('created_at', { ascending: false });

  if (!ingErr && ingresos && ingresos.length > 0) {
    const target = ingresos.find((row) => {
      const sameFecha = toDdMmYyyy(row.fecha) === toDdMmYyyy(fecha);
      const sameConcepto = normalizeText(row.concepto) === normalizeText(venta.concepto);
      const samePago = normalizeText(row.forma_pago) === normalizeText(venta.forma_pago);
      const closeMonto = Math.abs(toNumber(row.monto, 0) - monto) < 0.01;
      return sameFecha && sameConcepto && samePago && closeMonto;
    });

    if (target && target.id) {
      await supabase.from('cajaMovimiento').delete().eq('id', target.id);
    }
  }

  return { error: false };
}

module.exports = {
  obtenerDatosDeHojaVentas,
  obtenerDashboardHomeService,
  guardarVentaService,
  editarVentaService,
  actualizarCheckService,
  borrarVentaService,
};
