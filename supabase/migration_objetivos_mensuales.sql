-- Objetivos por mes calendario (anio + mes) además de rango y vendedor.
-- La facturación en configObjetivo es META MENSUAL (no trimestral).
-- Ejecutar después de migration_objetivos_por_vendedor.sql si aplica.

ALTER TABLE public."configObjetivo"
ADD COLUMN IF NOT EXISTS anio int;

ALTER TABLE public."configObjetivo"
ADD COLUMN IF NOT EXISTS mes int;

-- Compatibilidad: si esta migración corre antes que la de objetivos por vendedor,
-- aseguramos que exista la columna usada por los índices/filtros.
ALTER TABLE public."configObjetivo"
ADD COLUMN IF NOT EXISTS vendedor text;

-- Datos legacy (solo trimestre): asignar primer mes de cada trimestre y año de trabajo.
-- Podés ajustar 2026 si migrás otro año.
UPDATE public."configObjetivo"
SET
  anio = 2026,
  mes = CASE
    WHEN trimestre_numero IS NOT NULL AND trimestre_numero >= 1 AND trimestre_numero <= 4
      THEN (trimestre_numero - 1) * 3 + 1
    ELSE 1
  END
WHERE anio IS NULL OR mes IS NULL;

-- Etiqueta trimestre coherente con el guardado nuevo (YYYY-MM)
UPDATE public."configObjetivo"
SET trimestre = anio::text || '-' || LPAD(mes::text, 2, '0')
WHERE anio IS NOT NULL AND mes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_configObjetivo_anio_mes_vendedor
ON public."configObjetivo"(anio, mes, vendedor);
