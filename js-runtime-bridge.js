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
      obtenerPerfilUsuario: () => requestJson('/api/auth/perfil'),
      obtenerListaVendedores: () => requestJson('/api/usuarios?action=vendedores'),
      obtenerCotizacionesBackend: () => requestJson('/api/config?action=cotizaciones'),
      obtenerConfiguracion: () => requestJson('/api/config?action=caja'),
      obtenerConceptosPorPais: (pais) => requestJson(`/api/config?${buildQuery({ action: 'conceptos', pais })}`),
      obtenerDescripcionesPorPaisConcepto: (pais, concepto) =>
        requestJson(`/api/config?${buildQuery({ action: 'descripciones', pais, concepto })}`),
      obtenerMediosPorPais: (pais) => requestJson(`/api/config?${buildQuery({ action: 'medios', pais })}`),

      obtenerBalanceCaja: (pais, mes, anio) =>
        requestJson(`/api/caja?${buildQuery({ action: 'balance', pais, mes, anio })}`),
      obtenerBalanceCajaMediosPago: (pais, mes, anio) =>
        requestJson(`/api/caja?${buildQuery({ action: 'medios', pais, mes, anio })}`),
      obtenerHistorialCaja: (pais, mes, anio) =>
        requestJson(`/api/caja?${buildQuery({ action: 'historial', pais, mes, anio })}`),
      obtenerDatosCajaCompleto: (pais, mes, anio) =>
        requestJson(`/api/caja?${buildQuery({ action: 'datos-completo', pais, mes, anio })}`),
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
