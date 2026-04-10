-- Objetivos por vendedor y rango (sin esquema de "especiales")
-- Ejecutar una sola vez en Supabase SQL editor.

ALTER TABLE public."configObjetivo"
ADD COLUMN IF NOT EXISTS vendedor text;

-- Migrar registros legacy donde identificador contenia el nombre del vendedor.
-- Como el modelo nuevo exige rango numerico, se normalizan a rango 1.
UPDATE public."configObjetivo"
SET vendedor = TRIM(identificador),
    identificador = '1'
WHERE (identificador ~ '[^0-9]')
  AND (vendedor IS NULL OR TRIM(vendedor) = '');

-- Normalizar vendedor vacio a NULL para facilitar fallback a objetivos globales.
UPDATE public."configObjetivo"
SET vendedor = NULL
WHERE vendedor IS NOT NULL
  AND TRIM(vendedor) = '';

CREATE INDEX IF NOT EXISTS idx_configObjetivo_trimestre_vendedor
ON public."configObjetivo"(trimestre, vendedor);
