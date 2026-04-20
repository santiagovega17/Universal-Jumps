const { getSupabaseAdmin } = require('./supabaseAdmin');
const {
  getCotizacionesMonedaMap,
  getMonedasPaisConfig,
  getMonedaDefaultPorPais,
  getCotizacionParaPaisYMoneda,
  normalizeMonedaCode,
} = require('./monedaService');

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

function normalizeFormaPago(value) {
  const raw = (value || '').toString().trim();
  if (!raw) return '';
  const upper = raw.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // México: variantes de "Dólar App" → una sola clave (mismo criterio que ya teníamos).
  if (upper.includes('DOLAR APP')) return 'DOLAR APP';
  // España: "Banco Sabadell" vs "Banco Sadabell (ESP)" u otras variantes con typo.
  const bankUpper = upper.replace(/SADABELL/g, 'SABADELL');
  if (bankUpper.includes('BANCO') && bankUpper.includes('SABADELL')) {
    return 'Banco Sabadell';
  }
  // Chile / Uruguay: mismo nombre con o sin sufijo (país) en catálogo vs movimientos manuales.
  if (upper.includes('BANCO') && upper.includes('BCI')) {
    return 'Banco Bci (CL)';
  }
  if (upper.includes('BANCO') && upper.includes('ITAU')) {
    return 'Banco Itaú (URU)';
  }
  return raw;
}

function shouldIncludeByPeriod(fecha, mes, anio) {
  const parts = getDateParts(fecha);
  if (mes === 0) return parts.anio === anio;
  return parts.mes === mes && parts.anio === anio;
}

async function getCotizacionesMap() {
  return getCotizacionesMonedaMap(getSupabaseAdmin());
}

function getVentaMontoOriginal(row) {
  return parseMonto(row.total_moneda != null && row.total_moneda !== '' ? row.total_moneda : row.total);
}

function getVentaMontoArs(row, paisNormalizado, cotizaciones, monedasConfig) {
  const montoOriginal = getVentaMontoOriginal(row);
  const totalArs = parseMonto(row.total_ars);
  if (totalArs > 0) return totalArs;
  const moneda = normalizeMonedaCode(row.moneda_codigo || getMonedaDefaultPorPais(paisNormalizado, monedasConfig));
  if (moneda === 'ARS') return montoOriginal;
  const cot = Number(row.cotizacion_moneda) || Number(row.cotizacion)
    || getCotizacionParaPaisYMoneda({ pais: paisNormalizado, moneda, cotizaciones, monedasConfig });
  return montoOriginal * cot;
}

async function getBalanceCaja({ pais, mes, anio }) {
  const supabase = getSupabaseAdmin();
  const paisNormalizado = normalizePais(pais);
  const cotizaciones = await getCotizacionesMap();
  const monedasConfig = await getMonedasPaisConfig(supabase);

  const { data: ventas, error: ventasError } = await supabase
    .from('venta')
    .select('fecha, pais, total, total_moneda, total_ars, moneda_codigo, cotizacion, cotizacion_moneda')
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
    const montoOriginal = getVentaMontoOriginal(v);
    const montoArs = getVentaMontoArs(v, paisNormalizado, cotizaciones, monedasConfig);
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

  const saldo = ingresos - egresos;

  /** Argentina: todo en ARS; saldoOriginal es coherente. Resto: no mezclar sumas en distintas unidades. */
  if (paisNormalizado === 'ARGENTINA') {
    return {
      ingresos,
      egresos,
      pendientes,
      saldo,
      ingresosOriginal,
      egresosOriginal,
      pendientesOriginal,
      saldoOriginal: ingresosOriginal - egresosOriginal,
    };
  }

  const cotNum = Number(cotizaciones[paisNormalizado]);
  const cotRef = Number.isFinite(cotNum) && cotNum > 0 ? cotNum : 1;
  const monRef = normalizeMonedaCode(getMonedaDefaultPorPais(paisNormalizado, monedasConfig));

  return {
    ingresos,
    egresos,
    pendientes,
    saldo,
    ingresosOriginal,
    egresosOriginal,
    pendientesOriginal,
    saldoOriginal: null,
    cotizacionReferencia: cotRef,
    monedaReferencia: monRef,
    saldoMonedaLocal: (ingresosOriginal || 0) - (egresosOriginal || 0),
  };
}

function parseVencimientoDb(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const s = String(value).trim();
  if (!s) return null;
  const head = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return parseYyyyMmDd(head);
  return parseDdMmYyyy(s);
}

/**
 * Próximos egresos PENDIENTES con fecha de vencimiento (orden por vencimiento).
 */
async function getProximosVencimientosCaja({ pais, limite = 3 }) {
  const supabase = getSupabaseAdmin();
  const paisNormalizado = normalizePais(pais);
  const n = Math.min(20, Math.max(1, Number(limite) || 3));

  const { data, error } = await supabase
    .from('cajaMovimiento')
    .select('id, concepto, descripcion, monto, estado, vencimiento, tipo')
    .eq('pais', paisNormalizado)
    .eq('tipo', 'EGRESO');

  if (error) throw new Error(error.message);

  const mapped = (data || [])
    .map((row) => {
      const dt = parseVencimientoDb(row.vencimiento);
      if (!dt) return null;
      const estado = (row.estado || '').toString().toUpperCase().trim();
      if (estado !== 'PENDIENTE') return null;
      const vencimientoStr = toDdMmYyyy(row.vencimiento);
      return {
        id: row.id,
        concepto: row.concepto || '',
        descripcion: row.descripcion || '',
        monto: parseMonto(row.monto),
        vencimiento: vencimientoStr,
        vencimientoTs: dt.getTime(),
      };
    })
    .filter(Boolean);

  mapped.sort((a, b) => a.vencimientoTs - b.vencimientoTs);
  const total = mapped.length;
  const items = mapped.slice(0, n);

  return { items, totalPendientesConVencimiento: total };
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

async function getMediosPagoCaja({ pais, mes, anio }) {
  const supabase = getSupabaseAdmin();
  const paisNormalizado = normalizePais(pais);
  const cotizaciones = await getCotizacionesMap();
  const monedasConfig = await getMonedasPaisConfig(supabase);
  const mediosPago = {};

  const { data: ventas, error: ventasError } = await supabase
    .from('venta')
    .select('fecha, pais, forma_pago, total, total_moneda, total_ars, moneda_codigo, cotizacion, cotizacion_moneda')
    .eq('pais', paisNormalizado);
  if (ventasError) throw new Error(ventasError.message);

  (ventas || []).forEach((v) => {
    if (!shouldIncludeByPeriod(v.fecha, mes, anio)) return;
    const medio = normalizeFormaPago(v.forma_pago) || 'Sin especificar';
    const montoArs = getVentaMontoArs(v, paisNormalizado, cotizaciones, monedasConfig);
    const montoOrig = getVentaMontoOriginal(v);
    if (!mediosPago[medio]) {
      mediosPago[medio] = { ingresos: 0, egresos: 0, saldo: 0, ingresosOriginal: 0, egresosOriginal: 0 };
    }
    mediosPago[medio].ingresos += montoArs;
    mediosPago[medio].ingresosOriginal += montoOrig;
  });

  const { data: movimientos, error: movError } = await supabase
    .from('cajaMovimiento')
    .select('fecha, tipo, estado, pais, forma_pago, monto, cotizacion_usada')
    .eq('pais', paisNormalizado)
    .eq('tipo', 'EGRESO')
    .eq('estado', 'PAGADO');
  if (movError) throw new Error(movError.message);

  (movimientos || []).forEach((m) => {
    if (!shouldIncludeByPeriod(m.fecha, mes, anio)) return;
    const medio = normalizeFormaPago(m.forma_pago) || 'Sin especificar';
    const montoOriginal = parseMonto(m.monto);
    let montoArs = montoOriginal;
    if (paisNormalizado !== 'ARGENTINA') {
      const cot = Number(m.cotizacion_usada) || cotizaciones[paisNormalizado] || 1;
      montoArs = montoOriginal * cot;
    }
    if (!mediosPago[medio]) {
      mediosPago[medio] = { ingresos: 0, egresos: 0, saldo: 0, ingresosOriginal: 0, egresosOriginal: 0 };
    }
    mediosPago[medio].egresos += montoArs;
    mediosPago[medio].egresosOriginal += montoOriginal;
  });

  Object.keys(mediosPago).forEach((medio) => {
    const m = mediosPago[medio];
    m.saldo = m.ingresos - m.egresos;
    m.saldoMonedaLocal = (m.ingresosOriginal || 0) - (m.egresosOriginal || 0);
  });

  return mediosPago;
}

/**
 * Consolidado anual de caja por concepto + descripción.
 * Solo EGRESOS del país indicado, filtrados por año (estado PAGADO o PENDIENTE),
 * montos siempre positivos (suma de egresos por mes).
 */
async function getConsolidadoCaja({ pais, anio }) {
  const supabase = getSupabaseAdmin();
  const paisNormalizado = normalizePais(pais);
  const yearTarget = Number(anio) || new Date().getUTCFullYear();

  const { data, error } = await supabase
    .from('cajaMovimiento')
    .select('fecha, tipo, concepto, descripcion, monto, estado, pais')
    .eq('pais', paisNormalizado)
    .eq('tipo', 'EGRESO');

  if (error) throw new Error(error.message);

  const itemsMap = {};

  (data || []).forEach((row) => {
    const { mes, anio: y } = getDateParts(row.fecha);
    if (y !== yearTarget || mes < 1 || mes > 12) return;

    const estado = (row.estado || '').toString().toUpperCase().trim();
    if (estado !== 'PAGADO' && estado !== 'PENDIENTE') return;

    const concepto = (row.concepto || '').toString().trim() || 'Sin concepto';
    const descripcion = (row.descripcion || '').toString().trim() || '';
    const key = `${concepto}||${descripcion}`;

    if (!itemsMap[key]) {
      itemsMap[key] = {
        concepto,
        descripcion,
        meses: new Array(12).fill(0),
        totalAnual: 0,
      };
    }

    const monto = parseMonto(row.monto);
    const idx = mes - 1;
    itemsMap[key].meses[idx] += monto;
    itemsMap[key].totalAnual += monto;
  });

  const items = Object.values(itemsMap);

  items.sort((a, b) => {
    const ca = a.concepto.toLowerCase();
    const cb = b.concepto.toLowerCase();
    if (ca !== cb) return ca.localeCompare(cb);
    const da = a.descripcion.toLowerCase();
    const db = b.descripcion.toLowerCase();
    return da.localeCompare(db);
  });

  return {
    pais: paisNormalizado,
    anio: yearTarget,
    items,
  };
}

async function getMovimientoCajaById(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('cajaMovimiento')
    .select('id, fecha, tipo, concepto, descripcion, forma_pago, monto, observaciones, estado, vencimiento, pais')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Movimiento no encontrado');

  return {
    id: data.id,
    fecha: toDdMmYyyy(data.fecha),
    tipo: data.tipo || '',
    concepto: data.concepto || '',
    descripcion: data.descripcion || '',
    formaPago: data.forma_pago || '',
    monto: parseMonto(data.monto),
    observaciones: data.observaciones || '',
    estado: data.estado || 'PAGADO',
    vencimiento: toDdMmYyyy(data.vencimiento),
    pais: data.pais || '',
    filaIndex: data.id,
  };
}

async function updateEstadoMovimientoCaja(id, nuevoEstado) {
  const supabase = getSupabaseAdmin();
  const estado = (nuevoEstado || '').toString().toUpperCase().trim();
  if (!estado) throw new Error('Estado invalido');
  const patch = { estado };
  if (estado === 'PAGADO') patch.vencimiento = null;
  const { error } = await supabase.from('cajaMovimiento').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

async function deleteMovimientoCaja(id) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('cajaMovimiento').delete().eq('id', id);
  if (error) throw new Error(error.message);
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
      forma_pago: normalizeFormaPago(pago.forma),
      monto: parseMonto(pago.monto),
    };
    const { error } = await supabase.from('cajaMovimiento').update(updateData).eq('id', movimientoId);
    if (error) throw new Error(error.message);
    return { mensaje: 'Movimiento Actualizado' };
  }

  if (pagos.length === 0) throw new Error('Debes agregar al menos una forma de pago con monto');
  const rows = pagos.map((p) => ({
    ...base,
    forma_pago: normalizeFormaPago(p.forma),
    monto: parseMonto(p.monto),
  }));

  const { error } = await supabase.from('cajaMovimiento').insert(rows);
  if (error) throw new Error(error.message);
  return { mensaje: 'Movimientos Registrados' };
}

module.exports = {
  normalizePais,
  normalizeFormaPago,
  getBalanceCaja,
  getHistorialCaja,
  getMediosPagoCaja,
  getConsolidadoCaja,
  getProximosVencimientosCaja,
  getMovimientoCajaById,
  updateEstadoMovimientoCaja,
  deleteMovimientoCaja,
  saveMovimientoCaja,
};
