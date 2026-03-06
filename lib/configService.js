const { getSupabaseAdmin } = require('./supabaseAdmin');
const { normalizePais } = require('./cajaService');

async function getCotizacionesBackend() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('configCotizacion').select('pais, factor');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach((row) => {
    const pais = normalizePais(row.pais);
    const factor = Number(row.factor);
    if (!pais || !Number.isFinite(factor)) return;
    map[pais] = factor;
  });
  return map;
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

module.exports = {
  getCotizacionesBackend,
  getConfiguracionCaja,
  getConceptosPorPais,
  getDescripcionesPorPaisConcepto,
  getMediosPorPais,
};
