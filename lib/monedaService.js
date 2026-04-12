const DEFAULT_MONEDAS_POR_PAIS = {
  ARGENTINA: ['ARS', 'USD'],
  CHILE: ['CLP', 'USD'],
  MEXICO: ['MXN', 'USD'],
  ESPANA: ['EUR', 'USD'],
  BRASIL: ['BRL', 'USD'],
  URUGUAY: ['UYU', 'USD'],
  EEUU: ['USD'],
  RDM: ['USD', 'EUR'],
};

const DEFAULT_MONEDA_POR_PAIS = Object.keys(DEFAULT_MONEDAS_POR_PAIS).reduce((acc, pais) => {
  acc[pais] = DEFAULT_MONEDAS_POR_PAIS[pais][0];
  return acc;
}, {});

function normalizeText(value) {
  return (value || '').toString().trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function normalizePaisCode(value) {
  const src = normalizeUpper(value);
  if (!src) return 'ARGENTINA';
  const noAccents = src.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (noAccents === 'USA') return 'EEUU';
  return noAccents;
}

function normalizeMonedaCode(value) {
  return normalizeUpper(value || 'ARS') || 'ARS';
}

function buildFallbackMonedasConfig() {
  return {
    porPais: { ...DEFAULT_MONEDAS_POR_PAIS },
    defaultPorPais: { ...DEFAULT_MONEDA_POR_PAIS },
  };
}

function ensureMonedaEnLista(lista, moneda) {
  const monedaNorm = normalizeMonedaCode(moneda);
  if (!Array.isArray(lista)) return [monedaNorm];
  const normalized = lista.map(normalizeMonedaCode);
  if (!normalized.includes(monedaNorm)) normalized.push(monedaNorm);
  return normalized;
}

async function getMonedasPaisConfig(supabase) {
  const fallback = buildFallbackMonedasConfig();
  try {
    const { data, error } = await supabase
      .from('paisMoneda')
      .select('pais, moneda_codigo, es_default, activa, orden')
      .eq('activa', true)
      .order('pais')
      .order('orden');
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) return fallback;

    const porPais = {};
    const defaultPorPais = {};
    data.forEach((row) => {
      const pais = normalizePaisCode(row.pais);
      const moneda = normalizeMonedaCode(row.moneda_codigo);
      if (!porPais[pais]) porPais[pais] = [];
      if (!porPais[pais].includes(moneda)) porPais[pais].push(moneda);
      if (row.es_default && !defaultPorPais[pais]) defaultPorPais[pais] = moneda;
    });

    Object.keys(fallback.porPais).forEach((pais) => {
      if (!porPais[pais] || porPais[pais].length === 0) porPais[pais] = fallback.porPais[pais].slice();
      if (!defaultPorPais[pais]) defaultPorPais[pais] = fallback.defaultPorPais[pais];
    });

    Object.keys(porPais).forEach((pais) => {
      porPais[pais] = ensureMonedaEnLista(porPais[pais], 'USD');
    });

    return { porPais, defaultPorPais };
  } catch (_) {
    return fallback;
  }
}

async function getCotizacionesMonedaMap(supabase) {
  const { data, error } = await supabase.from('configCotizacion').select('pais, moneda_codigo, factor');
  if (error) throw new Error(error.message);
  const map = { ARS: 1, ARGENTINA: 1 };

  (data || []).forEach((row) => {
    const pais = normalizePaisCode(row.pais);
    const moneda = normalizeMonedaCode(row.moneda_codigo || DEFAULT_MONEDA_POR_PAIS[pais] || 'ARS');
    const factor = Number(row.factor);
    if (!Number.isFinite(factor) || factor <= 0) return;
    if (pais) map[pais] = factor;
    if (moneda && map[moneda] == null) map[moneda] = factor;
  });

  return map;
}

function getMonedaDefaultPorPais(pais, config) {
  const p = normalizePaisCode(pais);
  const map = config && config.defaultPorPais ? config.defaultPorPais : DEFAULT_MONEDA_POR_PAIS;
  return normalizeMonedaCode(map[p] || DEFAULT_MONEDA_POR_PAIS[p] || 'ARS');
}

function getMonedasPorPais(pais, config) {
  const p = normalizePaisCode(pais);
  const map = config && config.porPais ? config.porPais : DEFAULT_MONEDAS_POR_PAIS;
  const lista = Array.isArray(map[p]) && map[p].length ? map[p] : (DEFAULT_MONEDAS_POR_PAIS[p] || ['ARS']);
  return lista.map(normalizeMonedaCode);
}

function getCotizacionParaPaisYMoneda({ pais, moneda, cotizaciones, monedasConfig }) {
  const monedaNorm = normalizeMonedaCode(moneda);
  if (monedaNorm === 'ARS') return 1;
  if (cotizaciones && Number(cotizaciones[monedaNorm]) > 0) return Number(cotizaciones[monedaNorm]);
  const paisNorm = normalizePaisCode(pais);
  const monedaDefault = getMonedaDefaultPorPais(paisNorm, monedasConfig);
  if (monedaNorm === monedaDefault && cotizaciones && Number(cotizaciones[paisNorm]) > 0) {
    return Number(cotizaciones[paisNorm]);
  }
  return 1;
}

module.exports = {
  DEFAULT_MONEDAS_POR_PAIS,
  DEFAULT_MONEDA_POR_PAIS,
  normalizePaisCode,
  normalizeMonedaCode,
  buildFallbackMonedasConfig,
  getMonedasPaisConfig,
  getCotizacionesMonedaMap,
  getMonedaDefaultPorPais,
  getMonedasPorPais,
  getCotizacionParaPaisYMoneda,
};
