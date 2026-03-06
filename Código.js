/**
 * Código refactorizado: la lógica de backend está en los siguientes módulos:
 *
 * - Utils.js      : parseFecha, parseFechaBalance, parseFechaStock, ddmmyyyyToYYYYMMDD
 * - Main.js       : includeFile, doGet, obtenerDatosDeHoja
 * - Auth.js       : obtenerPerfilUsuario
 * - Usuarios.js   : obtenerListaVendedores, obtenerTodosUsuarios, crearNuevoUsuario, actualizarUsuario, actualizarEstadoUsuario, cambiarRolUsuario
 * - Config.js     : obtenerConfiguracion, conceptos/descripciones/medios por país, cotizaciones, guardarItemConfig, borrarItemConfig, egresos proyectados
 * - Ventas.js     : guardarVenta, editarVenta, procesarVenta, actualizarCheck, borrarVenta
 * - Caja.js       : procesarMovimientoCaja, borrarMovimientoCajaBackend, actualizarEstadoMovimientoCaja, obtenerBalanceCaja, obtenerBalanceCajaMediosPago, obtenerHistorialCaja, obtenerMovimientoCaja, obtenerConsolidadoBalanceCaja
 * - Objetivos.js  : obtenerObjetivosBackend, obtenerObjetivosEspecialesVendedor, obtenerTodosLosObjetivos, guardarObjetivosBackend, guardarObjetivoEspecial
 * - Consolidado.js: obtenerReporteConsolidado, obtenerComisionesTrimestre, obtenerTodasLasComisiones
 * - Clientes.js   : obtenerClientesVendedor, guardarCliente, borrarCliente, borrarClientePorDatos
 * - Stock.js     : obtenerStockBotas, crearProductoBota, registrarMovimientoStock, obtenerMarcasModelos, verificarProductosActivosPorModelo, obtenerMovimientosStock, guardarMarcaModelo, eliminarMarcaModelo, actualizarEstadoProducto
 * - Mantenimiento.js : agregarColumnasFaltantes
 * - Constants.js    : ANIO_ACTIVO (opcional; unifica el año en backend)
 *
 * Este archivo se mantiene como referencia. No definir aquí funciones duplicadas.
 */
