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

const GRUPO_BOTAS_COMISION = ['BOTAS', 'INDU - ACCE', 'REPUESTOS'];
const GRUPO_CERTS_COMISION = ['CURSOS', 'TALLERES', 'EVENTOS', 'TORNEOS'];

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

function getMonedaPorPais(pais) {
  const p = normalizePais(pais || '');
  if (p === 'CHILE') return 'CLP';
  if (p === 'MEXICO') return 'MXN';
  if (p === 'ESPANA') return 'EUR';
  if (p === 'BRASIL') return 'BRL';
  if (p === 'URUGUAY') return 'UYU';
  if (p === 'RDM' || p === 'EEUU') return 'USD';
  return 'ARS';
}

function clasificarGrupoComision(conceptoRaw) {
  const concepto = normalizeUpper(conceptoRaw || '');
  const enBotas = GRUPO_BOTAS_COMISION.some((item) => concepto.includes(item));
  if (enBotas) return 'BOTAS';
  const enCerts = GRUPO_CERTS_COMISION.some((item) => concepto.includes(item));
  if (enCerts) return 'CERTS';
  return null;
}

function buildObjetivosIndex(rows) {
  const objetivos = {};
  (rows || []).forEach((row) => {
    const mapped = mapObjetivoRow(row);
    if (mapped.anio == null || mapped.mes == null || !Number.isFinite(Number(mapped.rango))) return;
    const mesKey = `${mapped.anio}_${mapped.mes}`;
    if (!objetivos[mesKey]) objetivos[mesKey] = {};
    const vendedorKey = normalizeUpper(mapped.vendedor || '__DEFAULT__');
    if (!objetivos[mesKey][vendedorKey]) objetivos[mesKey][vendedorKey] = [];
    objetivos[mesKey][vendedorKey].push(mapped);
  });
  Object.keys(objetivos).forEach((mk) => {
    Object.keys(objetivos[mk]).forEach((vKey) => {
      objetivos[mk][vKey].sort((a, b) => toNumber(a.rango, 0) - toNumber(b.rango, 0));
    });
  });
  return objetivos;
}

function objetivosParaVendedorYMes(index, year, vendorKey, mesNum) {
  const mesKey = `${year}_${mesNum}`;
  const mapMes = index[mesKey] || {};
  if (mapMes[vendorKey] && mapMes[vendorKey].length) return mapMes[vendorKey];
  return mapMes.__DEFAULT__ || [];
}

function objetivosParaVendedorYMesConFallback(index, year, vendorKey, mesNum) {
  const directos = objetivosParaVendedorYMes(index, year, vendorKey, mesNum);
  if (directos.length > 0) return directos;
  let pm = mesNum - 1;
  let py = year;
  if (pm < 1) {
    pm = 12;
    py -= 1;
  }
  return objetivosParaVendedorYMes(index, py, vendorKey, pm);
}

function getMonthIndicesForPeriodo(mes, trimestre) {
  const month = parseInt(mes, 10);
  if (month >= 1 && month <= 12) return [month - 1];
  const trimText = normalizeUpper(trimestre || '');
  const trim = TRIMESTRES.find((item) => item.key === trimText || String(item.key).replace('T', '') === trimText);
  return trim ? trim.meses.slice() : null;
}

function getPeriodoLabel(year, monthIndices) {
  if (!Array.isArray(monthIndices) || monthIndices.length === 0) return `AÑO ${year}`;
  if (monthIndices.length === 1) return `${MESES[monthIndices[0]]} ${year}`;
  const trim = TRIMESTRES.find((item) => item.meses.every((m, idx) => m === monthIndices[idx]));
  if (trim) return `${trim.nombre} ${year}`;
  return `${MESES[monthIndices[0]]} - ${MESES[monthIndices[monthIndices.length - 1]]} ${year}`;
}

function buildObjetivosAnalisisMes(montoMes, objetivosMes) {
  const sorted = Array.isArray(objetivosMes)
    ? [...objetivosMes].sort((a, b) => toNumber(a.rango, 0) - toNumber(b.rango, 0))
    : [];
  const calculo = calcularRangoPorcentajeMes(montoMes, sorted);
  const objetivoBase = calculo.objetivoBase || null;
  const targetObj = calculo.targetObj || null;
  const rangoActual = targetObj ? toNumber(targetObj.rango, null) : null;
  let proximoObj = null;

  if (targetObj) {
    proximoObj = sorted.find((item) => toNumber(item.rango, -1) > rangoActual) || null;
  } else if (sorted.length > 0) {
    proximoObj = sorted[0];
  }

  const metaActual = objetivoBase ? toNumber(objetivoBase.factBotas, 0) + toNumber(objetivoBase.factCerts, 0) : 0;
  const metaProximoRango = proximoObj ? toNumber(proximoObj.factBotas, 0) + toNumber(proximoObj.factCerts, 0) : 0;

  return {
    ...calculo,
    rangoActual,
    metaActual,
    metaProximoRango,
    siguienteRango: proximoObj ? toNumber(proximoObj.rango, null) : null,
    faltanteMetaActual: metaActual > montoMes ? metaActual - montoMes : 0,
    faltanteProximoRango: metaProximoRango > montoMes ? metaProximoRango - montoMes : 0,
    pctBotasActual: targetObj ? toNumber(targetObj.pctBotas, 0) : 0,
    pctCertsActual: targetObj ? toNumber(targetObj.pctCerts, 0) : 0,
    pctBotasProximo: proximoObj ? toNumber(proximoObj.pctBotas, 0) : 0,
    pctCertsProximo: proximoObj ? toNumber(proximoObj.pctCerts, 0) : 0,
    estaEnRangoMaximo: !!targetObj && !proximoObj,
  };
}

function buildMesesResumenVendedor({ year, vendedor, ventasRows, objetivosIndex, cotizaciones }) {
  const vendorKey = normalizeUpper(vendedor);
  const meses = MESES.map((nombreMes, monthIndex) => ({
    monthIndex,
    monthNumber: monthIndex + 1,
    nombreMes,
    totalFacturado: 0,
    totalBotas: 0,
    totalCerts: 0,
    cantidadVentas: 0,
    rango: null,
    porcentajeCumplimiento: 0,
    porcentajeBotas: 0,
    porcentajeCerts: 0,
    metaCombinada: 0,
    metaBotas: 0,
    metaCerts: 0,
    comisionBotas: 0,
    comisionCerts: 0,
    totalComision: 0,
    ventas: [],
  }));

  (ventasRows || []).forEach((row) => {
    if (normalizeUpper(row.vendedor) !== vendorKey) return;
    const grupo = clasificarGrupoComision(row.concepto);
    if (!grupo) return;

    const { year: saleYear, monthIndex } = getYearMonthIndex(row.fecha);
    if ((toNumber(row.anio, saleYear) || saleYear) !== year || monthIndex < 0 || monthIndex > 11) return;

    const pais = normalizePais(row.pais || '');
    const montoOriginal = toNumber(row.total, 0);
    const cotizacionUsada = toNumber(row.cotizacion, 0) || cotizaciones[pais] || 1;
    const montoArs = pais === 'ARGENTINA' ? montoOriginal : montoOriginal * cotizacionUsada;
    const itemMes = meses[monthIndex];

    itemMes.totalFacturado += montoArs;
    itemMes.cantidadVentas += 1;
    if (grupo === 'BOTAS') itemMes.totalBotas += montoArs;
    if (grupo === 'CERTS') itemMes.totalCerts += montoArs;

    itemMes.ventas.push({
      id: row.id || null,
      fecha: row.fecha || null,
      cliente: normalizeText(row.cliente),
      concepto: normalizeText(row.concepto),
      formaPago: normalizeText(row.forma_pago),
      observaciones: normalizeText(row.observaciones),
      cantidad: toNumber(row.cantidad, 0),
      pais,
      monedaOriginal: getMonedaPorPais(pais),
      montoOriginal,
      cotizacionUsada,
      montoComisionable: montoArs,
      grupo: grupo === 'BOTAS' ? 'botas' : 'certs',
      porcentajeAplicado: 0,
      importeComision: 0,
    });
  });

  meses.forEach((itemMes) => {
    const objetivosMes = objetivosParaVendedorYMesConFallback(
      objetivosIndex,
      year,
      vendorKey,
      itemMes.monthNumber,
    );
    const calc = buildObjetivosAnalisisMes(itemMes.totalFacturado, objetivosMes);
    const objetivoBase = calc.objetivoBase;
    const porcentajeBotas = calc.pctBotasActual;
    const porcentajeCerts = calc.pctCertsActual;

    itemMes.rango = calc.rango;
    itemMes.porcentajeCumplimiento = calc.porcentaje;
    itemMes.porcentajeBotas = porcentajeBotas;
    itemMes.porcentajeCerts = porcentajeCerts;
    itemMes.metaBotas = objetivoBase ? toNumber(objetivoBase.factBotas, 0) : 0;
    itemMes.metaCerts = objetivoBase ? toNumber(objetivoBase.factCerts, 0) : 0;
    itemMes.metaCombinada = itemMes.metaBotas + itemMes.metaCerts;
    itemMes.comisionBotas = itemMes.totalBotas * (porcentajeBotas / 100);
    itemMes.comisionCerts = itemMes.totalCerts * (porcentajeCerts / 100);
    itemMes.totalComision = itemMes.comisionBotas + itemMes.comisionCerts;
    itemMes.metaActual = calc.metaActual;
    itemMes.siguienteRango = calc.siguienteRango;
    itemMes.metaProximoRango = calc.metaProximoRango;
    itemMes.faltanteMetaActual = calc.faltanteMetaActual;
    itemMes.faltanteProximoRango = calc.faltanteProximoRango;
    itemMes.pctBotasProximo = calc.pctBotasProximo;
    itemMes.pctCertsProximo = calc.pctCertsProximo;
    itemMes.estaEnRangoMaximo = calc.estaEnRangoMaximo;
    itemMes.ventas = itemMes.ventas
      .map((venta) => {
        const porcentajeAplicado = venta.grupo === 'botas' ? porcentajeBotas : porcentajeCerts;
        return {
          ...venta,
          nombreMes: itemMes.nombreMes,
          monthIndex: itemMes.monthIndex,
          monthNumber: itemMes.monthNumber,
          porcentajeAplicado,
          importeComision: venta.montoComisionable * (porcentajeAplicado / 100),
          rangoMes: itemMes.rango,
          porcentajeCumplimientoMes: itemMes.porcentajeCumplimiento,
        };
      })
      .sort((a, b) => {
        const ta = parseDateAny(a.fecha);
        const tb = parseDateAny(b.fecha);
        const va = ta ? ta.getTime() : 0;
        const vb = tb ? tb.getTime() : 0;
        return vb - va;
      });
  });

  return meses;
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
    .select('id, trimestre, trimestre_numero, anio, mes, identificador, vendedor, porcentaje_botas, porcentaje_certs, unidades_botas, unidades_certs, facturacion_botas, facturacion_certs');
  if (error) throw new Error(error.message);
  return data || [];
}

function mapObjetivoRow(row) {
  const identificador = normalizeText(row.identificador);
  const rango = parseInt(identificador, 10);
  const vendedor = normalizeText(row.vendedor);
  const anio = toNumber(row.anio, NaN);
  const mes = toNumber(row.mes, NaN);
  return {
    id: identificador,
    trimestre: row.trimestre || '',
    anio: Number.isFinite(anio) ? Math.trunc(anio) : null,
    mes: Number.isFinite(mes) ? Math.trunc(mes) : null,
    rango: Number.isFinite(rango) ? rango : null,
    vendedor: vendedor || null,
    pctBotas: toNumber(row.porcentaje_botas, 0),
    pctCerts: toNumber(row.porcentaje_certs, 0),
    botas: parseInt(toNumber(row.unidades_botas, 0), 10) || 0,
    certs: parseInt(toNumber(row.unidades_certs, 0), 10) || 0,
    factBotas: toNumber(row.facturacion_botas, 0),
    factCerts: toNumber(row.facturacion_certs, 0),
    esEspecial: false,
  };
}

function filtrarObjetivosPorVendedor(mapped, vendedor) {
  const vendedorNorm = normalizeUpper(vendedor);
  const delMes = mapped.filter(
    (o) => o && o.anio != null && o.mes != null && Number.isFinite(Number(o.rango)),
  );
  const personalizados = vendedorNorm
    ? delMes.filter((o) => normalizeUpper(o.vendedor) === vendedorNorm)
    : [];
  if (personalizados.length > 0) return personalizados;
  return delMes.filter((o) => !normalizeText(o.vendedor));
}

function mesCalendarioAnterior(year, month) {
  let y = parseInt(year, 10);
  let m = parseInt(month, 10);
  if (!Number.isFinite(y)) y = ANIO_COMISIONES_DEFAULT;
  if (!Number.isFinite(m) || m < 1 || m > 12) m = 1;
  let pm = m - 1;
  let py = y;
  if (pm < 1) {
    pm = 12;
    py -= 1;
  }
  return { anio: py, mes: pm };
}

function clonarObjetivosAMes(destAnio, destMes, filas) {
  return (filas || []).map((o) => ({
    ...o,
    anio: destAnio,
    mes: destMes,
    trimestre: `${destAnio}-${String(destMes).padStart(2, '0')}`,
  }));
}

async function obtenerObjetivosBackendService(anio, mes, vendedor = '') {
  const year = parseInt(anio, 10) || ANIO_COMISIONES_DEFAULT;
  const month = parseInt(mes, 10);
  const mesValido = month >= 1 && month <= 12 ? month : new Date().getUTCMonth() + 1;

  const rows = await getObjetivosRows();
  const mappedAll = rows.map(mapObjetivoRow);

  let objetivosDesdeMesAnterior = false;
  let mesObjetivosOrigen = mesValido;
  let anioObjetivosOrigen = year;

  const mapped = mappedAll.filter((o) => o.anio === year && o.mes === mesValido);
  let resultados = filtrarObjetivosPorVendedor(mapped, vendedor);

  if (resultados.length === 0) {
    const { anio: py, mes: pm } = mesCalendarioAnterior(year, mesValido);
    const mappedPrev = mappedAll.filter((o) => o.anio === py && o.mes === pm);
    const prev = filtrarObjetivosPorVendedor(mappedPrev, vendedor);
    if (prev.length > 0) {
      resultados = clonarObjetivosAMes(year, mesValido, prev);
      objetivosDesdeMesAnterior = true;
      mesObjetivosOrigen = pm;
      anioObjetivosOrigen = py;
    }
  }

  if (resultados.length === 0) {
    for (let r = 1; r <= 4; r += 1) {
      resultados.push({
        id: r,
        rango: r,
        anio: year,
        mes: mesValido,
        pctBotas: 0,
        pctCerts: 0,
        botas: 0,
        certs: 0,
        factBotas: 0,
        factCerts: 0,
        vendedor: normalizeText(vendedor) || null,
      });
    }
  }

  resultados.sort((a, b) => (a.rango || 0) - (b.rango || 0));
  return {
    error: false,
    data: resultados,
    objetivosDesdeMesAnterior,
    mesObjetivosOrigen,
    anioObjetivosOrigen,
  };
}

async function obtenerTodosLosObjetivosService() {
  const rows = await getObjetivosRows();
  return { error: false, data: rows.map(mapObjetivoRow) };
}

async function guardarObjetivosBackendService(anio, mes, listaObjetivos, vendedor = '') {
  const supabase = getSupabaseAdmin();
  const vendedorNorm = normalizeText(vendedor);
  const year = parseInt(anio, 10) || ANIO_COMISIONES_DEFAULT;
  const month = parseInt(mes, 10);
  const mesValido = month >= 1 && month <= 12 ? month : 1;
  const trimestreLabel = `${year}-${String(mesValido).padStart(2, '0')}`;

  let query = supabase
    .from('configObjetivo')
    .select('id, identificador, vendedor')
    .eq('anio', year)
    .eq('mes', mesValido)
    .order('created_at', { ascending: true });

  if (vendedorNorm) query = query.eq('vendedor', vendedorNorm);
  else query = query.is('vendedor', null);

  const { data: existentes, error: fetchErr } = await query;

  if (fetchErr) throw new Error(fetchErr.message);

  const idsParaBorrar = (existentes || [])
    .filter((row) => Number.isFinite(parseInt(normalizeText(row.identificador), 10)))
    .map((row) => row.id)
    .filter(Boolean);

  if (idsParaBorrar.length > 0) {
    const { error: delError } = await supabase.from('configObjetivo').delete().in('id', idsParaBorrar);
    if (delError) throw new Error(delError.message);
  }

  const rows = (Array.isArray(listaObjetivos) ? listaObjetivos : []).map((obj) => {
    const rawIdentificador = obj && obj.id != null && obj.id !== '' ? obj.id : obj && obj.rango != null ? obj.rango : '';
    return {
    trimestre: trimestreLabel,
    trimestre_numero: mesValido,
    anio: year,
    mes: mesValido,
    identificador: String(rawIdentificador),
    vendedor: vendedorNorm || null,
    porcentaje_botas: toNumber(obj.pctBotas, 0),
    porcentaje_certs: toNumber(obj.pctCerts, 0),
    unidades_botas: parseInt(toNumber(obj.botas, 0), 10) || 0,
    unidades_certs: parseInt(toNumber(obj.certs, 0), 10) || 0,
    facturacion_botas: toNumber(obj.factBotas, 0),
    facturacion_certs: toNumber(obj.factCerts, 0),
  };
  }).filter((r) => r.identificador !== '');

  if (rows.length > 0) {
    const { error } = await supabase.from('configObjetivo').insert(rows);
    if (error) throw new Error(error.message);
  }

  return { error: false, mensaje: 'Objetivos guardados con éxito.' };
}

async function guardarObjetivoEspecialService(datos) {
  const anio = toNumber(datos && datos.anio, NaN);
  const mes = toNumber(datos && datos.mes, NaN);
  const vendedor = normalizeText(datos && datos.vendedor);
  const filas = Array.isArray(datos && datos.filas) ? datos.filas : [];
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || !vendedor) {
    throw new Error('Año, mes y vendedor son obligatorios');
  }
  return guardarObjetivosBackendService(anio, mes, filas, vendedor);
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

function calcularRangoPorcentajeMes(montoMes, objetivosMes) {
  const sorted = Array.isArray(objetivosMes)
    ? [...objetivosMes].sort((a, b) => toNumber(a.rango, 0) - toNumber(b.rango, 0))
    : [];

  let rangoMes = null;
  let porcentajeMes = 0;
  let targetObj = null;

  if (sorted.length === 0) {
    return { rango: null, porcentaje: 0, targetObj: null, objetivoBase: null };
  }

  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const obj = sorted[i];
    const metaComb = toNumber(obj.factBotas, 0) + toNumber(obj.factCerts, 0);
    if (montoMes >= metaComb && metaComb > 0) {
      rangoMes = toNumber(obj.rango, 0);
      targetObj = obj;
      break;
    }
  }

  const firstObj = sorted[0];
  if (!targetObj && firstObj) {
    targetObj = firstObj;
    rangoMes = toNumber(firstObj.rango, null);
  }
  const objetivoBase = targetObj || firstObj || null;

  if (targetObj) {
    const metaCombinada = toNumber(targetObj.factBotas, 0) + toNumber(targetObj.factCerts, 0);
    if (metaCombinada > 0) {
      porcentajeMes = (montoMes / metaCombinada) * 100;
      if (porcentajeMes > 100) porcentajeMes = 100;
    }
  } else if (firstObj) {
    const metaCombinada = toNumber(firstObj.factBotas, 0) + toNumber(firstObj.factCerts, 0);
    if (metaCombinada > 0) {
      porcentajeMes = (montoMes / metaCombinada) * 100;
      if (porcentajeMes > 100) porcentajeMes = 100;
    }
  }

  return { rango: rangoMes, porcentaje: porcentajeMes, targetObj, objetivoBase };
}

async function obtenerTodasLasComisionesService(anio) {
  const supabase = getSupabaseAdmin();
  const year = parseInt(anio, 10) || ANIO_COMISIONES_DEFAULT;
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
    .select('vendedor, fecha, pais, total, cotizacion, anio, concepto')
    .eq('anio', year);
  if (ventasErr) throw new Error(ventasErr.message);

  const objetivosRows = await getObjetivosRows();
  const objetivos = buildObjetivosIndex(objetivosRows);

  const ventasPorVendedorMes = {};
  (ventasRows || []).forEach((row) => {
    const vendedor = normalizeText(row.vendedor);
    if (!vendedor) return;
    if (!clasificarGrupoComision(row.concepto)) return;

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
    const mesNum1 = trim.meses[0] + 1;
    const mesNum2 = trim.meses[1] + 1;
    const mesNum3 = trim.meses[2] + 1;

    todosVendedores.forEach((v) => {
      const key = normalizeUpper(v.nombre);
      const mes1 = toNumber(ventasPorVendedorMes[key] && ventasPorVendedorMes[key][trim.meses[0]], 0);
      const mes2 = toNumber(ventasPorVendedorMes[key] && ventasPorVendedorMes[key][trim.meses[1]], 0);
      const mes3 = toNumber(ventasPorVendedorMes[key] && ventasPorVendedorMes[key][trim.meses[2]], 0);
      const total = mes1 + mes2 + mes3;

      const mes1Calc = calcularRangoPorcentajeMes(mes1, objetivosParaVendedorYMesConFallback(objetivos, year, key, mesNum1));
      const mes2Calc = calcularRangoPorcentajeMes(mes2, objetivosParaVendedorYMesConFallback(objetivos, year, key, mesNum2));
      const mes3Calc = calcularRangoPorcentajeMes(mes3, objetivosParaVendedorYMesConFallback(objetivos, year, key, mesNum3));

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

async function obtenerComisionesVendedorService(vendedor, anio, mes, trimestre) {
  const vendedorNormalizado = normalizeText(vendedor);
  if (!vendedorNormalizado) throw new Error('vendedor es requerido');

  const supabase = getSupabaseAdmin();
  const year = parseInt(anio, 10) || ANIO_COMISIONES_DEFAULT;
  const cotizaciones = await getCotizacionesMapService();
  const objetivosRows = await getObjetivosRows();
  const objetivos = buildObjetivosIndex(objetivosRows);

  const { data: ventasRows, error: ventasErr } = await supabase
    .from('venta')
    .select('id, vendedor, fecha, pais, cliente, concepto, forma_pago, cantidad, total, observaciones, cotizacion, anio, created_at')
    .eq('anio', year);
  if (ventasErr) throw new Error(ventasErr.message);

  const monthIndices = getMonthIndicesForPeriodo(mes, trimestre);
  const meses = buildMesesResumenVendedor({
    year,
    vendedor: vendedorNormalizado,
    ventasRows,
    objetivosIndex: objetivos,
    cotizaciones,
  });
  const mesesFiltrados = Array.isArray(monthIndices)
    ? meses.filter((itemMes) => monthIndices.includes(itemMes.monthIndex))
    : meses;
  const mesActualCalendario = new Date().getMonth();
  let mesPrioritario = null;
  if (Array.isArray(monthIndices) && monthIndices.length === 1) {
    mesPrioritario = meses.find((itemMes) => itemMes.monthIndex === monthIndices[0]) || null;
  } else {
    mesPrioritario = meses.find((itemMes) => itemMes.monthIndex === mesActualCalendario) || null;
  }
  if (!mesPrioritario) {
    for (let i = meses.length - 1; i >= 0; i -= 1) {
      if (meses[i].totalFacturado > 0 || meses[i].totalComision > 0 || meses[i].metaCombinada > 0) {
        mesPrioritario = meses[i];
        break;
      }
    }
  }
  if (!mesPrioritario && meses.length > 0) mesPrioritario = meses[0];
  const mesAnterior = mesPrioritario && mesPrioritario.monthIndex > 0 ? meses[mesPrioritario.monthIndex - 1] : null;
  const mejorMes = meses.reduce((best, itemMes) => {
    if (!best) return itemMes;
    return itemMes.totalFacturado > best.totalFacturado ? itemMes : best;
  }, null);

  const detalle = [];
  mesesFiltrados.forEach((itemMes) => {
    itemMes.ventas.forEach((venta) => detalle.push(venta));
  });
  detalle.sort((a, b) => {
    const ta = parseDateAny(a.fecha);
    const tb = parseDateAny(b.fecha);
    const va = ta ? ta.getTime() : 0;
    const vb = tb ? tb.getTime() : 0;
    return vb - va;
  });

  const resumenMeses = mesesFiltrados.map((itemMes) => ({
    monthIndex: itemMes.monthIndex,
    monthNumber: itemMes.monthNumber,
    nombreMes: itemMes.nombreMes,
    totalFacturado: itemMes.totalFacturado,
    totalBotas: itemMes.totalBotas,
    totalCerts: itemMes.totalCerts,
    cantidadVentas: itemMes.cantidadVentas,
    rango: itemMes.rango,
    porcentajeCumplimiento: itemMes.porcentajeCumplimiento,
    porcentajeBotas: itemMes.porcentajeBotas,
    porcentajeCerts: itemMes.porcentajeCerts,
    metaCombinada: itemMes.metaCombinada,
    metaActual: itemMes.metaActual,
    metaBotas: itemMes.metaBotas,
    metaCerts: itemMes.metaCerts,
    siguienteRango: itemMes.siguienteRango,
    metaProximoRango: itemMes.metaProximoRango,
    faltanteMetaActual: itemMes.faltanteMetaActual,
    faltanteProximoRango: itemMes.faltanteProximoRango,
    comisionBotas: itemMes.comisionBotas,
    comisionCerts: itemMes.comisionCerts,
    totalComision: itemMes.totalComision,
    pctBotasProximo: itemMes.pctBotasProximo,
    pctCertsProximo: itemMes.pctCertsProximo,
    estaEnRangoMaximo: itemMes.estaEnRangoMaximo,
  }));

  const resumen = resumenMeses.reduce(
    (acc, itemMes) => {
      acc.totalFacturado += itemMes.totalFacturado;
      acc.totalBotas += itemMes.totalBotas;
      acc.totalCerts += itemMes.totalCerts;
      acc.totalComision += itemMes.totalComision;
      acc.cantidadVentas += itemMes.cantidadVentas;
      return acc;
    },
    {
      periodoLabel: getPeriodoLabel(year, monthIndices),
      meses: resumenMeses,
      historicoMeses: meses.map((itemMes) => ({
        monthIndex: itemMes.monthIndex,
        monthNumber: itemMes.monthNumber,
        nombreMes: itemMes.nombreMes,
        totalFacturado: itemMes.totalFacturado,
        totalComision: itemMes.totalComision,
        rango: itemMes.rango,
        porcentajeCumplimiento: itemMes.porcentajeCumplimiento,
        metaCombinada: itemMes.metaCombinada,
        siguienteRango: itemMes.siguienteRango,
        faltanteProximoRango: itemMes.faltanteProximoRango,
        estaEnRangoMaximo: itemMes.estaEnRangoMaximo,
      })),
      totalFacturado: 0,
      totalBotas: 0,
      totalCerts: 0,
      totalComision: 0,
      cantidadVentas: 0,
    },
  );
  const totalFacturadoAnual = meses.reduce((acc, itemMes) => acc + (Number(itemMes.totalFacturado) || 0), 0);
  const totalComisionAnual = meses.reduce((acc, itemMes) => acc + (Number(itemMes.totalComision) || 0), 0);
  resumen.promedioMensualFacturado = meses.length ? totalFacturadoAnual / meses.length : 0;
  resumen.promedioMensualComision = meses.length ? totalComisionAnual / meses.length : 0;
  resumen.mesPrioritario = mesPrioritario
    ? {
      monthIndex: mesPrioritario.monthIndex,
      monthNumber: mesPrioritario.monthNumber,
      nombreMes: mesPrioritario.nombreMes,
      totalFacturado: mesPrioritario.totalFacturado,
      totalComision: mesPrioritario.totalComision,
      rango: mesPrioritario.rango,
      porcentajeCumplimiento: mesPrioritario.porcentajeCumplimiento,
      metaCombinada: mesPrioritario.metaCombinada,
      metaActual: mesPrioritario.metaActual,
      siguienteRango: mesPrioritario.siguienteRango,
      metaProximoRango: mesPrioritario.metaProximoRango,
      faltanteMetaActual: mesPrioritario.faltanteMetaActual,
      faltanteProximoRango: mesPrioritario.faltanteProximoRango,
      porcentajeBotas: mesPrioritario.porcentajeBotas,
      porcentajeCerts: mesPrioritario.porcentajeCerts,
      pctBotasProximo: mesPrioritario.pctBotasProximo,
      pctCertsProximo: mesPrioritario.pctCertsProximo,
      estaEnRangoMaximo: mesPrioritario.estaEnRangoMaximo,
    }
    : null;
  resumen.mesAnterior = mesAnterior
    ? {
      monthIndex: mesAnterior.monthIndex,
      monthNumber: mesAnterior.monthNumber,
      nombreMes: mesAnterior.nombreMes,
      totalFacturado: mesAnterior.totalFacturado,
      totalComision: mesAnterior.totalComision,
      rango: mesAnterior.rango,
      porcentajeCumplimiento: mesAnterior.porcentajeCumplimiento,
    }
    : null;
  resumen.mejorMes = mejorMes
    ? {
      monthIndex: mejorMes.monthIndex,
      monthNumber: mejorMes.monthNumber,
      nombreMes: mejorMes.nombreMes,
      totalFacturado: mejorMes.totalFacturado,
      totalComision: mejorMes.totalComision,
      rango: mejorMes.rango,
      porcentajeCumplimiento: mejorMes.porcentajeCumplimiento,
    }
    : null;

  return {
    error: false,
    data: {
      vendedor: vendedorNormalizado,
      anio: year,
      filtro: {
        mes: parseInt(mes, 10) || null,
        trimestre: normalizeUpper(trimestre || '') || null,
        periodoLabel: resumen.periodoLabel,
      },
      resumen,
      detalle,
    },
  };
}

module.exports = {
  obtenerObjetivosBackendService,
  obtenerTodosLosObjetivosService,
  guardarObjetivosBackendService,
  guardarObjetivoEspecialService,
  obtenerReporteConsolidadoService,
  obtenerTodasLasComisionesService,
  obtenerComisionesVendedorService,
};
