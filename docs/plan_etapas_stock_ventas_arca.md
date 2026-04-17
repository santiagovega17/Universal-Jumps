# Plan por etapas: stock, ventas y facturación ARCA

Documento de referencia para alineación con el cliente y seguimiento del proyecto. Las etapas están ordenadas para reducir riesgo: primero datos y operación de stock, luego ventas, después fiscal y ARCA.

---

## Etapa 1 — Solo stock (UI + datos listos para facturar después)

**Objetivo:** poder cargar y operar stock desde la interfaz, **sin** integrar ventas todavía. Los datos que se capturen deben ser suficientes para que, más adelante, la facturación electrónica no obligue a re-cargar información.

**Alcance sugerido:**

- **Producto (catálogo):** código/SKU, nombre corto, descripción comercial, descripción fiscal, unidad de medida, alícuota de IVA, tipo de ítem (producto/servicio), país, control de stock, división por talles si aplica; opcionalmente código GTIN.
- **Precio por país/moneda:** al dar de alta el artículo, registrar al menos un precio vigente (lista, moneda, vigencia, si el precio incluye o no IVA), alineado con la tabla `productoPrecioPais` en base de datos.
- **Movimientos de stock:** producto, talle, tipo (ingreso/egreso/ajuste según reglas de negocio), cantidad, fecha, país, observaciones; referencia de origen si aplica (compra, ajuste, etc.).

**No incluye en esta etapa:** ventas, descuento automático de stock por venta, emisión ARCA, caja por venta.

---

## Etapa 2 — Integración con ventas

**Objetivo:** en el módulo de ventas poder elegir **productos ya creados**, con **precio e IVA** tomados de lo cargado en Etapa 1 (producto + precio por país/moneda), y que al confirmar la venta se **descuente el stock** de forma consistente (transaccional, sin stock negativo por condiciones de carrera).

**Alcance sugerido:**

- Selector de producto (y talle cuando corresponda).
- Resolución de precio vigente según país/moneda/fecha.
- Líneas de detalle de venta (`ventaItem`) y totales coherentes con IVA.
- Descuento de stock al confirmar venta (y, si el negocio lo exige, reflejo en **caja** en línea con lo que hoy hace una venta cobrada).

**No incluye en esta etapa (salvo que se acuerde explícitamente):** emisión de comprobante electrónico ARCA, CAE, PDF fiscal.

---

## Etapa 3 — Cliente fiscal

**Objetivo:** datos del cliente suficientes para decidir tipo de comprobante A/B/C y validar ante ARCA: tipo y número de documento (códigos ARCA/AFIP), condición frente al IVA, razón social o nombre fiscal, domicilio fiscal, email para envío de comprobante.

---

## Etapa 4 — Comprobante electrónico ARCA

**Objetivo:** emisión real (homologación y luego producción): autenticación/servicio ARCA, armado del request, obtención de CAE, numeración, manejo de timeouts e **idempotencia** (consultar antes de reemitir), concepto de facturación (productos/servicios/ambos), fechas de servicio y vencimiento de pago cuando aplique, tributos adicionales (IIBB/percepciones) y descuentos por ítem alineados con validación fiscal.

---

## Etapa 5 — Operación y cierre

**Objetivo:** notas de crédito, anulaciones si aplica, PDF o comprobante imprimible si el cliente lo requiere, reportes, permisos y endurecimiento (RLS, auditoría), monitoreo básico de errores de emisión.

---

## Nota sobre trabajo ya realizado en código

Existe una base técnica previa (migración SQL, tablas de saldo de stock, detalle de venta, función transaccional de confirmación con bloqueo de filas, endpoint de prueba) que **anticipa parte de la Etapa 2**. No cambia el orden acordado para **comunicación con el cliente**: la Etapa 1 se considera cerrada cuando la **UI de stock** cumple el alcance descrito arriba; la Etapa 2 cuando las **ventas** usan esos datos de forma cotidiana y el stock se descuenta de forma fiable.

---

## Resumen en una frase por etapa

| Etapa | En una frase |
|-------|----------------|
| 1 | Cargar productos, precios por país y movimientos de stock, con datos pensados para facturar después. |
| 2 | Vender eligiendo esos productos, con precio e IVA correctos y stock descontado (y caja si corresponde). |
| 3 | Clientes con datos fiscales completos para A/B/C. |
| 4 | Emitir comprobantes electrónicos ARCA con CAE e idempotencia. |
| 5 | NC, PDF, reportes y endurecimiento operativo. |

---

*Última actualización: acuerdo de etapas con el titular del proyecto para presentación y cobro por fases.*
