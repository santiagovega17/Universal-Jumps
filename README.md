# Universal Jumps – App Web (Google Apps Script)

Aplicación web desplegada en **Google Apps Script** para gestión de ventas, caja, objetivos, consolidado, clientes y stock.

---

## Dependencias

| Dependencia | Uso |
|-------------|-----|
| **Google Apps Script** | Runtime del backend y despliegue de la app web. Requiere un proyecto en [script.google.com](https://script.google.com) vinculado a una hoja de cálculo. |
| **Google Spreadsheet (Sheets)** | Datos: ventas, caja, clientes, stock, usuarios, configuración. Todas las hojas deben existir y tener las columnas esperadas (ver tabla de hojas más abajo). |
| **Cuenta Google / Session.getActiveUser()** | Login: la app usa `Session.getActiveUser()` para identificar al usuario y comprobar permisos. El usuario debe tener acceso al proyecto de GAS. |
| **Cloudinary** | Solo para **Stock**: subida y entrega de imágenes de productos. En `js-stock.html` se usan `CLOUDINARY_CLOUD_NAME` y `CLOUDINARY_PRESET`; el preset debe estar configurado en tu cuenta Cloudinary (upload unsigned). |
| **clasp** (opcional) | Para subir el código desde la terminal: `npm i -g @google/clasp` y `clasp push`. No es obligatorio si editas y despliegas desde el editor de Apps Script. |

No hay dependencias npm en el frontend: todo se sirve como HTML/JS dentro del proyecto GAS. Las fuentes usan Google Fonts (Inter, Material Symbols) cargadas por CDN.

---

## Modo debug (logs)

Para ver logs de caché, navegación y tiempos de carga en la consola del navegador (F12):

1. **Desde consola:** En la pestaña Console, ejecutar `window.DEBUG = true` y recargar o navegar. Los mensajes tendrán el formato `[DEBUG][TAG] mensaje` (p. ej. `[DEBUG][CAJA] Desde caché`, `[DEBUG][VENTAS] Vendedor desde caché`, `[DEBUG][NAV] Navegando`).
2. **Desde código:** En `js-config.html`, cambiar `var DEBUG = false;` a `var DEBUG = true;` (no recomendado en producción).

Con `DEBUG` en `false` (por defecto) no se escribe nada en consola por estas rutas. La función global es `debugLog(tag, message, data)`.

---

## Estructura del proyecto

### Backend (Google Apps Script)

Todos los archivos `.js` se cargan en el mismo proyecto y comparten ámbito global. No hay `import`/`export`; las funciones se llaman por nombre.

| Archivo | Contenido |
|--------|-----------|
| **Main.js** | `includeFile`, `doGet`, `obtenerDatosDeHoja` — entrada de la app y lectura de hojas |
| **Utils.js** | `parseFecha`, `parseFechaBalance`, `parseFechaStock`, `ddmmyyyyToYYYYMMDD` — utilidades de fechas |
| **Auth.js** | `obtenerPerfilUsuario` — login y perfil |
| **Usuarios.js** | `obtenerListaVendedores`, `obtenerTodosUsuarios`, `crearNuevoUsuario`, `actualizarUsuario`, `actualizarEstadoUsuario`, `cambiarRolUsuario` |
| **Config.js** | Configuración de caja y cotizaciones: `obtenerConfiguracion`, conceptos/descripciones/medios por país, `obtenerCotizacionesConCache`, `guardarItemConfig`, `borrarItemConfig`, egresos proyectados |
| **Ventas.js** | `guardarVenta`, `editarVenta`, `procesarVenta`, `actualizarCheck`, `borrarVenta` |
| **Caja.js** | `procesarMovimientoCaja`, `borrarMovimientoCajaBackend`, `actualizarEstadoMovimientoCaja`, `obtenerBalanceCaja`, `obtenerBalanceCajaMediosPago`, `obtenerHistorialCaja`, `obtenerMovimientoCaja`, `obtenerConsolidadoBalanceCaja`, **`obtenerDatosCajaCompleto`** (opcional: devuelve balance + medios + historial en una sola llamada para menos latencia) |
| **Objetivos.js** | `obtenerObjetivosBackend`, `obtenerObjetivosEspecialesVendedor`, `obtenerTodosLosObjetivos`, `guardarObjetivosBackend`, `guardarObjetivoEspecial` |
| **Consolidado.js** | `obtenerReporteConsolidado`, `obtenerComisionesTrimestre`, `obtenerTodasLasComisiones` |
| **Clientes.js** | `obtenerClientesVendedor`, `guardarCliente`, `borrarCliente`, `borrarClientePorDatos` |
| **Stock.js** | Stock e inventario: `obtenerStockBotas`, `crearProductoBota`, `registrarMovimientoStock`, `obtenerMarcasModelos`, `verificarProductosActivosPorModelo`, `obtenerMovimientosStock`, `guardarMarcaModelo`, `eliminarMarcaModelo`, `actualizarEstadoProducto` |
| **Mantenimiento.js** | `agregarColumnasFaltantes` |
| **Constants.js** | `ANIO_ACTIVO` — año activo para filtros (opcional; unifica el año en backend) |
| **Código.js** | Solo comentario de referencia; la lógica está en los módulos anteriores |

### Frontend (HTML)

La app usa **parciales HTML** incluidos con `<?!= includeFile('...'); ?>`. Cada `js-*.html` es un bloque `<script>` que se inyecta en orden; no hay módulos ES, todo comparte el ámbito global.

#### Orden de carga (index.html)

El orden es importante: las variables y funciones deben existir antes de usarse.

| Orden | Archivo        | Qué aporta |
|-------|----------------|------------|
| 1     | **style**      | CSS global. |
| 2     | **js-config**  | Variables globales (`GLOBAL_CONFIG`, `PAIS_CAJA_ACTUAL`, `COTIZACIONES`, `HOJA_ACTUAL`, `USUARIO_ACTUAL`, etc.), listeners (ESC, cambio vendedor/país), helpers (`parseFecha`, `formatNumberAr`, `formatearMonedaPais`). |
| 3     | **js-auth-nav**| Login y navegación: `navegar()`, menús (admin, ventas, stock). |
| 4     | **js-vistas**  | Router de vistas: `cargar(hoja)` y renders de objetivos, consolidado, comisiones, clientes, gestión usuarios. |
| 5     | **js-app**     | **Solo modales compartidos:** `abrirConfirmacion`, `confirmarAccion`, `mostrarAlerta`, `cerrarModals`. Usados por caja, ventas y stock. |
| 6     | **js-caja**    | **Balance de caja:** `renderBalanceCaja`, `poblarSelectsCaja`, `cargarDatosBalance`, historial, medios de pago, modal crear/editar movimiento, configuración por país, `enviarCaja`. |
| 7     | **js-ventas**  | **Ventas por vendedor:** `renderVendedor`, `abrirModalVenta`, `abrirModal`, `enviarVenta`, filtros historial, tablas y tarjetas, `actualizarAvisoPendientes`. |
| 8     | **js-stock**   | Stock de botas: `cargarStock`, `renderizarTarjetasStock`, Cloudinary, movimientos, modales producto y ajuste, marcas/modelos. |

#### Resumen por archivo

| Archivo        | Contenido |
|----------------|-----------|
| **index.html** | Plantilla principal: estructura, menú, contenedor `#app`. Incluye los parciales en el orden indicado arriba. |
| **style.html** | Estilos de la aplicación. |
| **js-config.html** | Config global, variables de estado, formato moneda/fechas, listeners iniciales. |
| **js-auth-nav.html** | Autenticación y navegación entre secciones. |
| **js-vistas.html** | `cargar(hoja)` y renderizado de vistas (objetivos, consolidado, comisiones, clientes, usuarios). |
| **js-app.html** | Solo lógica de **modales** (confirmación, alerta, cerrar). |
| **js-caja.html** | Toda la lógica de **Balance de Caja**: vista por país, totales, medios de pago, historial editable, modal movimiento, configuración conceptos/descripciones/medios. |
| **js-ventas.html** | Toda la lógica de **Ventas**: vista por vendedor, historial con filtros, modal venta crear/editar, tarjetas y tablas, aviso de pendientes. |
| **js-stock.html** | Toda la lógica de **Stock**: tarjetas de productos, movimientos, subida de imágenes (Cloudinary), marcas/modelos. |

Para que la app funcione, en el proyecto de GAS deben estar **index.html**, **style.html** y todos los **js-*.html** listados, en el mismo orden que los incluye `index.html`. Si falta `js-caja.html` o `js-ventas.html`, aparecerán errores como `poblarSelectsCaja is not defined` o `renderBalanceCaja is not defined`.

#### Rendimiento – Balance de Caja

- **Endpoint único (recomendado):** Si en el backend se añade la función `obtenerDatosCajaCompleto(pais, mes, anio)`, el frontend la usa para cargar balance, medios de pago e historial en **una sola llamada**, reduciendo latencia y ejecuciones GAS. Código de ejemplo en **Caja-obtenerDatosCajaCompleto.js** (copiar al Caja.js o Código.gs del proyecto).
- **Caché en el cliente:** Misma vista (país/mes/año) no se vuelve a pedir al backend durante 30 segundos; se muestra desde memoria.
- **Botón "Actualizar":** Fuerza recarga ignorando la caché. Con modo debug activado (ver sección "Modo debug") se registran en consola los tiempos de carga y los hits de caché.

### Hojas de la hoja de cálculo (referencia)

- **USUARIOS** — usuarios y roles  
- **CONFIG-CAJA**, **CONFIG-COTIZACIONES** — configuración de caja y cotizaciones  
- **CONFIG-OBJETIVOS** — objetivos por trimestre  
- **CONFIG-MARCAS-MODELOS** — marcas/tipos/modelos para stock  
- **CAJA** — movimientos de caja (11 columnas: Fecha, Tipo, Concepto, Desc, Forma, Monto, Obs, ESTADO, VENCIMIENTO, PAIS, COTIZACION_USADA)  
- **CLIENTES** — clientes  
- **STOCK_DEFINICION**, **STOCK_MOVIMIENTOS** — productos y movimientos de stock  
- Una hoja por vendedor (nombre del vendedor) para ventas  

---

## Despliegue

1. Instalar [clasp](https://github.com/google/clasp) si se usa línea de comandos:  
   `npm i -g @google/clasp`
2. En la raíz del proyecto: `clasp push` (sube todos los archivos al proyecto de Apps Script).
3. En el editor de Google Apps Script, publicar la app web (Deploy > New deployment) o usar una versión existente.

**Importante:** En el proyecto de GAS deben estar **todos** los archivos HTML que referencia `index.html`: `style.html`, `js-config.html`, `js-auth-nav.html`, `js-vistas.html`, `js-app.html`, `js-caja.html`, `js-ventas.html`, `js-stock.html`. La lógica del frontend está repartida así: **modales** en `js-app.html`, **balance de caja** en `js-caja.html`, **ventas** en `js-ventas.html`, **stock** en `js-stock.html`. Si falta alguno, aparecerán errores como `poblarSelectsCaja is not defined` o `renderBalanceCaja is not defined`. Con `clasp push` se suben todos los `.html` de la carpeta.

Asegurarse también de que en el proyecto estén todos los `.js` listados arriba; si falta alguno, las llamadas del frontend a esas funciones fallarán.

---

## Notas

- **Año centralizado**
  - **Frontend:** En `js-config.html` está la constante `ANIO_ACTIVO = 2026`. Los filtros de año (caja, ventas, consolidado) y las llamadas al backend que envían año usan esta constante. Para cambiar de año solo hay que actualizar `ANIO_ACTIVO` en un lugar.
  - **Backend:** En el proyecto GAS se puede añadir **Constants.js** (en la raíz del repo) con `var ANIO_ACTIVO = 2026;` y usarla en Caja.js, Consolidado.js, Ventas.js, etc. en lugar de valores fijos `2026`. Si no se usa Constants.js, buscar `2026` en los `.gs`/`.js` del backend para cambiarlos.
- **Países**: Se normaliza `USA` → `EEUU` y `ESPAÑA` → `ESPANA` en backend y en algunos selectores del frontend.
