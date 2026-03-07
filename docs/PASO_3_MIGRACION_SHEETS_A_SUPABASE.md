# Paso 3: Migrar datos de Google Sheets a Supabase

Esta guia usa el script `scripts/migrateSheetsToSupabase.js`.

## 1) Preparar cuenta de servicio Google

1. Ir a [Google Cloud Console](https://console.cloud.google.com/).
2. Crear (o usar) proyecto.
3. Habilitar **Google Sheets API**.
4. Crear **Service Account**.
5. Crear una key JSON y descargarla.
6. Compartir tu Google Sheet con el email de la service account (permiso de lectura).

## 2) Completar `.env` local

En `./.env` agregar:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_SHEET_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
MIGRATION_ANIO=2026
```

Notas:

- `GOOGLE_PRIVATE_KEY` debe mantener `\n` literales como en el ejemplo.
- `GOOGLE_SHEET_ID` es el ID entre `/d/` y `/edit` en la URL del Sheet.

## 3) Dry-run (sin escribir en Supabase)

```bash
npm run migrate:dry
```

Esto valida acceso a Google y muestra conteos detectados.

## 4) Migracion real

```bash
npm run migrate:run
```

Este comando corre con `--reset`, asi que limpia tablas destino antes de insertar.

Orden de carga:

1. `usuario`
2. `configCaja`, `configCotizacion`, `configObjetivo`, `configMarcaModelo`
3. `cliente`
4. `producto`
5. `venta`
6. `cajaMovimiento`
7. `stockMovimiento`

## 5) Verificacion recomendada

Probar endpoints:

- `/api/usuarios?action=list&limit=5`
- `/api/caja?action=balance&pais=ARGENTINA&mes=0&anio=2026`
- `/api/caja?action=historial&pais=ARGENTINA&mes=0&anio=2026`

Y revisar tablas en Supabase Table Editor para confirmar volumenes.

## 6) Si falla

- Error de auth Google: revisar `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY`.
- Error de acceso al Sheet: verificar que el Sheet esté compartido con la service account.
- Error de tabla Supabase: verificar que `supabase/schema.sql` esté aplicado.
- Error de claves Supabase: revisar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

