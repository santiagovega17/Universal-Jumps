// --- 11. STOCK / INVENTARIO Y MARCAS ---

/**
 * Función para obtener el stock actual de botas
 * Lee STOCK_DEFINICION y STOCK_MOVIMIENTOS, calcula el stock agrupado por ID de producto y Talle
 * Retorna una lista de productos con sus datos fijos y cantidades disponibles por cada talle
 * Nueva estructura STOCK_DEFINICION: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
 * Estructura STOCK_MOVIMIENTOS: A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION USUARIO, G:(vacía), H:PAIS
 * @param {String} pais - País para filtrar (opcional, por defecto ARGENTINA)
 * @returns {Object} - Resultado con lista de productos y stock por talle
 */
function obtenerStockBotas(pais) {
  // Si no se proporciona país, usar ARGENTINA por defecto
  if (!pais || pais.toString().trim() === '') {
    pais = 'ARGENTINA';
  }
  pais = pais.toString().trim().toUpperCase();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Obtener hoja de definiciones (catálogo)
    const sheetDefiniciones = ss.getSheetByName('STOCK_DEFINICION');
    if (!sheetDefiniciones) {
      return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
    }

    // 2. Obtener hoja de movimientos (historial)
    const sheetMovimientos = ss.getSheetByName('STOCK_MOVIMIENTOS');
    if (!sheetMovimientos) {
      return { error: true, mensaje: "No existe la hoja 'STOCK_MOVIMIENTOS'" };
    }

    // 3. Leer datos de definiciones
    // Nueva estructura: A:ID, B:MARCA, C:MODELO, D:COLOR, E:DESCRIPCION, F:IMAGEN_URL, G:ACTIVO
    const datosDefiniciones = sheetDefiniciones.getDataRange().getValues();
    if (datosDefiniciones.length <= 1) {
      return { error: false, data: [] }; // No hay productos definidos
    }

    // Crear un mapa de productos por ID para acceso rápido
    // Estructura nueva: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
    // Compatible con estructuras antiguas (8 cols sin TIPO/DIVIDE_TALLES, 7 cols sin MARCA)
    const productos = {};
    for (let i = 1; i < datosDefiniciones.length; i++) {
      const fila = datosDefiniciones[i];
      const id = fila[0] ? fila[0].toString().trim() : '';
      if (!id) continue;
      const tieneEstructuraNueva = fila.length >= 10; // ID,MARCA,TIPO,MODELO,COLOR,DESC,IMAGEN,ACTIVO,DIVIDE_TALLES,PAIS
      const tieneMarcaYTipo = fila.length >= 9;
      const paisProducto = (fila.length >= 10 && fila[9]) ? fila[9].toString().trim().toUpperCase() :
                          (fila.length >= 8 && fila[7]) ? fila[7].toString().trim().toUpperCase() : 'ARGENTINA';
      if (paisProducto !== pais) continue;

      productos[id] = {
        id: id,
        marca: (fila.length >= 7 && fila[1]) ? (fila[1] || '').toString().trim() : '',
        tipo: tieneEstructuraNueva ? (fila[2] || '').toString().trim() : (tieneMarcaYTipo ? (fila[2] || '').toString().trim() : ''),
        modelo: tieneEstructuraNueva ? (fila[3] || '').toString().trim() : (fila.length >= 7 ? (fila[2] || '') : (fila[1] || '')).toString().trim(),
        color: tieneEstructuraNueva ? (fila[4] || '').toString().trim() : (fila.length >= 7 ? (fila[3] || '') : (fila[2] || '')).toString().trim(),
        descripcion: tieneEstructuraNueva ? (fila[5] || '').toString().trim() : (fila.length >= 7 ? (fila[4] || '') : (fila[3] || '')).toString().trim(),
        imagenUrl: tieneEstructuraNueva ? (fila[6] || '').toString().trim() : (fila.length >= 7 ? (fila[5] || '') : (fila[4] || '')).toString().trim(),
        activo: (tieneEstructuraNueva ? (fila[7] || 'SI') : (fila.length >= 7 ? (fila[6] || 'SI') : (fila[5] || 'SI'))).toString().toUpperCase(),
        divideTalles: tieneEstructuraNueva ? ((fila[8] || 'SI').toString().toUpperCase() === 'NO' ? 'NO' : 'SI') : 'SI',
        pais: paisProducto
      };
    }

    // 4. Leer datos de movimientos y calcular stock (talle vacío = UNICO para productos sin talles)
    const datosMovimientos = sheetMovimientos.getDataRange().getValues();

    // Estructura para acumular stock: { "id-talle": cantidad }
    const stockAcumulado = {};

    for (let i = 1; i < datosMovimientos.length; i++) {
      const fila = datosMovimientos[i];
      if (!fila[0] || !fila[1]) continue; // Saltar filas sin fecha o sin ID

      const idProducto = fila[1] ? fila[1].toString().trim() : '';
      let talle = fila[2] ? fila[2].toString().trim() : '';
      if (!idProducto) continue;
      if (!talle) talle = 'UNICO'; // Productos sin talles usan UNICO

      // Obtener país del movimiento (columna G, índice 6)
      const paisMovimiento = (fila.length >= 7 && fila[6]) ? fila[6].toString().trim().toUpperCase() : 'ARGENTINA';

      // Filtrar por país: solo incluir movimientos del país seleccionado
      if (paisMovimiento !== pais) {
        continue;
      }

      // Obtener tipo y cantidad
      const tipo = fila[3] ? fila[3].toString().trim().toUpperCase() : '';  // Columna D: TIPO
      let cantidad = parseFloat(fila[4]) || 0;                               // Columna E: CANTIDAD

      // Si el tipo es EGRESO y la cantidad es positiva, convertirla a negativa
      // Esto asegura que la matemática funcione correctamente
      if (tipo === 'EGRESO' && cantidad > 0) {
        cantidad = -cantidad;
      }

      // Clave única: "id-talle"
      const clave = `${idProducto}-${talle}`;

      // Inicializar si no existe
      if (!stockAcumulado[clave]) {
        stockAcumulado[clave] = 0;
      }

      // Sumar la cantidad (puede ser positiva o negativa)
      stockAcumulado[clave] += cantidad;
    }

    // 5. Combinar datos de productos con stock por talle
    const resultado = [];

    for (const id in productos) {
      const producto = productos[id];

      // Buscar todos los talles de este producto
      const talles = {};
      for (const clave in stockAcumulado) {
        const partes = clave.split('-');
        if (partes.length >= 2 && partes[0] === id) {
          // Reconstruir el talle (por si contiene guiones)
          const talle = partes.slice(1).join('-');
          talles[talle] = stockAcumulado[clave];
        }
      }

      // Si no hay movimientos, el producto aparece con talles vacíos
      // Estructura del resultado:
      // { id, modelo, color, descripcion, imagenUrl, activo, talles: { "38": 5, "39": 3, ... } }
      resultado.push({
        ...producto,
        talles: talles
      });
    }

    return { error: false, data: resultado };

  } catch (e) {
    return { error: true, mensaje: "Error al obtener stock: " + e.toString() };
  }
}

/**
 * Función para crear un nuevo producto de bota en STOCK_DEFINICION
 * Genera un ID único automáticamente
 * Estructura: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
 * @param {Object} datos - { marca, tipo, modelo, color, descripcion, imagenUrl, activo, divideTalles, pais }
 * @returns {Object} - Resultado de la operación { error, mensaje, id }
 */
function crearProductoBota(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('STOCK_DEFINICION');

    if (!sheet) {
      return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
    }

    if (!datos.marca || datos.marca.toString().trim() === '') {
      return { error: true, mensaje: "La marca del producto es requerida" };
    }
    if (!datos.modelo || datos.modelo.toString().trim() === '') {
      return { error: true, mensaje: "El modelo del producto es requerido" };
    }
    const tipo = (datos.tipo || '').toString().trim();
    const divideTalles = (datos.divideTalles || 'SI').toString().toUpperCase() === 'NO' ? 'NO' : 'SI';

    const datosExistentes = sheet.getDataRange().getValues();
    const headers = datosExistentes.length > 0 ? datosExistentes[0] : [];
    const tieneEstructuraCompleta = headers.length >= 10 && headers[1] && headers[1].toString().trim().toUpperCase() === 'MARCA' && headers[2] && headers[2].toString().trim().toUpperCase() === 'TIPO';

    // Generar ID único
    // Buscar el ID máximo existente
    let maxId = 0;
    for (let i = 1; i < datosExistentes.length; i++) {
      const idActual = datosExistentes[i][0];
      if (idActual !== '' && idActual !== null && idActual !== undefined) {
        // Intentar convertir a número si es posible
        const idNum = parseInt(idActual);
        if (!isNaN(idNum) && idNum > maxId) {
          maxId = idNum;
        }
      }
    }

    // Nuevo ID: máximo + 1
    const nuevoId = maxId + 1;

    const paisProducto = (datos.pais && datos.pais.toString().trim()) ? datos.pais.toString().trim().toUpperCase() : 'ARGENTINA';
    const nuevaFila = [
      nuevoId, datos.marca.toString().trim(), tipo, datos.modelo.toString().trim(),
      datos.color || '', datos.descripcion || '', datos.imagenUrl || '',
      (datos.activo || 'SI').toString().toUpperCase(), divideTalles, paisProducto
    ];

    // Insertar la nueva fila
    sheet.appendRow(nuevaFila);

    return {
      error: false,
      mensaje: "Producto creado correctamente",
      id: nuevoId
    };

  } catch (e) {
    return { error: true, mensaje: "Error al crear producto: " + e.toString() };
  }
}

/**
 * Función para registrar un movimiento de stock (Ingreso o Egreso)
 * Si es Egreso, guarda la cantidad como número negativo para que la matemática funcione
 * Estructura: A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION USUARIO, G:PAIS
 * @param {Object} datos - Objeto con los datos del movimiento { fecha, idProducto, talle, tipo, cantidad, observacion, pais }
 * @returns {Object} - Resultado de la operación { error, mensaje, tipo, cantidad }
 */
function registrarMovimientoStock(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('STOCK_MOVIMIENTOS');

    if (!sheet) {
      return { error: true, mensaje: "No existe la hoja 'STOCK_MOVIMIENTOS'" };
    }

    // Validar datos requeridos
    if (!datos.idProducto || datos.idProducto.toString().trim() === '') {
      return { error: true, mensaje: "El ID del producto es requerido" };
    }

    let talleVal = (datos.talle || '').toString().trim();
    if (!talleVal) talleVal = 'UNICO'; // Productos sin talles

    if (!datos.tipo || (datos.tipo.toString().toUpperCase() !== 'INGRESO' && datos.tipo.toString().toUpperCase() !== 'EGRESO')) {
      return { error: true, mensaje: "El tipo debe ser 'INGRESO' o 'EGRESO'" };
    }

    const cantidad = parseFloat(datos.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      return { error: true, mensaje: "La cantidad debe ser un número positivo" };
    }

    // Validar que el producto existe en STOCK_DEFINICION
    const sheetDefiniciones = ss.getSheetByName('STOCK_DEFINICION');
    if (!sheetDefiniciones) {
      return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
    }

    const datosDefiniciones = sheetDefiniciones.getDataRange().getValues();
    let productoExiste = false;
    let paisProducto = 'ARGENTINA';
    let divideTallesProducto = 'SI';
    for (let i = 1; i < datosDefiniciones.length; i++) {
      const filaP = datosDefiniciones[i];
      const idExistente = filaP[0] ? filaP[0].toString().trim() : '';
      if (idExistente === datos.idProducto.toString().trim()) {
        productoExiste = true;
        if (filaP.length >= 10 && filaP[9]) paisProducto = filaP[9].toString().trim().toUpperCase();
        else if (filaP.length >= 8 && filaP[7]) paisProducto = filaP[7].toString().trim().toUpperCase();
        if (filaP.length >= 10 && filaP[8]) divideTallesProducto = (filaP[8] || 'SI').toString().toUpperCase() === 'NO' ? 'NO' : 'SI';
        break;
      }
    }
    if (!productoExiste) {
      return { error: true, mensaje: "El producto con ID " + datos.idProducto + " no existe en el catálogo" };
    }
    if (divideTallesProducto === 'SI' && !talleVal) {
      return { error: true, mensaje: "Este producto tiene talles. Selecciona un talle." };
    }

    // Si se proporciona país en los datos, usarlo; si no, usar el país del producto
    const paisMovimiento = (datos.pais && datos.pais.toString().trim()) ? datos.pais.toString().trim().toUpperCase() : paisProducto;

    // Preparar fecha
    let fechaStr = '';
    if (datos.fecha) {
      const f = new Date(datos.fecha);
      fechaStr = ('0' + f.getUTCDate()).slice(-2) + '/' + ('0' + (f.getUTCMonth() + 1)).slice(-2) + '/' + f.getUTCFullYear();
    } else {
      // Usar fecha actual si no se proporciona
      const hoy = new Date();
      fechaStr = ('0' + hoy.getUTCDate()).slice(-2) + '/' + ('0' + (hoy.getUTCMonth() + 1)).slice(-2) + '/' + hoy.getUTCFullYear();
    }

    // Preparar cantidad: si es EGRESO, convertir a negativo
    const tipo = datos.tipo.toString().toUpperCase();
    let cantidadGuardar = cantidad;
    if (tipo === 'EGRESO') {
      cantidadGuardar = -cantidad;
    }

    // A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION, G:PAIS
    const nuevaFila = [
      fechaStr,                              // Columna A: FECHA
      datos.idProducto.toString().trim(),    // Columna B: ID_PRODUCTO
      talleVal,                              // Columna C: TALLE (o UNICO para productos sin talles)
      tipo,                                  // Columna D: TIPO
      cantidadGuardar,                       // Columna E: CANTIDAD (negativo si es egreso)
      datos.observacion || '',               // Columna F: OBSERVACION USUARIO
      paisMovimiento                         // Columna G: PAIS
    ];

    // Insertar el movimiento
    sheet.appendRow(nuevaFila);

    return {
      error: false,
      mensaje: "Movimiento registrado correctamente",
      tipo: tipo,
      cantidad: cantidadGuardar
    };

  } catch (e) {
    return { error: true, mensaje: "Error al registrar movimiento: " + e.toString() };
  }
}

// --- 12. GESTIÓN DE MARCAS Y MODELOS ---

/**
 * Función para obtener todas las marcas y modelos configurados
 * @returns {Object} - { error, data: { marcas: [], modelos: { marca: [modelos] } } }
 */
function obtenerMarcasModelos() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('CONFIG-MARCAS-MODELOS');

    if (!sheet) {
      sheet = ss.insertSheet('CONFIG-MARCAS-MODELOS');
      sheet.appendRow(['MARCA', 'TIPO', 'MODELO']);
      sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
      return { error: false, data: { marcas: [], tiposPorMarca: {}, modelosPorMarcaTipo: {}, modelos: {}, modelosConProductosActivos: {} } };
    }

    const datos = sheet.getDataRange().getValues();
    if (datos.length <= 1) {
      return { error: false, data: { marcas: [], tiposPorMarca: {}, modelosPorMarcaTipo: {}, modelos: {}, modelosConProductosActivos: verificarProductosActivosPorModelo() } };
    }

    const modelosConProductosActivos = verificarProductosActivosPorModelo();
    const marcasSet = new Set();
    const tiposPorMarca = {};
    const modelosPorMarcaTipo = {};
    const modelosPorMarca = {};
    const tieneTipo = datos[0].length >= 3 && (datos[0][1] || '').toString().trim().toUpperCase() === 'TIPO';

    for (let i = 1; i < datos.length; i++) {
      const marca = (datos[i][0] || '').toString().trim();
      const tipo = tieneTipo ? (datos[i][1] || '').toString().trim() : '';
      const modelo = tieneTipo ? (datos[i][2] || '').toString().trim() : (datos[i][1] || '').toString().trim();

      if (marca) {
        marcasSet.add(marca);
        const tipoKey = tipo || 'General';
        if (!tiposPorMarca[marca]) tiposPorMarca[marca] = [];
        if (tipoKey && !tiposPorMarca[marca].includes(tipoKey)) tiposPorMarca[marca].push(tipoKey);
        const clave = marca + '|' + tipoKey;
        if (!modelosPorMarcaTipo[clave]) modelosPorMarcaTipo[clave] = [];
        if (modelo && !modelosPorMarcaTipo[clave].includes(modelo)) modelosPorMarcaTipo[clave].push(modelo);
        if (!modelosPorMarca[marca]) modelosPorMarca[marca] = [];
        if (modelo && !modelosPorMarca[marca].includes(modelo)) modelosPorMarca[marca].push(modelo);
      }
    }

    const marcas = Array.from(marcasSet).sort();
    Object.keys(tiposPorMarca).forEach(m => tiposPorMarca[m].sort());
    Object.keys(modelosPorMarcaTipo).forEach(k => modelosPorMarcaTipo[k].sort());
    Object.keys(modelosPorMarca).forEach(m => modelosPorMarca[m].sort());

    return { error: false, data: { marcas, tiposPorMarca, modelosPorMarcaTipo, modelos: modelosPorMarca, modelosConProductosActivos } };

  } catch (e) {
    return { error: true, mensaje: "Error al obtener marcas y modelos: " + e.toString() };
  }
}

/**
 * Verifica qué modelos tienen productos activos
 * Retorna un objeto con formato { "MARCA|MODELO": true/false }
 * true = tiene productos activos, false = no tiene productos activos (o todos están inactivos)
 */
function verificarProductosActivosPorModelo() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetDefiniciones = ss.getSheetByName('STOCK_DEFINICION');

    if (!sheetDefiniciones) {
      return {};
    }

    const datos = sheetDefiniciones.getDataRange().getValues();
    if (datos.length <= 1) {
      return {};
    }

    const modelosConProductosActivos = {};

    // Estructura: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
    // Compatible con estructura antigua (8 cols)
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];
      const marca = (fila[1] || '').toString().trim();
      const tipo = fila.length >= 10 ? (fila[2] || '').toString().trim() : '';
      const modelo = fila.length >= 10 ? (fila[3] || '').toString().trim() : (fila[2] || '').toString().trim();
      const activo = (fila.length >= 10 ? fila[7] : fila[6] || '').toString().trim().toUpperCase();

      if (marca && modelo) {
        const clave = marca + '|' + (tipo || '') + '|' + modelo;
        // Si el producto está activo (ACTIVO = 'SI'), marcar el modelo como teniendo productos activos
        if (activo === 'SI') {
          modelosConProductosActivos[clave] = true;
        } else {
          // Si no está activo, solo marcar como false si no estaba ya marcado como true
          if (modelosConProductosActivos[clave] !== true) {
            modelosConProductosActivos[clave] = false;
          }
        }
      }
    }

    return modelosConProductosActivos;

  } catch (e) {
    return {};
  }
}

/**
 * Función para obtener el historial de movimientos de stock
 * Estructura STOCK_MOVIMIENTOS: A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION USUARIO, G:(vacía), H:PAIS
 * @param {String} pais - País para filtrar (opcional, por defecto ARGENTINA)
 * @returns {Object} - Resultado con lista de movimientos
 */
function obtenerMovimientosStock(pais) {
  try {
    // Si no se proporciona país, usar ARGENTINA por defecto
    if (!pais || pais.toString().trim() === '') {
      pais = 'ARGENTINA';
    }
    pais = pais.toString().trim().toUpperCase();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return { error: true, mensaje: "No se pudo acceder a la planilla" };
    }

    // 1. Obtener hoja de movimientos
    const sheetMovimientos = ss.getSheetByName('STOCK_MOVIMIENTOS');
    if (!sheetMovimientos) {
      return { error: true, mensaje: "No existe la hoja 'STOCK_MOVIMIENTOS'" };
    }

    // 2. Obtener hoja de definiciones para obtener información del producto
    const sheetDefiniciones = ss.getSheetByName('STOCK_DEFINICION');
    if (!sheetDefiniciones) {
      return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
    }

    // 3. Leer datos de definiciones para crear un mapa de productos por ID
    const datosDefiniciones = sheetDefiniciones.getDataRange().getValues();
    const productosMap = {};

    // Estructura nueva: A:ID, B:MARCA, C:TIPO, D:MODELO, E:COLOR, F:DESCRIPCION, G:IMAGEN_URL, H:ACTIVO, I:DIVIDE_TALLES, J:PAIS
    for (let i = 1; i < datosDefiniciones.length; i++) {
      const fila = datosDefiniciones[i];
      const id = fila[0] ? fila[0].toString().trim() : '';
      if (!id) continue;
      const tieneNueva = fila.length >= 10;
      productosMap[id] = {
        id, marca: (fila[1] || '').toString().trim(),
        tipo: tieneNueva ? (fila[2] || '').toString().trim() : '',
        modelo: tieneNueva ? (fila[3] || '').toString().trim() : (fila[2] || '').toString().trim(),
        color: tieneNueva ? (fila[4] || '').toString().trim() : (fila[3] || '').toString().trim(),
        descripcion: tieneNueva ? (fila[5] || '').toString().trim() : (fila[4] || '').toString().trim(),
        imagenUrl: tieneNueva ? (fila[6] || '').toString().trim() : (fila[5] || '').toString().trim()
      };
    }

    // 4. Leer movimientos y filtrar por país
    const datosMovimientos = sheetMovimientos.getDataRange().getValues();
    const movimientos = [];

    // Estructura: A:FECHA, B:ID_PRODUCTO, C:TALLE, D:TIPO, E:CANTIDAD, F:OBSERVACION USUARIO, G:(vacía), H:PAIS
    for (let i = 1; i < datosMovimientos.length; i++) {
      const fila = datosMovimientos[i];

      // Validar que la fila tenga al menos fecha e ID de producto
      if (!fila[0] && !fila[1]) continue; // Saltar filas vacías

      // Obtener ID del producto primero (necesario para buscar país del producto si falta)
      const idProducto = fila[1] ? fila[1].toString().trim() : '';
      if (!idProducto) continue; // Saltar si no hay ID de producto

      // Obtener país del movimiento (columna H, índice 7)
      let paisMovimiento = '';
      if (fila.length > 7 && fila[7] !== null && fila[7] !== undefined && fila[7] !== '') {
        paisMovimiento = fila[7].toString().trim().toUpperCase();
      }

      // Si el movimiento no tiene país, intentar obtenerlo del producto
      if (!paisMovimiento || paisMovimiento === '') {
        if (idProducto) {
          // Buscar el país del producto en STOCK_DEFINICION (columna H, índice 7)
          for (let j = 1; j < datosDefiniciones.length; j++) {
            const filaDef = datosDefiniciones[j];
            const idDef = filaDef[0] ? filaDef[0].toString().trim() : '';
            if (idDef === idProducto && filaDef.length > 7 && filaDef[7] !== null && filaDef[7] !== undefined && filaDef[7] !== '') {
              paisMovimiento = filaDef[7].toString().trim().toUpperCase();
              break;
            }
          }
        }
      }

      // Filtrar por país
      if (!paisMovimiento || paisMovimiento === '' || paisMovimiento !== pais) continue;

      const producto = productosMap[idProducto] || {};

      // Parsear fecha
      let fechaStr = '';
      if (fila[0]) {
        const fecha = fila[0];
        if (Object.prototype.toString.call(fecha) === '[object Date]') {
          fechaStr = ('0' + fecha.getDate()).slice(-2) + '/' + ('0' + (fecha.getMonth() + 1)).slice(-2) + '/' + fecha.getFullYear();
        } else if (typeof fecha === 'string') {
          fechaStr = fecha;
        }
      }

      // Convertir fechaOriginal a string si es un objeto Date
      let fechaOriginalStr = '';
      if (fila[0]) {
        if (Object.prototype.toString.call(fila[0]) === '[object Date]') {
          fechaOriginalStr = ('0' + fila[0].getDate()).slice(-2) + '/' + ('0' + (fila[0].getMonth() + 1)).slice(-2) + '/' + fila[0].getFullYear();
        } else {
          fechaOriginalStr = fila[0].toString();
        }
      }

      movimientos.push({
        fecha: fechaStr,
        fechaOriginal: fechaOriginalStr,
        idProducto: idProducto,
        marca: producto.marca || 'Sin Marca',
        tipo: producto.tipo || '',
        modelo: producto.modelo || 'Sin Modelo',
        color: producto.color || 'Sin Color',
        talle: (fila[2] ? fila[2].toString().trim() : '') || 'UNICO',
        tipo: fila[3] ? fila[3].toString().trim() : '',
        cantidad: parseFloat(fila[4]) || 0,
        observacion: fila[5] ? fila[5].toString().trim() : '',
        pais: paisMovimiento
      });
    }

    // 5. Ordenar por fecha descendente (más recientes primero)
    movimientos.sort((a, b) => {
      try {
        let fechaA = parseFechaStock(a.fecha);
        let fechaB = parseFechaStock(b.fecha);
        // Si fechaB es más reciente que fechaA, retornar positivo (fechaB antes)
        // Si fechaA es más reciente que fechaB, retornar negativo (fechaA antes)
        let diff = fechaB.getTime() - fechaA.getTime();
        return diff;
      } catch (sortError) {
        // Si hay error al ordenar, mantener orden original
        Logger.log('Error al ordenar movimientos: ' + sortError.toString());
        return 0;
      }
    });

    // Asegurar que siempre retornemos un objeto válido y serializable
    const resultado = {
      error: false,
      data: movimientos || []
    };

    // Verificar que el resultado sea válido antes de retornarlo
    if (!resultado || typeof resultado !== 'object') {
      Logger.log('Error: resultado no es un objeto válido');
      return { error: true, mensaje: "Error al procesar los movimientos" };
    }

    return resultado;

  } catch (e) {
    Logger.log('Error en obtenerMovimientosStock: ' + e.toString());
    Logger.log('Stack trace: ' + (e.stack || 'No disponible'));
    // Asegurar que siempre retornemos un objeto válido incluso en caso de error
    const errorResult = {
      error: true,
      mensaje: "Error al obtener movimientos: " + (e.toString() || 'Error desconocido')
    };
    return errorResult;
  }
}

/**
 * Función para guardar una marca, tipo y modelo
 * @param {Object} datos - { marca, tipo, modelo }
 * @returns {Object} - Resultado de la operación
 */
function guardarMarcaModelo(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('CONFIG-MARCAS-MODELOS');

    if (!sheet) {
      sheet = ss.insertSheet('CONFIG-MARCAS-MODELOS');
      sheet.appendRow(['MARCA', 'TIPO', 'MODELO']);
      sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    }

    const marca = (datos.marca || '').toString().trim();
    const tipo = (datos.tipo || 'General').toString().trim() || 'General';
    const modelo = (datos.modelo || '').toString().trim();

    if (!marca) return { error: true, mensaje: "La marca es requerida" };
    if (!modelo) return { error: true, mensaje: "El modelo es requerido" };

    const datosExistentes = sheet.getDataRange().getValues();
    const tieneTipo = datosExistentes[0] && datosExistentes[0].length >= 3 && (datosExistentes[0][1] || '').toString().trim().toUpperCase() === 'TIPO';

    for (let i = 1; i < datosExistentes.length; i++) {
      const m = (datosExistentes[i][0] || '').toString().trim();
      const t = tieneTipo ? (datosExistentes[i][1] || 'General').toString().trim() : 'General';
      const mod = tieneTipo ? (datosExistentes[i][2] || '').toString().trim() : (datosExistentes[i][1] || '').toString().trim();
      if (m === marca && t === tipo && mod === modelo) {
        return { error: true, mensaje: "Esta combinación de marca, tipo y modelo ya existe" };
      }
    }

    if (!tieneTipo && datosExistentes[0] && datosExistentes[0].length < 3) {
      sheet.insertColumnAfter(1);
      sheet.getRange(1, 2).setValue('TIPO');
      for (let r = 2; r <= sheet.getLastRow(); r++) {
        sheet.getRange(r, 2).setValue('General');
      }
    }
    sheet.appendRow([marca, tipo || 'General', modelo]);

    return { error: false, mensaje: "Marca y modelo guardados correctamente" };

  } catch (e) {
    return { error: true, mensaje: "Error al guardar marca y modelo: " + e.toString() };
  }
}

/**
 * Función para eliminar una marca, tipo y modelo
 * @param {Object} datos - { marca, tipo, modelo }
 * @returns {Object} - Resultado de la operación
 */
function eliminarMarcaModelo(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONFIG-MARCAS-MODELOS');

    if (!sheet) {
      return { error: true, mensaje: "No existe la hoja de configuración" };
    }

    const marca = (datos.marca || '').toString().trim();
    const tipo = (datos.tipo || 'General').toString().trim() || 'General';
    const modelo = (datos.modelo || '').toString().trim();

    const tieneProductosActivos = verificarProductosActivosPorModelo();
    const clave = marca + '|' + tipo + '|' + modelo;
    if (tieneProductosActivos[clave] === true) {
      return { error: true, mensaje: "No se puede eliminar porque tiene productos activos. Desactive los productos primero." };
    }

    const datosExistentes = sheet.getDataRange().getValues();
    const tieneTipo = datosExistentes[0] && datosExistentes[0].length >= 3;
    for (let i = datosExistentes.length - 1; i >= 1; i--) {
      const m = (datosExistentes[i][0] || '').toString().trim();
      const t = tieneTipo ? (datosExistentes[i][1] || 'General').toString().trim() : 'General';
      const mod = tieneTipo ? (datosExistentes[i][2] || '').toString().trim() : (datosExistentes[i][1] || '').toString().trim();
      if (m === marca && t === tipo && mod === modelo) {
        sheet.deleteRow(i + 1);
        return { error: false, mensaje: "Marca, tipo y modelo eliminados correctamente" };
      }
    }
    return { error: true, mensaje: "No se encontró la combinación" };

  } catch (e) {
    return { error: true, mensaje: "Error al eliminar marca y modelo: " + e.toString() };
  }
}

/**
 * Función para actualizar el estado (activo/inactivo) de un producto
 * @param {Object} datos - { id, activo }
 * @returns {Object} - Resultado de la operación
 */
function actualizarEstadoProducto(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('STOCK_DEFINICION');

    if (!sheet) {
      return { error: true, mensaje: "No existe la hoja 'STOCK_DEFINICION'" };
    }

    if (!datos.id) {
      return { error: true, mensaje: "El ID del producto es requerido" };
    }

    const nuevoEstado = (datos.activo && datos.activo.toString().toUpperCase() === 'NO') ? 'NO' : 'SI';

    // Buscar el producto por ID
    const datosExistentes = sheet.getDataRange().getValues();
    let productoEncontrado = false;

    for (let i = 1; i < datosExistentes.length; i++) {
      const idExistente = datosExistentes[i][0] ? datosExistentes[i][0].toString().trim() : '';
      if (idExistente === datos.id.toString().trim()) {
        // Actualizar la columna ACTIVO (columna G, índice 6)
        // Si la estructura tiene MARCA, ACTIVO está en la columna G (índice 6)
        // Si no tiene MARCA, ACTIVO está en la columna F (índice 5)
        const tieneMarca = datosExistentes[i].length >= 7;
        const columnaActivo = tieneMarca ? 6 : 5; // Columna G o F

        sheet.getRange(i + 1, columnaActivo + 1).setValue(nuevoEstado);
        productoEncontrado = true;
        break;
      }
    }

    if (!productoEncontrado) {
      return { error: true, mensaje: "No se encontró el producto con ID " + datos.id };
    }

    return {
      error: false,
      mensaje: "Estado del producto actualizado correctamente",
      activo: nuevoEstado
    };

  } catch (e) {
    return { error: true, mensaje: "Error al actualizar estado: " + e.toString() };
  }
}
