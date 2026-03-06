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

## 3) Endpoints creados (version unificada para Hobby)

- `GET /api/health`
  - Verifica que el backend puede conectarse a Supabase.
  - Respuesta esperada: `{ ok: true, provider: "supabase", ... }`.

- `GET /api/usuarios?action=list&limit=50`
  - Lista usuarios de la tabla `usuario`.
  - Usa `limit` entre 1 y 200.

- `GET /api/usuarios?action=vendedores`
  - Lista vendedores activos/inactivos.

- `GET /api/caja?action=balance&pais=ARGENTINA&mes=0&anio=2026`
  - Calcula balance de caja en formato compatible con GAS.
  - `mes=0` devuelve anual.

- `GET /api/caja?action=historial&pais=ARGENTINA&mes=0&anio=2026`
  - Devuelve historial de `cajaMovimiento` con campos compatibles con `js-caja.html`.

- `GET /api/caja?action=medios&pais=ARGENTINA&mes=0&anio=2026`
  - Devuelve ingresos/egresos/saldo por medio de pago.

- `GET /api/caja?action=datos-completo&pais=ARGENTINA&mes=0&anio=2026`
  - Devuelve `balance + mediosPago + historial` en una llamada.

- `POST /api/caja?action=movimiento`
  - Crea movimientos de caja (uno por cada item en `pagos[]`).
  - Si enviás `id` (o `filaIndex`), actualiza un movimiento existente.

- `POST /api/caja?action=movimiento-estado`
  - Cambia estado de un movimiento (`PAGADO` / `PENDIENTE`).

- `POST /api/caja?action=movimiento-delete`
  - Elimina un movimiento por id.

- `GET /api/config?action=caja|cotizaciones|conceptos|descripciones|medios`
  - Endpoints de configuración en un solo archivo.

## 4) Prueba rapida

Con la URL de Vercel, por ejemplo `https://tu-app.vercel.app`:

1. Abrir `https://tu-app.vercel.app/api/health`.
2. Si responde `ok: true`, abrir `https://tu-app.vercel.app/api/usuarios?action=list`.
3. Probar balance: `https://tu-app.vercel.app/api/caja?action=balance&pais=ARGENTINA&mes=0&anio=2026`.
4. Probar historial: `https://tu-app.vercel.app/api/caja?action=historial&pais=ARGENTINA&mes=0&anio=2026`.

Ejemplo de `POST /api/caja?action=movimiento`:

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

## 5) Nota sobre limites de Vercel Hobby

La API se unifico para mantener pocas Functions y evitar el error de limite del plan Hobby.

