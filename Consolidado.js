// --- 9. CONSOLIDADO ---
function obtenerReporteConsolidado(anio) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  anio = 2026;

  let listaVendedores = obtenerListaVendedores();
  let todosVendedores = [...(listaVendedores.activos || []), ...(listaVendedores.inactivos || [])];
  let nombresVendedores = todosVendedores.map(v => v.nombre).filter(n => n);

  if (nombresVendedores.length === 0) {
    nombresVendedores = ['ADRIAN', 'NATALIA', 'MARIA LAURA', 'HERNAN', 'NESTOR', 'MARISOL', 'UNIVERSAL JUMPS'];
  }

  const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

  const sheetCotizaciones = ss.getSheetByName('CONFIG-COTIZACIONES');
  let cotizaciones = {};
  if (sheetCotizaciones) {
    const datosCotizaciones = sheetCotizaciones.getDataRange().getValues();
    for (let j = 1; j < datosCotizaciones.length; j++) {
      let paisCot = datosCotizaciones[j][0].toString().toUpperCase();
      if (paisCot === 'ESPAÑA') paisCot = 'ESPANA';
      let factor = parseFloat(datosCotizaciones[j][2]);
      if (!isNaN(factor)) {
        cotizaciones[paisCot] = factor;
      }
    }
  }

  let reporte = {};
  meses.forEach(m => {
    reporte[m] = {
      ARGENTINA: { EFECTIVO: 0, BANCO: 0, CTACTE: 0, MP: 0, TOTAL: 0 },
      CHILE: 0, MEXICO: 0, ESPANA: 0, BRASIL: 0, URUGUAY: 0, RDM: 0, EEUU: 0
    };
  });

  nombresVendedores.forEach(v => {
    let sheet = ss.getSheetByName(v);
    if (sheet) {
      let lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;

      let colFechas = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      let colPaises = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
      let colPagos = sheet.getRange(2, 7, lastRow - 1, 1).getValues();
      let colMontos = sheet.getRange(2, 10, lastRow - 1, 1).getValues();
      let colCotizaciones = sheet.getRange(2, 13, lastRow - 1, 1).getValues();

      for (let i = 0; i < colFechas.length; i++) {
        let fecha = colFechas[i][0];
        if (!fecha) continue;

        let mesIndex = -1;
        let anioFila = -1;
        if (Object.prototype.toString.call(fecha) === '[object Date]') {
          mesIndex = fecha.getMonth();
          anioFila = fecha.getFullYear();
        } else if (typeof fecha === 'string') {
          let partes = fecha.split('/');
          if (partes.length === 3) {
            mesIndex = parseInt(partes[1]) - 1;
            anioFila = parseInt(partes[2]);
          }
        }

        if (anioFila !== anio) continue;

        if (mesIndex >= 0 && mesIndex < 12) {
          let mesNombre = meses[mesIndex];
          let pais = colPaises[i][0] ? colPaises[i][0].toString().toUpperCase().trim() : "";
          if (pais === 'USA') pais = 'EEUU';
          if (pais === 'ESPAÑA') pais = 'ESPANA';

          let pago = colPagos[i][0] ? colPagos[i][0].toString().toUpperCase() : "";

          let montoVal = colMontos[i][0];
          if (typeof montoVal === 'string') {
            montoVal = parseFloat(montoVal.replace(/[$.]/g, '').replace(',', '.').trim());
          }
          let monto = parseFloat(montoVal) || 0;

          let cotizacionUsada = colCotizaciones[i][0];
          if (!cotizacionUsada || isNaN(cotizacionUsada) || cotizacionUsada <= 0) {
            cotizacionUsada = cotizaciones[pais] || 1;
          } else {
            cotizacionUsada = parseFloat(cotizacionUsada);
          }

          let montoEnArs = monto;
          if (pais !== 'ARGENTINA') {
            montoEnArs = monto * cotizacionUsada;
          }

          if (pais === 'ARGENTINA') {
            if (pago.includes('EFECTIVO')) reporte[mesNombre].ARGENTINA.EFECTIVO += montoEnArs;
            else if (pago.includes('TRANSFERENCIA') || pago.includes('BANCO')) reporte[mesNombre].ARGENTINA.BANCO += montoEnArs;
            else if (pago.includes('CTA') || pago.includes('CORRIENTE')) reporte[mesNombre].ARGENTINA.CTACTE += montoEnArs;
            else if (pago.includes('MERCADO')) reporte[mesNombre].ARGENTINA.MP += montoEnArs;

            reporte[mesNombre].ARGENTINA.TOTAL += montoEnArs;
          } else {
            if (reporte[mesNombre][pais] !== undefined) {
              reporte[mesNombre][pais] += montoEnArs;
            }
          }
        }
      }
    }
  });

  return { error: false, data: reporte };
}

function obtenerComisionesTrimestre(trimestre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let listaVendedores = obtenerListaVendedores();
  let todosVendedores = [...(listaVendedores.activos || []), ...(listaVendedores.inactivos || [])];

  let cotizaciones = obtenerCotizacionesConCache();

  let mesesTrim = [];
  if (trimestre === 'T1') mesesTrim = [0, 1, 2];
  else if (trimestre === 'T2') mesesTrim = [3, 4, 5];
  else if (trimestre === 'T3') mesesTrim = [6, 7, 8];
  else if (trimestre === 'T4') mesesTrim = [9, 10, 11];

  let ventas = {};

  todosVendedores.forEach(v => {
    let sheet = ss.getSheetByName(v.nombre);
    if (!sheet) {
      ventas[v.nombre] = { mes1: 0, mes2: 0, mes3: 0 };
      return;
    }

    let datos = sheet.getDataRange().getValues();
    let totales = { mes1: 0, mes2: 0, mes3: 0 };

    for (let i = 1; i < datos.length; i++) {
      let fila = datos[i];
      let fecha = fila[0];
      if (!fecha) continue;

      let mesIndex = -1;
      if (Object.prototype.toString.call(fecha) === '[object Date]') {
        mesIndex = fecha.getMonth();
      } else if (typeof fecha === 'string') {
        let partes = fecha.split('/');
        if (partes.length === 3) mesIndex = parseInt(partes[1]) - 1;
      }

      if (mesesTrim.includes(mesIndex)) {
        let pais = fila[3] ? fila[3].toString().toUpperCase().trim() : "";
        if (pais === 'USA') pais = 'EEUU';
        if (pais === 'ESPAÑA') pais = 'ESPANA';

        let montoVal = fila[9];
        if (typeof montoVal === 'string') {
          montoVal = parseFloat(montoVal.replace(/[$.]/g, '').replace(',', '.').trim());
        }
        let monto = parseFloat(montoVal) || 0;

        if (pais !== 'ARGENTINA' && cotizaciones[pais]) {
          monto = monto * cotizaciones[pais];
        }

        let mesPos = mesesTrim.indexOf(mesIndex);
        if (mesPos === 0) totales.mes1 += monto;
        else if (mesPos === 1) totales.mes2 += monto;
        else if (mesPos === 2) totales.mes3 += monto;
      }
    }

    ventas[v.nombre] = totales;
  });

  return { error: false, vendedores: todosVendedores, ventas: ventas };
}

function obtenerTodasLasComisiones() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const anioFiltro = 2026;

  let listaVendedores = obtenerListaVendedores();
  let todosVendedores = [...(listaVendedores.activos || []), ...(listaVendedores.inactivos || [])];

  const sheetCotizaciones = ss.getSheetByName('CONFIG-COTIZACIONES');
  let cotizaciones = {};
  if (sheetCotizaciones) {
    const datosCotizaciones = sheetCotizaciones.getDataRange().getValues();
    for (let i = 1; i < datosCotizaciones.length; i++) {
      let pais = datosCotizaciones[i][0].toString().toUpperCase();
      if (pais === 'ESPAÑA') pais = 'ESPANA';
      let factor = parseFloat(datosCotizaciones[i][2]);
      if (!isNaN(factor)) {
        cotizaciones[pais] = factor;
      }
    }
  }

  const sheetObjetivos = ss.getSheetByName('CONFIG-OBJETIVOS');
  let objetivos = {};
  let objetivosEspeciales = {};
  if (sheetObjetivos) {
    const datosObjetivos = sheetObjetivos.getDataRange().getValues();
    for (let i = 1; i < datosObjetivos.length; i++) {
      let trimestre = datosObjetivos[i][0];
      let identificador = datosObjetivos[i][2];
      if (trimestre && !isNaN(identificador)) {
        if (!objetivos[trimestre]) objetivos[trimestre] = [];
        objetivos[trimestre].push({
          rango: parseInt(identificador),
          factBotas: parseFloat(datosObjetivos[i][7]) || 0,
          factCerts: parseFloat(datosObjetivos[i][8]) || 0
        });
      } else if (trimestre && identificador) {
        let nombreVendedor = identificador.toString().trim();
        if (!objetivosEspeciales[trimestre]) objetivosEspeciales[trimestre] = {};
        objetivosEspeciales[trimestre][nombreVendedor] = {
          factBotas: parseFloat(datosObjetivos[i][7]) || 0,
          factCerts: parseFloat(datosObjetivos[i][8]) || 0
        };
      }
    }
    Object.keys(objetivos).forEach(t => {
      objetivos[t].sort((a, b) => a.rango - b.rango);
    });
  }

  const trimestres = [
    { key: 'T1', nombre: '1° TRIMESTRE', meses: [0, 1, 2], nombresMeses: ['ENERO', 'FEBRERO', 'MARZO'], trimestreObj: 'OBJETIVOS 1°T' },
    { key: 'T2', nombre: '2° TRIMESTRE', meses: [3, 4, 5], nombresMeses: ['ABRIL', 'MAYO', 'JUNIO'], trimestreObj: 'OBJETIVOS 2°T' },
    { key: 'T3', nombre: '3° TRIMESTRE', meses: [6, 7, 8], nombresMeses: ['JULIO', 'AGOSTO', 'SEPTIEMBRE'], trimestreObj: 'OBJETIVOS 3°T' },
    { key: 'T4', nombre: '4° TRIMESTRE', meses: [9, 10, 11], nombresMeses: ['OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'], trimestreObj: 'OBJETIVOS 4°T' }
  ];

  let resultado = {};

  trimestres.forEach(trim => {
    let ventasTrim = {};

    todosVendedores.forEach(v => {
      let sheet = ss.getSheetByName(v.nombre);
      if (!sheet) {
        ventasTrim[v.nombre] = {
          mes1: 0, mes2: 0, mes3: 0,
          nombreMes1: trim.nombresMeses[0],
          nombreMes2: trim.nombresMeses[1],
          nombreMes3: trim.nombresMeses[2],
          total: 0,
          rangoMes1: 0,
          porcentajeMes1: 0,
          rangoMes2: 0,
          porcentajeMes2: 0,
          rangoMes3: 0,
          porcentajeMes3: 0
        };
        return;
      }

      let datos = sheet.getDataRange().getValues();
      let totales = { mes1: 0, mes2: 0, mes3: 0 };

      for (let i = 1; i < datos.length; i++) {
        let fila = datos[i];
        let fecha = fila[0];
        if (!fecha) continue;

        let mesIndex = -1;
        let anioFila = -1;
        if (Object.prototype.toString.call(fecha) === '[object Date]') {
          mesIndex = fecha.getMonth();
          anioFila = fecha.getFullYear();
        } else if (typeof fecha === 'string') {
          let partes = fecha.split('/');
          if (partes.length === 3) {
            mesIndex = parseInt(partes[1]) - 1;
            anioFila = parseInt(partes[2]);
          }
        }

        if (anioFila !== anioFiltro) continue;

        if (trim.meses.includes(mesIndex)) {
          let pais = fila[3] ? fila[3].toString().toUpperCase().trim() : "";
          if (pais === 'USA') pais = 'EEUU';
          if (pais === 'ESPAÑA') pais = 'ESPANA';

          let montoVal = fila[9];
          if (typeof montoVal === 'string') {
            montoVal = parseFloat(montoVal.replace(/[$.]/g, '').replace(',', '.').trim());
          }
          let monto = parseFloat(montoVal) || 0;

          let cotizacionUsada = fila[12];
          if (!cotizacionUsada || isNaN(cotizacionUsada) || cotizacionUsada <= 0) {
            cotizacionUsada = cotizaciones[pais] || 1;
          } else {
            cotizacionUsada = parseFloat(cotizacionUsada);
          }

          if (pais !== 'ARGENTINA') {
            monto = monto * cotizacionUsada;
          }

          let mesPos = trim.meses.indexOf(mesIndex);
          if (mesPos === 0) totales.mes1 += monto;
          else if (mesPos === 1) totales.mes2 += monto;
          else if (mesPos === 2) totales.mes3 += monto;
        }
      }

      let total = totales.mes1 + totales.mes2 + totales.mes3;
      let objsTrim = objetivos[trim.trimestreObj] || [];

      let objetivoEspecialVendedor = null;
      if (objetivosEspeciales[trim.trimestreObj] && objetivosEspeciales[trim.trimestreObj][v.nombre]) {
        objetivoEspecialVendedor = objetivosEspeciales[trim.trimestreObj][v.nombre];
      }

      function calcularRangoPorcentajeMes(montoMes) {
        let rangoMes = 0;
        let porcentajeMes = 0;

        if (objetivoEspecialVendedor) {
          let objetivoMensual = objetivoEspecialVendedor.factBotas / 3;
          if (objetivoMensual > 0) {
            porcentajeMes = (montoMes / objetivoMensual) * 100;
            if (porcentajeMes > 100) porcentajeMes = 100;
            rangoMes = porcentajeMes >= 100 ? 1 : 0;
          }
        } else if (objsTrim.length > 0) {
          for (let i = objsTrim.length - 1; i >= 0; i--) {
            let obj = objsTrim[i];
            let objetivoMensual = obj.factBotas / 3;
            if (montoMes >= objetivoMensual && objetivoMensual > 0) {
              rangoMes = obj.rango;
              break;
            }
          }

          if (rangoMes > 0 && rangoMes <= objsTrim.length) {
            let objActual = objsTrim.find(o => o.rango === rangoMes);
            if (objActual && objActual.factBotas > 0) {
              let objetivoMensual = objActual.factBotas / 3;
              porcentajeMes = (montoMes / objetivoMensual) * 100;
              if (porcentajeMes > 100) porcentajeMes = 100;
            }
          } else if (objsTrim.length > 0) {
            let objRango1 = objsTrim[0];
            if (objRango1 && objRango1.factBotas > 0) {
              let objetivoMensual = objRango1.factBotas / 3;
              porcentajeMes = (montoMes / objetivoMensual) * 100;
            }
          }
        }

        return { rango: rangoMes, porcentaje: porcentajeMes };
      }

      let mes1Calc = calcularRangoPorcentajeMes(totales.mes1);
      let mes2Calc = calcularRangoPorcentajeMes(totales.mes2);
      let mes3Calc = calcularRangoPorcentajeMes(totales.mes3);

      ventasTrim[v.nombre] = {
        mes1: totales.mes1,
        mes2: totales.mes2,
        mes3: totales.mes3,
        nombreMes1: trim.nombresMeses[0],
        nombreMes2: trim.nombresMeses[1],
        nombreMes3: trim.nombresMeses[2],
        total: total,
        rangoMes1: mes1Calc.rango,
        porcentajeMes1: mes1Calc.porcentaje,
        rangoMes2: mes2Calc.rango,
        porcentajeMes2: mes2Calc.porcentaje,
        rangoMes3: mes3Calc.rango,
        porcentajeMes3: mes3Calc.porcentaje
      };
    });

    resultado[trim.key] = {
      nombre: trim.nombre,
      vendedores: todosVendedores,
      ventas: ventasTrim
    };
  });

  return { error: false, data: resultado };
}
