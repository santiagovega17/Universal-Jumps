/**
 * Obtiene cotizaciones en tiempo real de APIs externas.
 * Factor = cuántos ARS por 1 unidad de moneda extranjera.
 */

const PAIS_A_MONEDA = {
  ARGENTINA: 'ARS',
  CHILE: 'CLP',
  MEXICO: 'MXN',
  ESPANA: 'EUR',
  BRASIL: 'BRL',
  URUGUAY: 'UYU',
  EEUU: 'USD',
  RDM: 'USD',
};

async function fetchUsdArs() {
  const res = await fetch('https://dolarapi.com/v1/dolares', { cache: 'no-store' });
  if (!res.ok) throw new Error('dolarapi no disponible');
  const data = await res.json();
  const oficial = Array.isArray(data) ? data.find((d) => d.casa === 'oficial') : null;
  if (!oficial || oficial.venta == null) throw new Error('dolarapi: sin cotización oficial');
  return Number(oficial.venta);
}

async function fetchRatesUsd() {
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { cache: 'no-store' });
  if (!res.ok) throw new Error('exchangerate-api no disponible');
  const json = await res.json();
  return json.rates || {};
}

/**
 * Obtiene factores (ARS por 1 unidad extranjera) para todos los países.
 * Usa dolarapi para USD/ARS (más preciso para Argentina) y exchangerate-api para el resto.
 */
async function obtenerCotizacionesExternas() {
  const [usdArs, ratesUsd] = await Promise.all([fetchUsdArs(), fetchRatesUsd()]);
  if (!usdArs || !Number.isFinite(usdArs)) throw new Error('No se pudo obtener USD/ARS');

  const factores = { ARGENTINA: 1 };
  const monedas = new Set(Object.values(PAIS_A_MONEDA).filter((m) => m !== 'ARS'));

  for (const [pais, moneda] of Object.entries(PAIS_A_MONEDA)) {
    if (pais === 'ARGENTINA') continue;
    if (moneda === 'USD') {
      factores[pais] = usdArs;
      continue;
    }
    const rateUsd = ratesUsd[moneda];
    if (!rateUsd || !Number.isFinite(rateUsd) || rateUsd <= 0) continue;
    factores[pais] = usdArs / rateUsd;
  }

  return factores;
}

module.exports = { obtenerCotizacionesExternas, PAIS_A_MONEDA };
