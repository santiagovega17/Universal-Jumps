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

- `GET /api/caja/balance?pais=ARGENTINA&mes=0&anio=2026`
  - Calcula balance de caja en formato compatible con GAS.
  - `mes=0` devuelve anual.

- `GET /api/caja/historial?pais=ARGENTINA&mes=0&anio=2026`
  - Devuelve historial de `cajaMovimiento` con campos compatibles con `js-caja.html`.

- `POST /api/caja/movimiento`
  - Crea movimientos de caja (uno por cada item en `pagos[]`).
  - Si enviás `id` (o `filaIndex`), actualiza un movimiento existente.

## 4) Prueba rapida

Con la URL de Vercel, por ejemplo `https://tu-app.vercel.app`:

1. Abrir `https://tu-app.vercel.app/api/health`.
2. Si responde `ok: true`, abrir `https://tu-app.vercel.app/api/usuarios/list`.
3. Probar balance: `https://tu-app.vercel.app/api/caja/balance?pais=ARGENTINA&mes=0&anio=2026`.
4. Probar historial: `https://tu-app.vercel.app/api/caja/historial?pais=ARGENTINA&mes=0&anio=2026`.

Ejemplo de `POST /api/caja/movimiento`:

```json
{
  "fecha": "2026-03-06",
  "tipo": "EGRESO",
  "concepto": "SERVICIOS",
  "descripcion": "INTERNET",
  "estado": "PAGADO",
  "vencimiento": "",
  "observaciones": "Alta inicial",
  "pais": "ARGENTINA",
  "pagos": [
    { "forma": "Transferencia", "monto": 15000 }
  ]
}
```

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

