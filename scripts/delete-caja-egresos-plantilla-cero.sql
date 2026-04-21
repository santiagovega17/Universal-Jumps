-- Elimina movimientos de caja "plantilla" (egreso en cero, pendiente, sin datos útiles).
-- Ejecutar primero el SELECT para revisar cuántas filas y cuáles son.
-- Tabla según schema: public."cajaMovimiento"

-- 1) Vista previa (solo lectura)
SELECT id, fecha, tipo, concepto, descripcion, monto, estado, forma_pago, observaciones, vencimiento, pais
FROM public."cajaMovimiento"
WHERE upper(trim(tipo)) = 'EGRESO'
  AND monto = 0
  AND upper(trim(estado)) = 'PENDIENTE'
  AND coalesce(trim(forma_pago), '') = ''
  AND coalesce(trim(observaciones), '') = ''
  AND vencimiento IS NULL;

-- 2) Borrado (descomentar y ejecutar cuando el SELECT sea el esperado)
/*
DELETE FROM public."cajaMovimiento"
WHERE upper(trim(tipo)) = 'EGRESO'
  AND monto = 0
  AND upper(trim(estado)) = 'PENDIENTE'
  AND coalesce(trim(forma_pago), '') = ''
  AND coalesce(trim(observaciones), '') = ''
  AND vencimiento IS NULL;
*/
