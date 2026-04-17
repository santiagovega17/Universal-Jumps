# Changelog

Todos los cambios notables del proyecto se documentan aquí.

## [1.5.0] - 2026-03-04

### Añadido

- **Año unificado (frontend):** Filtro de año en ventas generado desde `ANIO_ACTIVO` (opciones ANIO_ACTIVO-2 … ANIO_ACTIVO). Select de año del consolidado rellenado por `poblarAnioConsolidado()` con la misma lógica. Todas las llamadas de caja que envían año usan `ANIO_ACTIVO` (cargarHistorialMovimientos, cargarDatosBalance, cargarMediosPago, cargarDatosCajaCompletoTresLlamadas).
- **Backend – Constants.js:** Archivo `Constants.js` con `var ANIO_ACTIVO = 2026` para unificar el año en el proyecto GAS. Documentado en README y en Código.js.
- **Reintentar en más vistas:** Gestión de usuarios y Clientes muestran error de conexión con botón "Reintentar" (igual que caja/stock/consolidado).

### Cambiado

- **UX – Toasts en Stock:** Los mensajes de éxito en stock pasan de alerta a toast: producto creado, ajuste registrado, marca/tipo/dureza guardados o eliminados, producto activado/desactivado.
- **README – Notas:** Sección "Año centralizado" actualizada: frontend usa `ANIO_ACTIVO` en `js-config.html`; backend puede usar `Constants.js`.

---

## [1.4.0] - 2026-03-04

### Añadido (Lote 5)

- **Modo debug (logs):** Variable global `DEBUG` (por defecto `false`) y función `debugLog(tag, message, data)` en `js-config.html`. Si `DEBUG` o `window.DEBUG` es `true`, se escriben en consola (F12) mensajes con prefijo `[DEBUG][TAG]`. Se usa en: caché de caja (hit y tiempos de carga), caché de ventas (vendedor desde caché), navegación (`NAV`). Permite diagnosticar sin tocar código en producción; se puede activar desde la consola con `window.DEBUG = true`.
- **README – Dependencias:** Nueva sección que lista Google Apps Script, Google Spreadsheet, cuenta Google, Cloudinary (solo stock) y clasp (opcional), con una breve descripción de cada una.
- **README – Modo debug:** Sección que explica cómo activar los logs (desde consola o cambiando `DEBUG` en `js-config`) y el formato de los mensajes.

### Cambiado

- Los `console.log` de caja (caché y total ms) pasan a `debugLog`, por lo que solo aparecen con modo debug activado.
- README: referencia a tiempos de carga en Balance de Caja actualizada para indicar que se ven con modo debug.

---

## [1.3.0] - 2026-03-04

### Añadido (Lote 4)

- **Paginación "Cargar más" en historiales:**
  - **Caja:** El historial de movimientos muestra los primeros 25; botón "Cargar más (X restantes)" para cargar 25 más. Se reinicia al cambiar filtro (EGRESO/INGRESO) o al recargar datos.
  - **Ventas:** El historial del vendedor muestra los primeros 25 filtrados; botón "Cargar más (X restantes)". Al cambiar filtros (mes, año, estado, etc.) se reinicia a 25.
- **Caché de ventas:** Al entrar a un vendedor, los datos se guardan en `VENTAS_CACHE` (vendedor, data, ts). Si vuelves al mismo vendedor en menos de 30 s, se usa la caché y no se llama al backend. TTL 30 s, igual que la caché de caja.
- **Estilos:** Clases `.cargar-mas-wrap` y `.btn-cargar-mas` para el botón de paginación.

### Cambiado

- `aplicarFiltrosHistorial` acepta segundo parámetro `resetVisible`; si es `false` (desde "Cargar más") no reinicia la cantidad visible.

---

## [1.2.0] - 2026-03-04

### Añadido (Lote 3)

- **Objeto de estado mínimo (APP_STATE):** En `js-config.html`, objeto con `get(key)` y `set(key, val)` para `hojaActual`, `paisCaja`, `paisStock`, `vistaStock`. Al usar `set` se actualizan las variables globales (`HOJA_ACTUAL`, etc.) para no romper el resto del código.
- **Uso de APP_STATE:** Navegación (`navegar`), cambio de país en caja (`switchPaisCaja`), cambio de país y vista en stock (`switchPaisStock`, `switchVistaStock`) escriben con `APP_STATE.set(...)`.
- **Validación de formularios:** Función `validarCampos(reglas)` en `js-app.html` (campos requeridos, mínimo/máximo numérico, patrón regex). Aplicada en:
  - **Caja:** concepto y descripción obligatorios; fecha de vencimiento obligatoria si estado es Pendiente; al menos una forma de pago con monto (mensaje con `mostrarAlerta`).
  - **Ventas:** fecha, país, cliente, concepto, cantidad > 0, precio ≥ 0, forma de pago; mensajes con `mostrarAlerta`.
  - **Clientes:** nombre y apellido obligatorios; si se indica correo, validación de formato.

### Cambiado

- Errores de validación y mensajes de “campo obligatorio” en caja y ventas pasan de `alert` a `mostrarAlerta`.

---

## [1.1.0] - 2026-03-04

### Añadido (Lote 2)

- **Error de red + Reintentar:** En todas las cargas principales (balance de caja, historial y medios de pago, stock, movimientos de stock, consolidado, comisiones, objetivos) se muestra un mensaje claro de "Error de conexión" con botón **Reintentar** en lugar de solo texto de error.
- **Helper global:** `getHtmlErrorRedConReintentar(mensaje)` en `js-app.html` y estilos `.error-red-contenedor` para unificar el aspecto del error de red.
- **Borrar venta:** `withFailureHandler` en la eliminación de venta para mostrar mensaje de error de conexión si falla la red.

### Cambiado

- Eliminación de movimiento de caja muestra toast de éxito en lugar de alerta.
- Las vistas que fallan al cargar (por error del backend o por red) ahora ofrecen Reintentar sin recargar la página.

---

## [1.0.0] - 2026-03-04

### Añadido

- **Configuración centralizada:** Constante `ANIO_ACTIVO` (2026) en `js-config.html` para filtros y reportes; uso en balance de caja.
- **Versión de la app:** Constante `APP_VERSION` y visualización en el sidebar (pie del menú).
- **Toasts:** Mensajes breves de éxito que no bloquean (en lugar de alertas) al guardar movimiento de caja, venta, cliente y al activar/desactivar usuario.
- **Manejo de errores:** En el formulario de clientes, `withFailureHandler` para restaurar el botón y mostrar mensaje claro si falla la conexión.
- **CHANGELOG.md:** Este archivo para registrar versiones y cambios.

### Cambiado

- Balance de caja usa `ANIO_ACTIVO` en lugar de año fijo 2026.
- Éxitos de guardado en caja, ventas y clientes muestran toast en lugar de modal "Entendido".
