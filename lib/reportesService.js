const { getSupabaseAdmin } = require('./supabaseAdmin');
const { normalizePais } = require('./cajaService');

const ANIO_COMISIONES_DEFAULT = 2026;

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const TRIMESTRES = [
  { key: 'T1', nombre: '1° TRIMESTRE', meses: [0, 1, 2], nombresMeses: ['ENERO', 'FEBRERO', 'MARZO'], trimestreObj: 'OBJETIVOS 1°T' },
  { key: 'T2', nombre: '2° TRIMESTRE', meses: [3, 4, 5], nombresMeses: ['ABRIL', 'MAYO', 'JUNIO'], trimestreObj: 'OBJETIVOS 2°T' },
  { key: 'T3', nombre: '3° TRIMESTRE', meses: [6, 7, 8], nombresMeses: ['JULIO', 'AGOSTO', 'SEPTIEMBRE'], trimestreObj: 'OBJETIVOS 3°T' },
  { key: 'T4', nombre: '4° TRIMESTRE', meses: [9, 10, 11], nombresMeses: ['OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'], trimestreObj: 'OBJETIVOS 4°T' },
];

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

function parseDateAny(value) {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(dt.getTime())) return dt;
  const text = normalizeText(value);
  if (text.includes('/')) {
    const [dd, mm, yyyy] = text.split('/').map(Number);
    if (dd && mm && yyyy) {
      const d = new Date(Date.UTC(yyyy, mm - 1, dd));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function getYearMonthIndex(value) {
  const dt = parseDateAny(value);
  if (!dt) return { year: -1, monthIndex: -1 };
  return {
    year: dt.getUTCFullYear(),
    monthIndex: dt.getUTCMonth(),
  };
}

function normalizePagoToArgentinaBucket(pago) {
  const p = normalizeUpper(pago);
  if (p.includes('EFECTIVO')) return 'EFECTIVO';
  if (p.includes('TRANSFERENCIA') || p.includes('BANCO')) return 'BANCO';
  if (p.includes('CTA') || p.includes('CORRIENTE')) return 'CTACTE';
  if (p.includes('MERCADO')) return 'MP';
  return '';
}

async function getCotizacionesMapService() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('configCotizacion').select('pais, factor');
  if (error) throw new Error(error.message);

  const map = {};
  (data || []).forEach((row) => {
    const pais = normalizePais(row.pais);
    const factor = toNumber(row.factor, 0);
    if (pais && factor > 0) map[pais] = factor;
  });
  return map;
}

async function getObjetivosRows() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('configObjetivo')
    .select('id, trimestre, trimestre_numero, identificador, porcentaje_botas, porcentaje_certs, unidades_botas, unidades_certs, facturacion_botas, facturacion_certs');
  if (error) throw new Error(error.message);
  return data || [];
}

function mapObjetivoRow(row) {
  const identificador = normalizeText(row.identificador);
  const esEspecial = Number.isNaN(Number(identificador));
  return {
    id: identificador,
    trimestre: row.trimestre || '',
    rango: esEspecial ? null : parseInt(identificador, 10),
    vendedor: esEspecial ? identificador : null,
    pctBotas: toNumber(row.porcentaje_botas, 0),
    pctCerts: toNumber(row.porcentaje_certs, 0),
    botas: parseInt(toNumber(row.unidades_botas, 0), 10) || 0,
    certs: parseInt(toNumber(row.unidades_certs, 0), 10) || 0,
    factBotas: toNumber(row.facturacion_botas, 0),
    factCerts: toNumber(row.facturacion_certs, 0),
    esEspecial,
  };
}

async function obtenerObjetivosBackendService(trimestre) {
  const rows = await getObjetivosRows();
  const mapped = rows.map(mapObjetivoRow).filter((o) => o.trimestre === trimestre);
  const resultados = mapped.filter((o) => !o.esEspecial);
  const especiales = mapped.filter((o) => o.esEspecial);

  if (resultados.length === 0) {
    for (let r = 1; r <= 4; r += 1) {
      resultados.push({
        id: r,
        rango: r,
        pctBotas: 0,
        pctCerts: 0,
        botas: 0,
        certs: 0,
        factBotas: 0,
        factCerts: 0,
        esEspecial: false,
      });
    }
  }

  resultados.sort((a, b) => (a.rango || 0) - (b.rango || 0));
  return { error: false, data: resultados, especiales };
}

async function obtenerTodosLosObjetivosService() {
  const rows = await getObjetivosRows();
  return { error: false, data: rows.map(mapObjetivoRow) };
}

async function guardarObjetivosBackendService(trimestre, listaObjetivos) {
  const supabase = getSupabaseAdmin();

  const { data: existentes, error: fetchErr } = await supabase
    .from('configObjetivo')
    .select('id, identificador')
    .eq('trimestre', trimestre)
    .order('created_at', { ascending: true });

  if (fetchErr) throw new Error(fetchErr.message);

  const idsParaBorrar = (existentes || [])
    .filter((row) => !Number.isNaN(Number(normalizeText(row.identificador))))
    .map((row) => row.id)
    .filter(Boolean);

  if (idsParaBorrar.length > 0) {
    const { error: delError } = await supabase.from('configObjetivo').delete().in('id', idsParaBorrar);
    if (delError) throw new Error(delError.message);
  }

  const trimestreNumeroMatch = (trimestre || '').toString().match(/\d/);
  const trimestreNumero = trimestreNumeroMatch ? parseInt(trimestreNumeroMatch[0], 10) : 1;

  const rows = (Array.isArray(listaObjetivos) ? listaObjetivos : []).map((obj) => ({
    trimestre,
    trimestre_numero: trimestreNumero,
    identificador: String(obj.id || obj.rango || ''),
    porcentaje_botas: toNumber(obj.pctBotas, 0),
    porcentaje_certs: toNumber(obj.pctCerts, 0),
    unidades_botas: parseInt(toNumber(obj.botas, 0), 10) || 0,
    unidades_certs: parseInt(toNumber(obj.certs, 0), 10) || 0,
    facturacion_botas: toNumber(obj.factBotas, 0),
    facturacion_certs: toNumber(obj.factCerts, 0),
  })).filter((r) => r.identificador !== '');

  if (rows.length > 0) {
    const { error } = await supabase.from('configObjetivo').insert(rows);
    if (error) throw new Error(error.message);
  }

  return { error: false, mensaje: 'Objetivos guardados con éxito.' };
}

async function guardarObjetivoEspecialService(datos) {
  const supabase = getSupabaseAdmin();
  const trimestre = normalizeText(datos && datos.trimestre);
  const vendedor = normalizeText(datos && datos.vendedor);
  if (!trimestre || !vendedor) throw new Error('Trimestre y vendedor son obligatorios');

  const { error: delError } = await supabase
    .from('configObjetivo')
    .delete()
    .eq('trimestre', trimestre)
    .eq('identificador', vendedor);
  if (delError) throw new Error(delError.message);

  const trimestreNumeroMatch = trimestre.match(/\d/);
  const trimestreNumero = trimestreNumeroMatch ? parseInt(trimestreNumeroMatch[0], 10) : 1;

  const payload = {
    trimestre,
    trimestre_numero: trimestreNumero,
    identificador: vendedor,
    porcentaje_botas: toNumber(datos && datos.pctBotas, 0),
    porcentaje_certs: toNumber(datos && datos.pctCerts, 0),
    unidades_botas: parseInt(toNumber(datos && datos.botas, 0), 10) || 0,
    unidades_certs: parseInt(toNumber(datos && datos.certs, 0), 10) || 0,
    facturacion_botas: toNumber(datos && datos.factBotas, 0),
    facturacion_certs: toNumber(datos && datos.factCerts, 0),
  };

  const { error } = await supabase.from('configObjetivo').insert(payload);
  if (error) throw new Error(error.message);
  return { error: false, mensaje: 'Objetivo especial guardado con éxito.' };
}

async function obtenerReporteConsolidadoService(anio) {
  const supabase = getSupabaseAdmin();
  const year = parseInt(anio, 10) || ANIO_COMISIONES_DEFAULT;
  const cotizaciones = await getCotizacionesMapService();

  const { data, error } = await supabase
    .from('venta')
    .select('fecha, pais, forma_pago, total, cotizacion')
    .eq('anio', year);
  if (error) throw new Error(error.message);

  const reporte = {};
  MESES.forEach((m) => {
    reporte[m] = {
      ARGENTINA: { EFECTIVO: 0, BANCO: 0, CTACTE: 0, MP: 0, TOTAL: 0 },
      CHILE: 0,
      MEXICO: 0,
      ESPANA: 0,
      BRASIL: 0,
      URUGUAY: 0,
      RDM: 0,
      EEUU: 0,
    };
  });

  (data || []).forEach((row) => {
    const { year: y, monthIndex } = getYearMonthIndex(row.fecha);
    if (y !== year || monthIndex < 0 || monthIndex > 11) return;

    const mesNombre = MESES[monthIndex];
    const pais = normalizePais(row.pais || '');
    const totalOriginal = toNumber(row.total, 0);
    const cotizacionUsada = toNumber(row.cotizacion, 0) || cotizaciones[pais] || 1;
    const totalArs = pais === 'ARGENTINA' ? totalOriginal : totalOriginal * cotizacionUsada;

    if (pais === 'ARGENTINA') {
      const bucket = normalizePagoToArgentinaBucket(row.forma_pago);
      if (bucket) reporte[mesNombre].ARGENTINA[bucket] += totalArs;
      reporte[mesNombre].ARGENTINA.TOTAL += totalArs;
      return;
    }

    if (Object.prototype.hasOwnProperty.call(reporte[mesNombre], pais)) {
      reporte[mesNombre][pais] += totalArs;
    }
  });

  return { error: false, data: reporte };
}

function calcularRangoPorcentajeMes(montoMes, objetivoEspecialVendedor, objetivosTrimestre) {
  let rangoMes = 0;
  let porcentajeMes = 0;

  if (objetivoEspecialVendedor) {
    const objetivoMensual = toNumber(objetivoEspecialVendedor.factBotas, 0) / 3;
    if (objetivoMensual > 0) {
      porcentajeMes = (montoMes / objetivoMensual) * 100;
      if (porcentajeMes > 100) porcentajeMes = 100;
      rangoMes = porcentajeMes >= 100 ? 1 : 0;
    }
    return { rango: rangoMes, porcentaje: porcentajeMes };
  }

  if (objetivosTrimestre.length > 0) {
    for (let i = objetivosTrimestre.length - 1; i >= 0; i -= 1) {
      const obj = objetivosTrimestre[i];
      const objetivoMensual = toNumber(obj.factBotas, 0) / 3;
      if (montoMes >= objetivoMensual && objetivoMensual > 0) {
        rangoMes = toNumber(obj.rango, 0);
        break;
      }
    }

    if (rangoMes > 0) {
      const objActual = objetivosTrimestre.find((o) => toNumber(o.rango, 0) === rangoMes);
      if (objActual && toNumber(objActual.factBotas, 0) > 0) {
        const objetivoMensual = toNumber(objActual.factBotas, 0) / 3;
        porcentajeMes = (montoMes / objetivoMensual) * 100;
        if (porcentajeMes > 100) porcentajeMes = 100;
      }
    } else {
      const objRango1 = objetivosTrimestre[0];
      if (objRango1 && toNumber(objRango1.factBotas, 0) > 0) {
        const objetivoMensual = toNumber(objRango1.factBotas, 0) / 3;
        porcentajeMes = (montoMes / objetivoMensual) * 100;
      }
    }
  }

  return { rango: rangoMes, porcentaje: porcentajeMes };
}

async function obtenerTodasLasComisionesService() {
  const supabase = getSupabaseAdmin();
  const year = ANIO_COMISIONES_DEFAULT;
  const cotizaciones = await getCotizacionesMapService();

  const { data: vendedoresRows, error: vendedoresErr } = await supabase
    .from('usuario')
    .select('nombre, activo')
    .eq('rol', 'VENDEDOR')
    .order('created_at', { ascending: true });
  if (vendedoresErr) throw new Error(vendedoresErr.message);

  const todosVendedores = (vendedoresRows || [])
    .map((u) => ({ nombre: normalizeText(u.nombre), activo: normalizeUpper(u.activo) !== 'NO' }))
    .filter((u) => !!u.nombre);

  const { data: ventasRows, error: ventasErr } = await supabase
    .from('venta')
    .select('vendedor, fecha, pais, total, cotizacion, anio')
    .eq('anio', year);
  if (ventasErr) throw new Error(ventasErr.message);

  const objetivosRows = await getObjetivosRows();
  const objetivos = {};
  const objetivosEspeciales = {};
  objetivosRows.forEach((row) => {
    const mapped = mapObjetivoRow(row);
    if (mapped.esEspecial) {
      if (!objetivosEspeciales[mapped.trimestre]) objetivosEspeciales[mapped.trimestre] = {};
      objetivosEspeciales[mapped.trimestre][normalizeUpper(mapped.vendedor)] = mapped;
    } else {
      if (!objetivos[mapped.trimestre]) objetivos[mapped.trimestre] = [];
      objetivos[mapped.trimestre].push(mapped);
    }
  });
  Object.keys(objetivos).forEach((t) => {
    objetivos[t].sort((a, b) => toNumber(a.rango, 0) - toNumber(b.rango, 0));
  });

  const ventasPorVendedorMes = {};
  (ventasRows || []).forEach((row) => {
    const vendedor = normalizeText(row.vendedor);
    if (!vendedor) return;

    const { year: y, monthIndex } = getYearMonthIndex(row.fecha);
    if ((toNumber(row.anio, y) || y) !== year || monthIndex < 0 || monthIndex > 11) return;

    const pais = normalizePais(row.pais || '');
    const montoOriginal = toNumber(row.total, 0);
    const cot = toNumber(row.cotizacion, 0) || cotizaciones[pais] || 1;
    const montoArs = pais === 'ARGENTINA' ? montoOriginal : montoOriginal * cot;

    const vendorKey = normalizeUpper(vendedor);
    if (!ventasPorVendedorMes[vendorKey]) ventasPorVendedorMes[vendorKey] = {};
    ventasPorVendedorMes[vendorKey][monthIndex] = toNumber(ventasPorVendedorMes[vendorKey][monthIndex], 0) + montoArs;
  });

  const resultado = {};

  TRIMESTRES.forEach((trim) => {
    const ventasTrim = {};
    const objetivosTrim = objetivos[trim.trimestreObj] || [];

    todosVendedores.forEach((v) => {
      const key = normalizeUpper(v.nombre);
      const mes1 = toNumber(ventasPorVendedorMes[key] && ventasPorVendedorMes[key][trim.meses[0]], 0);
      const mes2 = toNumber(ventasPorVendedorMes[key] && ventasPorVendedorMes[key][trim.meses[1]], 0);
      const mes3 = toNumber(ventasPorVendedorMes[key] && ventasPorVendedorMes[key][trim.meses[2]], 0);
      const total = mes1 + mes2 + mes3;

      const objetivoEspecial = objetivosEspeciales[trim.trimestreObj] ? objetivosEspeciales[trim.trimestreObj][key] : null;
      const mes1Calc = calcularRangoPorcentajeMes(mes1, objetivoEspecial, objetivosTrim);
      const mes2Calc = calcularRangoPorcentajeMes(mes2, objetivoEspecial, objetivosTrim);
      const mes3Calc = calcularRangoPorcentajeMes(mes3, objetivoEspecial, objetivosTrim);

      ventasTrim[v.nombre] = {
        mes1,
        mes2,
        mes3,
        nombreMes1: trim.nombresMeses[0],
        nombreMes2: trim.nombresMeses[1],
        nombreMes3: trim.nombresMeses[2],
        total,
        rangoMes1: mes1Calc.rango,
        porcentajeMes1: mes1Calc.porcentaje,
        rangoMes2: mes2Calc.rango,
        porcentajeMes2: mes2Calc.porcentaje,
        rangoMes3: mes3Calc.rango,
        porcentajeMes3: mes3Calc.porcentaje,
      };
    });

    resultado[trim.key] = {
      nombre: trim.nombre,
      vendedores: todosVendedores,
      ventas: ventasTrim,
    };
  });

  return { error: false, data: resultado };
}

module.exports = {
  obtenerObjetivosBackendService,
  obtenerTodosLosObjetivosService,
  guardarObjetivosBackendService,
  guardarObjetivoEspecialService,
  obtenerReporteConsolidadoService,
  obtenerTodasLasComisionesService,
};
