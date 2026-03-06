# Paso 2: Conectar repo a Vercel y probar API

Este paso deja una API minima funcionando con Supabase en Vercel.

## 1) Importar el repo en Vercel

1. Entrar a [https://vercel.com/new](https://vercel.com/new).
2. Elegir el repositorio `Universal-Jumps`.
3. Framework Preset: `Other`.
4. Root Directory: dejar la raiz del repo.
5. Deploy.

## 2) Variables de entorno en Vercel

En `Project Settings` -> `Environment Variables`, agregar:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- (opcional) `SUPABASE_ANON_KEY`

Despues de guardarlas, hacer `Redeploy`.

## 3) Endpoints creados

- `GET /api/health`
  - Verifica que el backend puede conectarse a Supabase.
  - Respuesta esperada: `{ ok: true, provider: "supabase", ... }`.

- `GET /api/usuarios/list?limit=50`
  - Lista usuarios de la tabla `usuario`.
  - Usa `limit` entre 1 y 200.

## 4) Prueba rapida

Con la URL de Vercel, por ejemplo `https://tu-app.vercel.app`:

1. Abrir `https://tu-app.vercel.app/api/health`.
2. Si responde `ok: true`, abrir `https://tu-app.vercel.app/api/usuarios/list`.

Si falla:

- Revisar que las variables de entorno esten cargadas correctamente.
- Revisar que la tabla `usuario` exista en Supabase.
- Volver a desplegar en Vercel luego de cambiar variables.

## 5) Siguiente paso recomendado

Implementar endpoints del modulo de caja:

- `GET /api/caja/balance`
- `GET /api/caja/historial`
- `POST /api/caja/movimiento`

asi empezamos a reemplazar `Caja.js` de GAS por API nueva.

