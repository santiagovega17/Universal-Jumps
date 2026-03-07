const { getSupabaseAdmin } = require('./supabaseAdmin');

function normalizePais(value) {
  const src = (value || '').toString().trim().toUpperCase();
  const noAccents = src.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (noAccents === 'USA') return 'EEUU';
  if (noAccents === 'ESPANA') return 'ESPANA';
  return noAccents || 'ARGENTINA';
}

/** Obtener productos de stock por país, con talles calculados desde movimientos */
async function obtenerStockBotas(pais) {
  const supabase = getSupabaseAdmin();
  const paisNorm = normalizePais(pais);
  const { data: productos, error } = await supabase
    .from('producto')
    .select('id, codigo, marca, tipo, modelo, color, descripcion, imagen_url, activo, divide_talles, pais')
    .eq('pais', paisNorm)
    .eq('activo', 'SI');
  if (error) throw new Error(error.message);

  const { data: movimientos } = await supabase
    .from('stockMovimiento')
    .select('producto_id, talle, tipo, cantidad')
    .eq('pais', paisNorm);
  if (!movimientos) return { data: [], productos: [] };

  const tallesPorProducto = {};
  (movimientos || []).forEach((m) => {
    const pid = m.producto_id;
    if (!tallesPorProducto[pid]) tallesPorProducto[pid] = {};
    const talle = (m.talle || 'UNICO').toString().trim();
    if (!tallesPorProducto[pid][talle]) tallesPorProducto[pid][talle] = 0;
    const cant = Number(m.cantidad) || 0;
    if (String(m.tipo || '').toUpperCase() === 'INGRESO') tallesPorProducto[pid][talle] += cant;
    else if (String(m.tipo || '').toUpperCase() === 'EGRESO') tallesPorProducto[pid][talle] -= cant;
  });

  const lista = (productos || []).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    marca: p.marca || '',
    tipo: p.tipo || 'General',
    modelo: p.modelo || '',
    color: p.color || '',
    descripcion: p.descripcion || '',
    imagenUrl: p.imagen_url || '',
    activo: p.activo || 'SI',
    divideTalles: p.divide_talles || 'SI',
    talles: tallesPorProducto[p.id] || {},
  }));

  return { data: lista, productos: lista };
}

/** Obtener movimientos de stock por país */
async function obtenerMovimientosStock(pais) {
  const supabase = getSupabaseAdmin();
  const paisNorm = normalizePais(pais);
  const { data: movs, error } = await supabase
    .from('stockMovimiento')
    .select(`
      id, fecha, talle, tipo, cantidad, observacion_usuario, pais,
      producto_id(id, codigo, marca, tipo, modelo, color)
    `)
    .eq('pais', paisNorm)
    .order('fecha', { ascending: false });
  if (error) throw new Error(error.message);

  const lista = (movs || []).map((m) => {
    const prod = (m.producto_id && typeof m.producto_id === 'object') ? m.producto_id : {};
    const fecha = m.fecha ? (typeof m.fecha === 'string' ? m.fecha.split('T')[0] : m.fecha) : '';
    const tipoMov = String(m.tipo || '').toUpperCase();
    return {
      id: m.id,
      fecha,
      talle: m.talle || 'UNICO',
      tipo: tipoMov || 'INGRESO',
      cantidad: Number(m.cantidad) || 0,
      observacion: m.observacion_usuario || '',
      marca: prod.marca || '',
      tipoProducto: prod.tipo || 'General',
      modelo: prod.modelo || '',
      color: prod.color || '',
    };
  });

  return { data: lista };
}

/** Obtener marcas/modelos para el catálogo (estructura esperada por el frontend) */
async function obtenerMarcasModelos() {
  const supabase = getSupabaseAdmin();
  const { data: filas, error } = await supabase
    .from('configMarcaModelo')
    .select('marca, tipo, modelo')
    .order('marca')
    .order('tipo')
    .order('modelo');
  if (error) throw new Error(error.message);

  const marcas = new Set();
  const tiposPorMarca = {};
  const modelosPorMarcaTipo = {};
  const modelos = {};

  (filas || []).forEach((f) => {
    const marca = (f.marca || '').trim();
    const tipo = (f.tipo || '').trim() || 'General';
    const modelo = (f.modelo || '').trim();
    if (!marca || !modelo) return;

    marcas.add(marca);
    if (!tiposPorMarca[marca]) tiposPorMarca[marca] = new Set();
    tiposPorMarca[marca].add(tipo);

    const claveMT = marca + '|' + tipo;
    if (!modelosPorMarcaTipo[claveMT]) modelosPorMarcaTipo[claveMT] = [];
    if (!modelosPorMarcaTipo[claveMT].includes(modelo)) modelosPorMarcaTipo[claveMT].push(modelo);

    if (tipo === 'General') {
      if (!modelos[marca]) modelos[marca] = [];
      if (!modelos[marca].includes(modelo)) modelos[marca].push(modelo);
    }
  });

  // Obtener marca|tipo|modelo que tienen productos activos
  const { data: productosActivos } = await supabase
    .from('producto')
    .select('marca, tipo, modelo')
    .eq('activo', 'SI');
  const modelosConProductosActivos = {};
  (productosActivos || []).forEach((p) => {
    const marca = (p.marca || '').trim();
    const tipo = (p.tipo || '').trim() || 'General';
    const modelo = (p.modelo || '').trim();
    if (marca && modelo) {
      modelosConProductosActivos[marca + '|' + tipo + '|' + modelo] = true;
    }
  });

  const marcasArr = Array.from(marcas).sort();
  Object.keys(tiposPorMarca).forEach((m) => {
    tiposPorMarca[m] = Array.from(tiposPorMarca[m]).sort();
  });

  return {
    data: {
      marcas: marcasArr,
      tiposPorMarca,
      modelosPorMarcaTipo,
      modelos,
      modelosConProductosActivos,
    },
  };
}

/** Crear producto */
async function crearProductoBota(datos) {
  const supabase = getSupabaseAdmin();
  const pais = normalizePais(datos.pais || 'ARGENTINA');
  const codigo = (datos.codigo || '').toString().trim();
  if (!codigo) throw new Error('Código es requerido');
  const { data, error } = await supabase
    .from('producto')
    .insert({
      codigo,
      marca: datos.marca || '',
      tipo: datos.tipo || 'General',
      modelo: datos.modelo || '',
      color: datos.color || '',
      descripcion: datos.descripcion || '',
      imagen_url: datos.imagenUrl || datos.imagen_url || '',
      activo: 'SI',
      divide_talles: datos.divideTalles || datos.divide_talles || 'SI',
      pais: pais,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { data, mensaje: 'Producto creado' };
}

/** Registrar movimiento de stock */
async function registrarMovimientoStock(datos) {
  const supabase = getSupabaseAdmin();
  const productoId = datos.producto_id || datos.id;
  if (!productoId) throw new Error('producto_id es requerido');
  const pais = normalizePais(datos.pais || 'ARGENTINA');
  const fecha = datos.fecha || new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('stockMovimiento').insert({
    producto_id: productoId,
    fecha,
    talle: datos.talle || 'UNICO',
    tipo: datos.tipo || 'INGRESO',
    cantidad: Number(datos.cantidad) || 0,
    observacion_usuario: datos.observacion || '',
    pais,
  });
  if (error) throw new Error(error.message);
  return { mensaje: 'Movimiento registrado' };
}

/** Guardar marca/modelo en catálogo */
async function guardarMarcaModelo({ marca, tipo, modelo }) {
  const supabase = getSupabaseAdmin();
  if (!marca || !modelo) throw new Error('marca y modelo son requeridos');
  const { error } = await supabase.from('configMarcaModelo').upsert(
    { marca: marca.trim(), tipo: (tipo || 'General').trim(), modelo: modelo.trim() },
    { onConflict: 'marca,tipo,modelo' }
  );
  if (error) throw new Error(error.message);
  return { mensaje: 'Guardado' };
}

/** Eliminar marca/modelo del catálogo */
async function eliminarMarcaModelo({ marca, tipo, modelo }) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('configMarcaModelo')
    .delete()
    .eq('marca', marca || '')
    .eq('tipo', tipo || 'General')
    .eq('modelo', modelo || '');
  if (error) throw new Error(error.message);
  return { mensaje: 'Eliminado' };
}

/** Actualizar estado activo/inactivo del producto */
async function actualizarEstadoProducto({ id, activo }) {
  const supabase = getSupabaseAdmin();
  if (!id) throw new Error('id es requerido');
  const { error } = await supabase
    .from('producto')
    .update({ activo: (activo || 'SI').toString().toUpperCase() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { mensaje: 'Actualizado' };
}

module.exports = {
  obtenerStockBotas,
  obtenerMovimientosStock,
  obtenerMarcasModelos,
  crearProductoBota,
  registrarMovimientoStock,
  guardarMarcaModelo,
  eliminarMarcaModelo,
  actualizarEstadoProducto,
};
