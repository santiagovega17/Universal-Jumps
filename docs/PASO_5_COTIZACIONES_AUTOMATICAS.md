# Cotizaciones automáticas

Las cotizaciones se actualizan automáticamente desde APIs externas.

## Fuentes de datos

- **USD/ARS**: [dolarapi.com](https://dolarapi.com) (cotización Oficial, venta)
- **Otras monedas**: [exchangerate-api.com](https://www.exchangerate-api.com) (CLP, MXN, EUR, BRL, UYU, etc.)

El factor se calcula como: **ARS por 1 unidad de moneda extranjera**.

## Actualización automática (Cron)

Vercel ejecuta el cron **1 vez al día** a las 12:00 PM hora Argentina (15:00 UTC) para actualizar la tabla `configCotizacion` en Supabase.

- Endpoint: `/api/cron/actualizar-cotizaciones`
- Requiere header `Authorization: Bearer <CRON_SECRET>` si `CRON_SECRET` está configurado

### Configurar CRON_SECRET en Vercel

1. En el proyecto de Vercel → Settings → Environment Variables
2. Agregá `CRON_SECRET` con un valor aleatorio (ej: `openssl rand -hex 32`)
3. Vercel lo envía automáticamente en el header cuando ejecuta el cron

## Actualización manual

### Desde código (admin)

```javascript
google.script.run
  .withSuccessHandler(function(res) {
    if (!res.error) {
      console.log('Cotizaciones actualizadas:', res.actualizados);
      // Recargar COTIZACIONES si es necesario
      google.script.run.withSuccessHandler(function(d) {
        if (!d.error) COTIZACIONES = d.data;
      }).obtenerCotizacionesBackend();
    }
  })
  .withFailureHandler(function(e) { console.error(e); })
  .actualizarCotizacionesDesdeExternas();
```

### Por API (para testing)

```bash
curl -X POST "https://tu-app.vercel.app/api/config?action=actualizar-cotizaciones" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Límites y frecuencia de actualización

- **Vercel Hobby**: el cron solo puede ejecutarse **1 vez por día** como mínimo. Con plan Pro podés usar hasta cada minuto.
- **exchangerate-api** (sin API key): conviene no exceder **1 llamada por hora** para evitar 429. Sus datos se actualizan una vez al día.
- **dolarapi**: no publica límites concretos; un uso moderado (cada pocas horas) suele ser aceptable.

Con el cron actual (1 vez al día a las 12:00 PM Argentina) estás dentro de estos límites.

## Países soportados

| País      | Moneda | Origen        |
|-----------|--------|---------------|
| ARGENTINA | ARS    | 1 (sin conversión) |
| EEUU, RDM | USD    | dolarapi      |
| CHILE     | CLP    | exchangerate-api |
| MEXICO    | MXN    | exchangerate-api |
| ESPANA    | EUR    | exchangerate-api |
| BRASIL    | BRL    | exchangerate-api |
| URUGUAY   | UYU    | exchangerate-api |
