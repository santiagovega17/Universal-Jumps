const { getSupabaseAdmin } = require('./supabaseAdmin');

function normalizePais(value) {
  const src = (value || '').toString().trim().toUpperCase();
  const noAccents = src.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (noAccents === 'USA') return 'EEUU';
  if (noAccents === 'ESPANA') return 'ESPANA';
  return noAccents;
}

function parseDdMmYyyy(value) {
  if (!value) return null;
  const text = value.toString().trim();
  const parts = text.split('/');
  if (parts.length !== 3) return null;
  const dd = Number(parts[0]);
  const mm = Number(parts[1]);
  const yyyy = Number(parts[2]);
  if (!dd || !mm || !yyyy) return null;
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function parseYyyyMmDd(value) {
  if (!value) return null;
  const text = value.toString().trim();
  const parts = text.split('-');
  if (parts.length !== 3) return null;
  const yyyy = Number(parts[0]);
  const mm = Number(parts[1]);
  const dd = Number(parts[2]);
  if (!dd || !mm || !yyyy) return null;
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
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

function getDateParts(value) {
  if (!value) return { mes: -1, anio: -1 };
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return { mes: -1, anio: -1 };
  return {
    mes: dt.getUTCMonth() + 1,
    anio: dt.getUTCFullYear(),
  };
}

function parseMonto(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = value.toString().replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function shouldIncludeByPeriod(fecha, mes, anio) {
  const parts = getDateParts(fecha);
  if (mes === 0) return parts.anio === anio;
  return parts.mes === mes && parts.anio === anio;
}

async function getCotizacionesMap() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('configCotizacion').select('pais, factor');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach((row) => {
    const p = normalizePais(row.pais);
    if (!p) return;
    const factor = Number(row.factor);
    if (Number.isFinite(factor) && factor > 0) map[p] = factor;
  });
  return map;
}

async function getBalanceCaja({ pais, mes, anio }) {
  const supabase = getSupabaseAdmin();
  const paisNormalizado = normalizePais(pais);
  const cotizaciones = await getCotizacionesMap();

  const { data: ventas, error: ventasError } = await supabase
    .from('venta')
    .select('fecha, pais, total, cotizacion')
    .eq('pais', paisNormalizado);
  if (ventasError) throw new Error(ventasError.message);

  const { data: movimientos, error: movimientosError } = await supabase
    .from('cajaMovimiento')
    .select('fecha, tipo, estado, pais, monto, cotizacion_usada')
    .eq('pais', paisNormalizado)
    .eq('tipo', 'EGRESO');
  if (movimientosError) throw new Error(movimientosError.message);

  let ingresos = 0;
  let egresos = 0;
  let pendientes = 0;
  let ingresosOriginal = 0;
  let egresosOriginal = 0;
  let pendientesOriginal = 0;

  (ventas || []).forEach((v) => {
    if (!shouldIncludeByPeriod(v.fecha, mes, anio)) return;
    const montoOriginal = parseMonto(v.total);
    let montoArs = montoOriginal;
    if (paisNormalizado !== 'ARGENTINA') {
      const cot = Number(v.cotizacion) || cotizaciones[paisNormalizado] || 1;
      montoArs = montoOriginal * cot;
    }
    ingresos += montoArs;
    ingresosOriginal += montoOriginal;
  });

  (movimientos || []).forEach((m) => {
    if (!shouldIncludeByPeriod(m.fecha, mes, anio)) return;
    const estado = (m.estado || 'PAGADO').toString().toUpperCase().trim();
    if (estado !== 'PAGADO' && estado !== 'PENDIENTE') return;

    const montoOriginal = parseMonto(m.monto);
    let montoArs = montoOriginal;
    if (paisNormalizado !== 'ARGENTINA') {
      const cot = Number(m.cotizacion_usada) || cotizaciones[paisNormalizado] || 1;
      montoArs = montoOriginal * cot;
    }

    if (estado === 'PAGADO') {
      egresos += montoArs;
      egresosOriginal += montoOriginal;
    } else {
      pendientes += montoArs;
      pendientesOriginal += montoOriginal;
    }
  });

  return {
    ingresos,
    egresos,
    pendientes,
    saldo: ingresos - egresos,
    ingresosOriginal,
    egresosOriginal,
    pendientesOriginal,
    saldoOriginal: ingresosOriginal - egresosOriginal,
  };
}

async function getHistorialCaja({ pais, mes, anio }) {
  const supabase = getSupabaseAdmin();
  const paisNormalizado = normalizePais(pais);
  const { data, error } = await supabase
    .from('cajaMovimiento')
    .select('id, fecha, tipo, concepto, descripcion, forma_pago, monto, observaciones, estado, vencimiento, pais, created_at')
    .eq('pais', paisNormalizado);

  if (error) throw new Error(error.message);

  const historial = (data || [])
    .filter((row) => shouldIncludeByPeriod(row.fecha, mes, anio))
    .map((row) => ({
      id: row.id,
      fecha: toDdMmYyyy(row.fecha),
      tipo: row.tipo || '',
      concepto: row.concepto || '',
      descripcion: row.descripcion || '',
      formaPago: row.forma_pago || '',
      monto: parseMonto(row.monto),
      observaciones: row.observaciones || '',
      estado: row.estado || 'PAGADO',
      vencimiento: toDdMmYyyy(row.vencimiento),
      pais: row.pais || '',
      filaIndex: row.id,
    }));

  historial.sort((a, b) => {
    const da = parseDdMmYyyy(a.fecha);
    const db = parseDdMmYyyy(b.fecha);
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  });

  return historial;
}

async function saveMovimientoCaja(payload) {
  const supabase = getSupabaseAdmin();
  const pais = normalizePais(payload.pais || 'ARGENTINA');
  const fechaDt = parseYyyyMmDd(payload.fecha) || parseDdMmYyyy(payload.fecha);
  if (!fechaDt) throw new Error('Fecha invalida');

  const base = {
    fecha: fechaDt.toISOString().slice(0, 10),
    tipo: (payload.tipo || '').toString().toUpperCase().trim(),
    concepto: payload.concepto || '',
    descripcion: payload.descripcion || '',
    observaciones: payload.observaciones || '',
    estado: (payload.estado || 'PAGADO').toString().toUpperCase().trim(),
    pais,
    anio: fechaDt.getUTCFullYear(),
  };

  if (!base.tipo) throw new Error('Tipo es obligatorio');
  if (!base.concepto) throw new Error('Concepto es obligatorio');

  if (payload.vencimiento) {
    const vencDt = parseYyyyMmDd(payload.vencimiento) || parseDdMmYyyy(payload.vencimiento);
    if (!vencDt) throw new Error('Vencimiento invalido');
    base.vencimiento = vencDt.toISOString().slice(0, 10);
  }

  let cotizacion = payload.cotizacion;
  if ((!cotizacion || Number(cotizacion) <= 0) && base.tipo === 'EGRESO' && pais !== 'ARGENTINA') {
    const cotizaciones = await getCotizacionesMap();
    cotizacion = cotizaciones[pais] || null;
  }
  if (cotizacion && Number(cotizacion) > 0) {
    base.cotizacion_usada = Number(cotizacion);
  }

  const pagos = Array.isArray(payload.pagos) ? payload.pagos : [];
  const movimientoId = payload.id || payload.filaIndex;

  if (movimientoId) {
    const pago = pagos[0];
    if (!pago) throw new Error('Falta forma de pago para actualizar');
    const updateData = {
      ...base,
      forma_pago: pago.forma || '',
      monto: parseMonto(pago.monto),
    };
    const { error } = await supabase.from('cajaMovimiento').update(updateData).eq('id', movimientoId);
    if (error) throw new Error(error.message);
    return { mensaje: 'Movimiento Actualizado' };
  }

  if (pagos.length === 0) throw new Error('Debes agregar al menos una forma de pago con monto');
  const rows = pagos.map((p) => ({
    ...base,
    forma_pago: p.forma || '',
    monto: parseMonto(p.monto),
  }));

  const { error } = await supabase.from('cajaMovimiento').insert(rows);
  if (error) throw new Error(error.message);
  return { mensaje: 'Movimientos Registrados' };
}

module.exports = {
  normalizePais,
  getBalanceCaja,
  getHistorialCaja,
  saveMovimientoCaja,
};
