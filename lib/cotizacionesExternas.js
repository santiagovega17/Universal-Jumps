/**
 * Obtiene cotizaciones en tiempo real de APIs externas.
 * Factor = cuántos ARS por 1 unidad de moneda extranjera.
 */

const MONEDAS_SOPORTADAS = ['ARS', 'USD', 'BRL', 'UYU', 'EUR', 'CLP', 'MXN'];

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
 * Obtiene factores (ARS por 1 unidad extranjera) para las monedas soportadas.
 * Usa dolarapi para USD/ARS (más preciso para Argentina) y exchangerate-api para el resto.
 */
async function obtenerCotizacionesExternas() {
  const [usdArs, ratesUsd] = await Promise.all([fetchUsdArs(), fetchRatesUsd()]);
  if (!usdArs || !Number.isFinite(usdArs)) throw new Error('No se pudo obtener USD/ARS');

  const factores = { ARS: 1, USD: usdArs };
  for (const moneda of MONEDAS_SOPORTADAS) {
    if (moneda === 'ARS' || moneda === 'USD') continue;
    const rateUsd = ratesUsd[moneda];
    if (!rateUsd || !Number.isFinite(rateUsd) || rateUsd <= 0) continue;
    factores[moneda] = usdArs / rateUsd;
  }

  return factores;
}

module.exports = { obtenerCotizacionesExternas, MONEDAS_SOPORTADAS };
