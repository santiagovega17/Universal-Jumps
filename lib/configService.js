const { getSupabaseAdmin } = require('./supabaseAdmin');
const { normalizePais } = require('./cajaService');
const { obtenerCotizacionesExternas } = require('./cotizacionesExternas');
const {
  getCotizacionesMonedaMap,
  getMonedasPaisConfig,
  getMonedaDefaultPorPais,
  normalizePaisCode,
  normalizeMonedaCode,
} = require('./monedaService');

function normalizeText(value) {
  return (value || '').toString().trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getCotizacionesBackend() {
  const supabase = getSupabaseAdmin();
  return getCotizacionesMonedaMap(supabase);
}

async function getMonedasPaisBackend() {
  const supabase = getSupabaseAdmin();
  return getMonedasPaisConfig(supabase);
}

async function getConfiguracionCaja() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('configCaja')
    .select('tipo, nombre, padre, pais, sentido');
  if (error) throw new Error(error.message);

  const config = {};
  (data || []).forEach((row) => {
    const pais = normalizePais(row.pais || 'ARGENTINA');
    if (!config[pais]) {
      config[pais] = { conceptos: [], medios: [], descripciones: {}, sentidos: {} };
    }
    if (row.tipo === 'CONCEPTO') {
      config[pais].conceptos.push(row.nombre);
      config[pais].sentidos[row.nombre] = row.sentido || 'EGRESO';
    } else if (row.tipo === 'MEDIO_PAGO') {
      config[pais].medios.push(row.nombre);
    } else if (row.tipo === 'DESCRIPCION') {
      const padre = row.padre || '';
      if (!config[pais].descripciones[padre]) config[pais].descripciones[padre] = [];
      config[pais].descripciones[padre].push(row.nombre);
    }
  });

  return config;
}

async function getConceptosPorPais(pais) {
  const p = normalizePais(pais);
  const config = await getConfiguracionCaja();
  return (config[p] && config[p].conceptos) || [];
}

async function getDescripcionesPorPaisConcepto(pais, concepto) {
  const p = normalizePais(pais);
  const config = await getConfiguracionCaja();
  if (!config[p]) return [];
  return config[p].descripciones[concepto] || [];
}

async function getMediosPorPais(pais) {
  const p = normalizePais(pais);
  const config = await getConfiguracionCaja();
  return (config[p] && config[p].medios) || [];
}

async function eliminarEgresosNoUsadosDeCaja(concepto, descripcion, pais) {
  const supabase = getSupabaseAdmin();
  const paisNorm = normalizePais(pais || 'ARGENTINA');
  const conceptoNorm = normalizeText(concepto);
  const descripcionNorm = normalizeText(descripcion);
  if (!conceptoNorm) return;

  const { data, error } = await supabase
    .from('cajaMovimiento')
    .select('id, monto, estado')
    .eq('tipo', 'EGRESO')
    .eq('concepto', conceptoNorm)
    .eq('descripcion', descripcionNorm)
    .eq('pais', paisNorm);
  if (error) throw new Error(error.message);

  const ids = (data || [])
    .filter((row) => normalizeUpper(row.estado) === 'PENDIENTE' && Math.abs(toNumber(row.monto, 0)) < 0.0001)
    .map((row) => row.id)
    .filter(Boolean);

  if (ids.length > 0) {
    const { error: delError } = await supabase.from('cajaMovimiento').delete().in('id', ids);
    if (delError) throw new Error(delError.message);
  }
}

async function guardarItemConfigService(tipo, nombre, padre, pais, sentido) {
  const supabase = getSupabaseAdmin();
  const tipoNorm = normalizeUpper(tipo);
  const nombreNorm = normalizeText(nombre);
  const padreNorm = normalizeText(padre);
  const paisNorm = normalizePais(pais || 'ARGENTINA');
  const sentidoNorm = normalizeUpper(sentido);
  if (!tipoNorm || !nombreNorm) return { error: true, mensaje: 'tipo y nombre son obligatorios' };

  const { error } = await supabase.from('configCaja').insert({
    tipo: tipoNorm,
    nombre: nombreNorm,
    padre: padreNorm,
    pais: paisNorm,
    sentido: sentidoNorm || '',
  });
  if (error) throw new Error(error.message);

  return { error: false };
}

async function borrarItemConfigService(tipo, nombre, pais, padre) {
  const supabase = getSupabaseAdmin();
  const tipoNorm = normalizeUpper(tipo);
  const nombreNorm = normalizeText(nombre);
  const paisNorm = normalizePais(pais || 'ARGENTINA');
  const padreNorm = normalizeText(padre);

  if (!tipoNorm || !nombreNorm) return { error: true, mensaje: 'tipo y nombre son obligatorios' };

  if (tipoNorm === 'CONCEPTO' || tipoNorm === 'DESCRIPCION') {
    const concepto = tipoNorm === 'CONCEPTO' ? nombreNorm : padreNorm;
    const descripcion = tipoNorm === 'CONCEPTO' ? '' : nombreNorm;
    await eliminarEgresosNoUsadosDeCaja(concepto, descripcion, paisNorm);
  }

  let query = supabase
    .from('configCaja')
    .delete()
    .eq('tipo', tipoNorm)
    .eq('nombre', nombreNorm)
    .eq('pais', paisNorm);

  if (tipoNorm === 'DESCRIPCION' && padreNorm) {
    query = query.eq('padre', padreNorm);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
  return { error: false };
}

async function actualizarCotizacionesDesdeExternas() {
  const factores = await obtenerCotizacionesExternas();
  const supabase = getSupabaseAdmin();
  const monedasConfig = await getMonedasPaisConfig(supabase);
  const paises = Object.keys(monedasConfig.defaultPorPais || {});
  for (const paisRaw of paises) {
    const pais = normalizePaisCode(paisRaw);
    const moneda = normalizeMonedaCode(getMonedaDefaultPorPais(pais, monedasConfig));
    const factor = moneda === 'ARS' ? 1 : Number(factores[moneda]);
    if (!pais || !Number.isFinite(factor) || factor <= 0) continue;
    await supabase.from('configCotizacion').upsert({ pais, moneda_codigo: moneda, factor }, { onConflict: 'pais' });
  }
  return { error: false, actualizados: paises.length };
}

module.exports = {
  getCotizacionesBackend,
  getMonedasPaisBackend,
  getConfiguracionCaja,
  getConceptosPorPais,
  getDescripcionesPorPaisConcepto,
  getMediosPorPais,
  guardarItemConfigService,
  borrarItemConfigService,
  actualizarCotizacionesDesdeExternas,
};
