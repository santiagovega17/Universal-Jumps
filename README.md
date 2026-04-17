# Universal Jumps – App Web

Aplicación web para gestión de ventas, caja, objetivos, consolidado, clientes y stock. Desplegada en **Vercel** con backend en **Supabase** (base de datos PostgreSQL) y autenticación con **Google**.

---

## Stack

| Componente | Uso |
|------------|-----|
| **Vercel** | Hosting del frontend estático y funciones serverless (API). |
| **Supabase** | Base de datos PostgreSQL, Auth con Google, tablas: caja, ventas, usuarios, configuración, etc. |
| **Google Auth** | Login mediante cuenta de Google. Solo ingresan usuarios que existan en `usuario` con el mismo email. |
| **Cloudinary** | Solo para **Stock**: subida y entrega de imágenes de productos. En `js-stock.html` se usan `CLOUDINARY_CLOUD_NAME` y `CLOUDINARY_PRESET`. |

---

## Desarrollo local

```bash
npm install
npm run local
```

Abre `http://localhost:3000`. Las variables de entorno van en `.env` (copiar desde `.env.example`).

---

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave pública (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada (backend, nunca en frontend) |
| `GOOGLE_SHEET_ID` | Para migración desde Sheets (opcional) |
| `GOOGLE_SERVICE_ACCOUNT_*` | Credenciales de cuenta de servicio para migración |
| `CRON_SECRET` | Secreto para el cron de cotizaciones (opcional) |

---

## Estructura del proyecto

### Raíz

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Plantilla principal, carga parciales JS/CSS dinámicamente |
| `style.html` | CSS global |
| `js-runtime-bridge.js` | Mapeo de llamadas frontend → API Vercel |
| `js-config.html` | Variables globales, formato moneda/fechas, listeners |
| `js-supabase-auth.html` | Login con Google vía Supabase Auth |
| `js-auth-nav.html` | Navegación y menú |
| `js-vistas.html` | Router y renders (objetivos, consolidado, comisiones, clientes, usuarios) |
| `js-app.html` | Modales compartidos (confirmación, alerta, cerrar) |
| `js-caja.html` | Balance de caja, historial, medios de pago |
| `js-ventas.html` | Ventas por vendedor, historial, modal venta |
| `js-stock.html` | Stock, imágenes (Cloudinary), marcas/modelos |

### API (serverless en Vercel)

| Carpeta / archivo | Descripción |
|-------------------|-------------|
| `api/` | Endpoints: `config`, `caja`, `ventas`, `usuarios`, `clientes`, `reportes`, `auth/perfil`, `env-public` |
| `api/cron/actualizar-cotizaciones.js` | Cron diario para actualizar cotizaciones desde APIs externas |
| `lib/` | Servicios compartidos: `configService`, `cajaService`, `ventasService`, `clienteService`, `reportesService`, `usuarioService`, `supabaseAdmin`, `cotizacionesExternas` |

### Documentación y scripts

| Carpeta / archivo | Descripción |
|-------------------|-------------|
| `docs/PASO_1_SUPABASE.md` | Crear proyecto y tablas en Supabase |
| `docs/PASO_2_VERCEL.md` | Conectar repo a Vercel y probar API |
| `docs/PASO_3_MIGRACION_SHEETS_A_SUPABASE.md` | Migrar datos desde Google Sheets |
| `docs/PASO_4_AUTH_GOOGLE.md` | Configurar Auth con Google en Supabase |
| `docs/PASO_5_COTIZACIONES_AUTOMATICAS.md` | Cron de cotizaciones externas |
| `scripts/migrateSheetsToSupabase.js` | Script de migración desde Sheets |
| `supabase/schema.sql` | Esquema de tablas para Supabase |

---

## Despliegue en Vercel

1. Importar el repo en [vercel.com/new](https://vercel.com/new).
2. Configurar variables de entorno (Settings → Environment Variables).
3. Deploy.

El cron de cotizaciones se ejecuta automáticamente 1 vez al día (12:00 PM Argentina). Configurá `CRON_SECRET` en Vercel para proteger el endpoint.

---

## Modo debug

En la consola del navegador (F12), ejecutar `window.DEBUG = true` y recargar. Los mensajes tendrán formato `[DEBUG][TAG] mensaje`. La función global es `debugLog(tag, message, data)`.

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run local` | Servidor de desarrollo local |
| `npm run migrate:dry` | Migración desde Sheets (simulación) |
| `npm run migrate:run` | Migración desde Sheets (ejecutar) |
