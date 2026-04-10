(function () {
  function buildQuery(params) {
    const qs = new URLSearchParams();
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value === undefined || value === null) return;
      qs.set(key, String(value));
    });
    return qs.toString();
  }

  function requestJson(url, options) {
    return fetch(url, options).then(async (res) => {
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        data = { error: true, mensaje: text || 'Respuesta invalida' };
      }
      if (!res.ok) {
        const error = new Error(data.mensaje || data.error || `HTTP ${res.status}`);
        error.response = data;
        throw error;
      }
      return data;
    });
  }

  function endpointCall(methodName, args) {
    const routes = {
      obtenerPerfilUsuario: async () => {
        const token = typeof window !== 'undefined' && window.__getSupabaseAuthToken
          ? await window.__getSupabaseAuthToken()
          : null;
        const headers = token ? { Authorization: 'Bearer ' + token } : {};
        return requestJson('/api/auth/perfil', { headers });
      },
      obtenerListaVendedores: () => requestJson('/api/usuarios?action=vendedores'),
      obtenerTodosUsuarios: () => requestJson('/api/usuarios?action=todos'),
      actualizarEstadoUsuario: (email, activo) =>
        requestJson('/api/usuarios?action=estado', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, activo }),
        }),
      crearNuevoUsuario: (payload) =>
        requestJson('/api/usuarios?action=crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      actualizarUsuario: (payload) =>
        requestJson('/api/usuarios?action=actualizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      obtenerCotizacionesBackend: () => requestJson('/api/config?action=cotizaciones'),
      actualizarCotizacionesDesdeExternas: () =>
        requestJson('/api/config?action=actualizar-cotizaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      obtenerConfiguracion: () => requestJson('/api/config?action=caja'),
      obtenerConceptosPorPais: (pais) => requestJson(`/api/config?${buildQuery({ action: 'conceptos', pais })}`),
      obtenerDescripcionesPorPaisConcepto: (pais, concepto) =>
        requestJson(`/api/config?${buildQuery({ action: 'descripciones', pais, concepto })}`),
      obtenerMediosPorPais: (pais) => requestJson(`/api/config?${buildQuery({ action: 'medios', pais })}`),
      guardarItemConfig: (tipo, nombre, padre, pais, sentido) =>
        requestJson('/api/config?action=guardar-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo, nombre, padre, pais, sentido }),
        }),
      borrarItemConfig: (tipo, nombre, pais, padre) =>
        requestJson('/api/config?action=borrar-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo, nombre, pais, padre }),
        }),

      obtenerBalanceCaja: (pais, mes, anio) =>
        requestJson(`/api/caja?${buildQuery({ action: 'balance', pais, mes, anio })}`),
      obtenerBalanceCajaMediosPago: (pais, mes, anio) =>
        requestJson(`/api/caja?${buildQuery({ action: 'medios', pais, mes, anio })}`),
      obtenerHistorialCaja: (pais, mes, anio) =>
        requestJson(`/api/caja?${buildQuery({ action: 'historial', pais, mes, anio })}`),
      obtenerProximosVencimientosCaja: (pais, limite) =>
        requestJson(`/api/caja?${buildQuery({ action: 'proximos-vencimientos', pais, limite: limite != null ? limite : 3 })}`),
      obtenerDatosCajaCompleto: (pais, mes, anio) =>
        requestJson(`/api/caja?${buildQuery({ action: 'datos-completo', pais, mes, anio })}`),
      obtenerConsolidadoCaja: (pais, anio) =>
        requestJson(`/api/caja?${buildQuery({ action: 'consolidado', pais, anio })}`),
      obtenerMovimientoCaja: (id) =>
        requestJson(`/api/caja?${buildQuery({ action: 'movimiento-item', id })}`),
      actualizarEstadoMovimientoCaja: (id, nuevoEstado) =>
        requestJson('/api/caja?action=movimiento-estado', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, nuevoEstado }),
        }),
      borrarMovimientoCajaBackend: (id) =>
        requestJson('/api/caja?action=movimiento-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        }),
      procesarMovimientoCaja: (payload) =>
        requestJson('/api/caja?action=movimiento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),

      obtenerDatosDeHoja: (nombreHoja) =>
        requestJson(`/api/ventas?${buildQuery({ action: 'datos-hoja', nombreHoja })}`),
      obtenerDashboardHome: (mes, anio, vendedor) =>
        requestJson(`/api/ventas?${buildQuery({ action: 'dashboard-home', mes, anio, vendedor })}`),
      guardarVenta: (payload) =>
        requestJson('/api/ventas?action=guardar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      editarVenta: (payload) =>
        requestJson('/api/ventas?action=editar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      actualizarCheck: (payload) =>
        requestJson('/api/ventas?action=check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      borrarVenta: (payload) =>
        requestJson('/api/ventas?action=borrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),

      obtenerClientesVendedor: (vendedor, pais) =>
        requestJson(`/api/clientes?${buildQuery({ action: 'list', vendedor, pais })}`),
      guardarCliente: (payload) =>
        requestJson('/api/clientes?action=guardar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      borrarClientePorDatos: (payload) =>
        requestJson('/api/clientes?action=borrar-por-datos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),

      obtenerFormasPagoVenta: () => requestJson('/api/forma-pago-venta?action=list'),
      crearFormaPagoVenta: (payload) =>
        requestJson('/api/forma-pago-venta?action=crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      borrarFormaPagoVenta: (payload) =>
        requestJson('/api/forma-pago-venta?action=borrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),

      obtenerObjetivosBackend: (anio, mes, vendedor) =>
        requestJson(`/api/reportes?${buildQuery({ action: 'objetivos-backend', anio, mes, vendedor })}`),
      obtenerTodosLosObjetivos: () => requestJson('/api/reportes?action=todos-objetivos'),
      guardarObjetivosBackend: (anio, mes, filas, vendedor) =>
        requestJson('/api/reportes?action=guardar-objetivos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anio, mes, filas, vendedor }),
        }),
      guardarObjetivoEspecial: (payload) =>
        requestJson('/api/reportes?action=guardar-objetivo-especial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      obtenerReporteConsolidado: (anio) =>
        requestJson(`/api/reportes?${buildQuery({ action: 'consolidado', anio })}`),
      obtenerTodasLasComisiones: () => requestJson('/api/reportes?action=comisiones'),

      obtenerStockBotas: (pais) =>
        requestJson(`/api/stock?${buildQuery({ action: 'stock-botas', pais })}`),
      obtenerMovimientosStock: (pais) =>
        requestJson(`/api/stock?${buildQuery({ action: 'movimientos', pais })}`),
      obtenerMarcasModelos: () =>
        requestJson('/api/stock?action=marcas-modelos'),
      crearProductoBota: (payload) =>
        requestJson('/api/stock?action=crear-producto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      registrarMovimientoStock: (payload) =>
        requestJson('/api/stock?action=registrar-movimiento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      guardarMarcaModelo: (payload) =>
        requestJson('/api/stock?action=guardar-marca-modelo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      eliminarMarcaModelo: (payload) =>
        requestJson('/api/stock?action=eliminar-marca-modelo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
      actualizarEstadoProducto: (payload) =>
        requestJson('/api/stock?action=actualizar-estado-producto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }),
    };

    const fn = routes[methodName];
    if (!fn) {
      return Promise.reject(new Error(`Metodo GAS no migrado: ${methodName}`));
    }
    return Promise.resolve().then(() => fn(...(args || [])));
  }

  function createRunner() {
    const state = { success: null, failure: null };
    return new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'withSuccessHandler') {
            return function (cb) {
              state.success = cb;
              return this;
            };
          }
          if (prop === 'withFailureHandler') {
            return function (cb) {
              state.failure = cb;
              return this;
            };
          }
          if (typeof prop === 'string') {
            return function (...args) {
              endpointCall(prop, args)
                .then((data) => {
                  if (typeof state.success === 'function') state.success(data);
                })
                .catch((err) => {
                  if (typeof state.failure === 'function') {
                    state.failure(err);
                  } else {
                    console.error(err);
                  }
                });
            };
          }
          return undefined;
        },
      }
    );
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    get() {
      return createRunner();
    },
  });
})();
