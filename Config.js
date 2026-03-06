/**
 * Configuración CONFIG-CAJA, CONFIG-COTIZACIONES, conceptos, descripciones, medios de pago y egresos proyectados.
 */
function obtenerConfiguracion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG-CAJA');
  let config = {};

  if (sheet) {
    const datos = sheet.getDataRange().getValues();
    for (let i = 1; i < datos.length; i++) {
      let tipo = datos[i][0];
      let nombre = datos[i][1];
      let padre = datos[i][2];
      let pais = datos[i][3] || 'ARGENTINA';
      let sentido = datos[i][4] || 'EGRESO';

      if (!config[pais]) {
        config[pais] = { conceptos: [], medios: [], descripciones: {}, sentidos: {} };
      }

      if (tipo === 'CONCEPTO') {
        config[pais].conceptos.push(nombre);
        config[pais].sentidos[nombre] = sentido;
      }
      if (tipo === 'MEDIO_PAGO') config[pais].medios.push(nombre);
      if (tipo === 'DESCRIPCION') {
        if (!config[pais].descripciones[padre]) config[pais].descripciones[padre] = [];
        config[pais].descripciones[padre].push(nombre);
      }
    }
  }
  return { error: false, data: config };
}

function obtenerConceptosPorPais(pais) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG-CAJA');
  if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };

  let paisNormalizado = pais ? pais.toString().toUpperCase().trim() : "";
  if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
  if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';

  const datos = sheet.getDataRange().getValues();
  let conceptos = [];

  for (let i = 1; i < datos.length; i++) {
    let tipo = datos[i][0];
    let nombre = datos[i][1];
    let paisFila = datos[i][3] ? datos[i][3].toString().toUpperCase().trim() : "";
    if (paisFila === 'USA') paisFila = 'EEUU';
    if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';
    if (tipo === 'CONCEPTO' && paisFila === paisNormalizado) {
      conceptos.push(nombre);
    }
  }

  return { error: false, data: conceptos };
}

function obtenerDescripcionesPorPaisConcepto(pais, concepto) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG-CAJA');
  if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };

  let paisNormalizado = pais ? pais.toString().toUpperCase().trim() : "";
  if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
  if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';

  const datos = sheet.getDataRange().getValues();
  let descripciones = [];

  for (let i = 1; i < datos.length; i++) {
    let tipo = datos[i][0];
    let nombre = datos[i][1];
    let padre = datos[i][2];
    let paisFila = datos[i][3] ? datos[i][3].toString().toUpperCase().trim() : "";
    if (paisFila === 'USA') paisFila = 'EEUU';
    if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';
    if (tipo === 'DESCRIPCION' && padre === concepto && paisFila === paisNormalizado) {
      descripciones.push(nombre);
    }
  }

  return { error: false, data: descripciones };
}

function obtenerMediosPorPais(pais) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG-CAJA');
  if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };

  let paisNormalizado = pais ? pais.toString().toUpperCase().trim() : "";
  if (paisNormalizado === 'USA') paisNormalizado = 'EEUU';
  if (paisNormalizado === 'ESPAÑA') paisNormalizado = 'ESPANA';

  const datos = sheet.getDataRange().getValues();
  let medios = [];

  for (let i = 1; i < datos.length; i++) {
    let tipo = datos[i][0];
    let nombre = datos[i][1];
    let paisFila = datos[i][3] ? datos[i][3].toString().toUpperCase().trim() : "";
    if (paisFila === 'USA') paisFila = 'EEUU';
    if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';
    if (tipo === 'MEDIO_PAGO' && paisFila === paisNormalizado) {
      medios.push(nombre);
    }
  }

  return { error: false, data: medios };
}

function obtenerCotizacionesConCache() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'cotizaciones';
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG-COTIZACIONES');
  if (!sheet) return {};

  const datos = sheet.getDataRange().getValues();
  let cotizaciones = {};
  for (let j = 1; j < datos.length; j++) {
    let paisCot = datos[j][0].toString().toUpperCase();
    if (paisCot === 'ESPAÑA') paisCot = 'ESPANA';
    let factor = parseFloat(datos[j][2]);
    if (!isNaN(factor)) {
      cotizaciones[paisCot] = factor;
    }
  }

  try {
    cache.put(cacheKey, JSON.stringify(cotizaciones), 1800);
  } catch (e) {}

  return cotizaciones;
}

function obtenerCotizacionesBackend() {
  const cotizaciones = obtenerCotizacionesConCache();
  if (Object.keys(cotizaciones).length === 0) {
    return { error: true, mensaje: "Falta hoja CONFIG-COTIZACIONES" };
  }
  return { error: false, data: cotizaciones };
}

function guardarItemConfig(tipo, nombre, padre, pais, sentido) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG-CAJA');
  if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };
  sheet.appendRow([tipo, nombre, padre || '', pais || 'ARGENTINA', sentido || '']);
  let esConceptoEgreso = (tipo === 'CONCEPTO' && (sentido || '').toString().toUpperCase() === 'EGRESO');
  let esDescripcion = (tipo === 'DESCRIPCION' && padre);
  if (esConceptoEgreso || esDescripcion) {
    agregarNuevoConceptoDescripcionAMovimientos(tipo, nombre, padre || '', pais || 'ARGENTINA');
  }
  return { error: false };
}

function agregarNuevoConceptoDescripcionAMovimientos(tipo, nombre, padre, pais) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCaja = ss.getSheetByName('CAJA');
  if (!sheetCaja) return;
  const hoy = new Date();
  const mesInicio = hoy.getMonth() + 1;
  const anio = 2026;
  let concepto = tipo === 'CONCEPTO' ? nombre : (padre || '');
  let descripcion = tipo === 'DESCRIPCION' ? nombre : '';
  let paisNorm = (pais || 'ARGENTINA').toString().toUpperCase().trim();
  if (paisNorm === 'USA') paisNorm = 'EEUU';
  if (paisNorm === 'ESPAÑA') paisNorm = 'ESPANA';

  const datosCaja = sheetCaja.getDataRange().getValues();
  let cargados = {};
  for (let i = 1; i < datosCaja.length; i++) {
    let fecha = datosCaja[i][0];
    let tipoMov = (datosCaja[i][1] || '').toString();
    let conc = (datosCaja[i][2] || '').toString().trim();
    let desc = (datosCaja[i][3] || '').toString().trim();
    let paisFila = (datosCaja[i][9] || '').toString().toUpperCase().trim();
    if (paisFila === 'USA') paisFila = 'EEUU';
    if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';
    if (tipoMov !== 'EGRESO') continue;
    let mesFila = -1;
    let anioFila = -1;
    if (Object.prototype.toString.call(fecha) === '[object Date]') {
      mesFila = fecha.getMonth() + 1;
      anioFila = fecha.getFullYear();
    } else if (typeof fecha === 'string' && fecha) {
      let partes = fecha.split('/');
      if (partes.length === 3) {
        mesFila = parseInt(partes[1], 10) || 0;
        anioFila = parseInt(partes[2], 10) || 0;
      }
    }
    if (mesFila >= 1 && anioFila === anio && conc === concepto && desc === descripcion && paisFila === paisNorm) {
      cargados[mesFila] = true;
    }
  }

  for (let mes = mesInicio; mes <= 12; mes++) {
    if (cargados[mes]) continue;
    let fechaStr = '01/' + ('0' + mes).slice(-2) + '/' + anio;
    sheetCaja.appendRow([fechaStr, 'EGRESO', concepto, descripcion, '', 0, '', 'PENDIENTE', '', paisNorm, '']);
  }
}

function borrarItemConfig(tipo, nombre, pais, padre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG-CAJA');
  if (!sheet) return { error: true, mensaje: "Falta hoja CONFIG-CAJA" };

  if (tipo === 'CONCEPTO' || tipo === 'DESCRIPCION') {
    let conceptoParaCaja = (tipo === 'CONCEPTO') ? nombre : (padre || '');
    let descripcionParaCaja = (tipo === 'CONCEPTO') ? '' : nombre;
    eliminarEgresosNoUsadosDeCaja(conceptoParaCaja, descripcionParaCaja, pais);
  }

  const datos = sheet.getDataRange().getValues();
  for (let i = datos.length - 1; i >= 1; i--) {
    if (datos[i][0] === tipo && datos[i][1] === nombre && (datos[i][3] || 'ARGENTINA') === pais) {
      sheet.deleteRow(i + 1);
      return { error: false };
    }
  }

  return { error: true, mensaje: "No encontrado" };
}

function eliminarEgresosNoUsadosDeCaja(concepto, descripcion, pais) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCaja = ss.getSheetByName('CAJA');
  if (!sheetCaja) return;

  let paisNorm = (pais || 'ARGENTINA').toString().toUpperCase().trim();
  if (paisNorm === 'USA') paisNorm = 'EEUU';
  if (paisNorm === 'ESPAÑA') paisNorm = 'ESPANA';

  const datos = sheetCaja.getDataRange().getValues();
  const filasAEliminar = [];

  for (let i = 1; i < datos.length; i++) {
    let fila = datos[i];
    let tipoMov = fila[1] ? fila[1].toString().toUpperCase() : '';
    let conceptoFila = (fila[2] || '').toString().trim();
    let descFila = (fila[3] || '').toString().trim();
    let paisFila = (fila[9] || '').toString().toUpperCase().trim();
    if (paisFila === 'USA') paisFila = 'EEUU';
    if (paisFila === 'ESPAÑA') paisFila = 'ESPANA';

    let monto = parseFloat(fila[5]) || 0;
    let estado = (fila[7] || '').toString().toUpperCase().trim();

    if (tipoMov === 'EGRESO' && conceptoFila === concepto && descFila === descripcion && paisFila === paisNorm) {
      if (estado === 'PENDIENTE' && monto === 0) {
        filasAEliminar.push(i + 1);
      }
    }
  }

  for (let j = filasAEliminar.length - 1; j >= 0; j--) {
    sheetCaja.deleteRow(filasAEliminar[j]);
  }
}

function generarEgresosProyectadosMes(mes, anio) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCaja = ss.getSheetByName('CAJA');
  const sheetConfig = ss.getSheetByName('CONFIG-CAJA');
  if (!sheetCaja || !sheetConfig) return { error: true, mensaje: "Faltan hojas críticas" };

  const hoy = new Date();
  const mesActual = mes || (hoy.getMonth() + 1);
  const anioActual = anio || hoy.getFullYear();
  const fechaInicioStr = `01/${('0' + mesActual).slice(-2)}/${anioActual}`;

  const datosConfig = sheetConfig.getDataRange().getValues();
  let egresosConfig = [];
  let descripcionesMap = {};

  for (let i = 1; i < datosConfig.length; i++) {
    let tipoConfig = datosConfig[i][0];
    let nombre = datosConfig[i][1];
    let padre = datosConfig[i][2];
    let pais = datosConfig[i][3] || 'ARGENTINA';
    let sentido = datosConfig[i][4] || 'EGRESO';

    if (tipoConfig === 'CONCEPTO' && sentido === 'EGRESO') {
      if (!egresosConfig.find(e => e.concepto === nombre && e.pais === pais)) {
        egresosConfig.push({ concepto: nombre, pais: pais, descripciones: [] });
      }
    } else if (tipoConfig === 'DESCRIPCION' && padre) {
      if (!descripcionesMap[padre]) descripcionesMap[padre] = [];
      descripcionesMap[padre].push(nombre);
    }
  }

  egresosConfig.forEach(eg => {
    eg.descripciones = descripcionesMap[eg.concepto] || [];
    if (eg.descripciones.length === 0) eg.descripciones.push('');
  });

  const datosCaja = sheetCaja.getDataRange().getValues();
  let cargados = {};

  for (let i = 1; i < datosCaja.length; i++) {
    let fecha = datosCaja[i][0];
    let tipoMov = datosCaja[i][1];
    let concepto = datosCaja[i][2];
    let descripcion = datosCaja[i][3] || '';
    let paisCaja = datosCaja[i][9];

    if (!fecha) continue;

    let mesFila = -1;
    let anioFila = -1;
    if (Object.prototype.toString.call(fecha) === '[object Date]') {
      mesFila = fecha.getMonth() + 1;
      anioFila = fecha.getFullYear();
    } else if (typeof fecha === 'string') {
      let partes = fecha.split('/');
      if (partes.length === 3) {
        mesFila = parseInt(partes[1]);
        anioFila = parseInt(partes[2]);
      }
    }

    if (mesFila === mesActual && anioFila === anioActual && tipoMov === 'EGRESO') {
      cargados[`${paisCaja}-${concepto}-${descripcion}`] = true;
    }
  }

  let contador = 0;
  egresosConfig.forEach(eg => {
    eg.descripciones.forEach(desc => {
      let key = `${eg.pais}-${eg.concepto}-${desc}`;
      if (!cargados[key]) {
        sheetCaja.appendRow([
          fechaInicioStr, 'EGRESO', eg.concepto, desc, 'Efectivo', 0,
          'MONTO A CONFIRMAR', 'PENDIENTE', '', eg.pais, ''
        ]);
        contador++;
      }
    });
  });

  return { error: false, mensaje: `Se generaron ${contador} egresos proyectados para el mes.` };
}

function generarEgresosProyectadosAnual(anio) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCaja = ss.getSheetByName('CAJA');
  const sheetConfig = ss.getSheetByName('CONFIG-CAJA');
  if (!sheetCaja || !sheetConfig) return { error: true, mensaje: "Faltan hojas críticas" };

  const anioUsar = anio || 2026;

  const datosConfig = sheetConfig.getDataRange().getValues();
  let egresosConfig = [];
  let descripcionesMap = {};
  for (let i = 1; i < datosConfig.length; i++) {
    let tipoConfig = datosConfig[i][0];
    let nombre = datosConfig[i][1];
    let padre = datosConfig[i][2];
    let pais = datosConfig[i][3] || 'ARGENTINA';
    let sentido = datosConfig[i][4] || 'EGRESO';
    if (tipoConfig === 'CONCEPTO' && sentido === 'EGRESO') {
      if (!egresosConfig.find(e => e.concepto === nombre && e.pais === pais)) {
        egresosConfig.push({ concepto: nombre, pais: pais, descripciones: [] });
      }
    } else if (tipoConfig === 'DESCRIPCION' && padre) {
      if (!descripcionesMap[padre]) descripcionesMap[padre] = [];
      descripcionesMap[padre].push(nombre);
    }
  }
  egresosConfig.forEach(eg => {
    eg.descripciones = descripcionesMap[eg.concepto] || [];
    if (eg.descripciones.length === 0) eg.descripciones.push('');
  });

  const datosCaja = sheetCaja.getDataRange().getValues();
  let cargados = {};
  for (let i = 1; i < datosCaja.length; i++) {
    let fecha = datosCaja[i][0];
    let tipoMov = (datosCaja[i][1] || '').toString();
    let concepto = (datosCaja[i][2] || '').toString();
    let descripcion = (datosCaja[i][3] || '').toString();
    let paisCaja = (datosCaja[i][9] || 'ARGENTINA').toString().trim().toUpperCase();
    if (!fecha || tipoMov !== 'EGRESO') continue;
    let mesFila = -1;
    let anioFila = -1;
    if (Object.prototype.toString.call(fecha) === '[object Date]') {
      mesFila = fecha.getMonth() + 1;
      anioFila = fecha.getFullYear();
    } else if (typeof fecha === 'string') {
      let partes = fecha.split('/');
      if (partes.length === 3) {
        mesFila = parseInt(partes[1], 10) || 0;
        anioFila = parseInt(partes[2], 10) || 0;
      }
    }
    if (mesFila >= 1 && mesFila <= 12 && anioFila === anioUsar) {
      let pk = (paisCaja === 'USA') ? 'EEUU' : (paisCaja === 'ESPAÑA' ? 'ESPANA' : paisCaja);
      cargados[`${mesFila}-${pk}-${concepto}-${descripcion}`] = true;
    }
  }

  let filasAInsertar = [];
  for (let mes = 1; mes <= 12; mes++) {
    let fechaStr = `01/${('0' + mes).slice(-2)}/${anioUsar}`;
    egresosConfig.forEach(eg => {
      let paisNorm = (eg.pais || 'ARGENTINA').toString().trim().toUpperCase();
      if (paisNorm === 'USA') paisNorm = 'EEUU';
      eg.descripciones.forEach(desc => {
        let key = `${mes}-${paisNorm}-${eg.concepto}-${desc}`;
        if (!cargados[key]) {
          filasAInsertar.push([
            fechaStr, 'EGRESO', eg.concepto, desc, 'Efectivo', 0,
            'MONTO A CONFIRMAR', 'PENDIENTE', '', eg.pais, ''
          ]);
        }
      });
    });
  }

  let contador = 0;
  const batchSize = 500;
  for (let i = 0; i < filasAInsertar.length; i += batchSize) {
    let lote = filasAInsertar.slice(i, i + batchSize);
    lote.forEach(fila => {
      sheetCaja.appendRow(fila);
      contador++;
    });
  }
  return { error: false, mensaje: `Se generaron ${contador} egresos proyectados para el año.` };
}
