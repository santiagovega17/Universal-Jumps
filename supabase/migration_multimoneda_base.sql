-- Base inicial para desacoplar país y moneda sin romper la app actual.
-- Ejecutar una sola vez en Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1) Catálogo de monedas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."moneda" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  simbolo text DEFAULT '',
  decimales smallint NOT NULL DEFAULT 2,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moneda_activa ON public."moneda"(activa);

ALTER TABLE public."moneda" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'moneda'
      AND policyname = 'Authenticated full access moneda'
  ) THEN
    CREATE POLICY "Authenticated full access moneda"
      ON public."moneda" FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2) Relación país -> monedas habilitadas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."paisMoneda" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pais text NOT NULL,
  moneda_codigo text NOT NULL REFERENCES public."moneda"(codigo) ON DELETE RESTRICT,
  es_default boolean NOT NULL DEFAULT false,
  activa boolean NOT NULL DEFAULT true,
  orden smallint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_paisMoneda_pais_moneda UNIQUE (pais, moneda_codigo)
);

CREATE INDEX IF NOT EXISTS idx_paisMoneda_pais ON public."paisMoneda"(pais);
CREATE INDEX IF NOT EXISTS idx_paisMoneda_moneda_codigo ON public."paisMoneda"(moneda_codigo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_paisMoneda_default_activa
  ON public."paisMoneda"(pais)
  WHERE es_default = true AND activa = true;

ALTER TABLE public."paisMoneda" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paisMoneda'
      AND policyname = 'Authenticated full access paisMoneda'
  ) THEN
    CREATE POLICY "Authenticated full access paisMoneda"
      ON public."paisMoneda" FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 3) Compatibilidad en cotizaciones
-- -----------------------------------------------------------------------------
ALTER TABLE public."configCotizacion"
ADD COLUMN IF NOT EXISTS moneda_codigo text DEFAULT '';

UPDATE public."configCotizacion"
SET moneda_codigo = CASE pais
  WHEN 'ARGENTINA' THEN 'ARS'
  WHEN 'CHILE' THEN 'CLP'
  WHEN 'MEXICO' THEN 'MXN'
  WHEN 'ESPANA' THEN 'EUR'
  WHEN 'BRASIL' THEN 'BRL'
  WHEN 'URUGUAY' THEN 'UYU'
  WHEN 'EEUU' THEN 'USD'
  WHEN 'RDM' THEN 'USD'
  ELSE 'ARS'
END
WHERE moneda_codigo IS NULL OR moneda_codigo = '';

-- -----------------------------------------------------------------------------
-- 4) Venta: guardar moneda explícita y montos preparados para reportes
-- -----------------------------------------------------------------------------
ALTER TABLE public."venta"
ADD COLUMN IF NOT EXISTS moneda_codigo text DEFAULT '';

ALTER TABLE public."venta"
ADD COLUMN IF NOT EXISTS cotizacion_moneda numeric DEFAULT 1;

ALTER TABLE public."venta"
ADD COLUMN IF NOT EXISTS subtotal_moneda numeric DEFAULT 0;

ALTER TABLE public."venta"
ADD COLUMN IF NOT EXISTS total_moneda numeric DEFAULT 0;

ALTER TABLE public."venta"
ADD COLUMN IF NOT EXISTS total_ars numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_venta_moneda_codigo ON public."venta"(moneda_codigo);

UPDATE public."venta"
SET moneda_codigo = CASE pais
  WHEN 'ARGENTINA' THEN 'ARS'
  WHEN 'CHILE' THEN 'CLP'
  WHEN 'MEXICO' THEN 'MXN'
  WHEN 'ESPANA' THEN 'EUR'
  WHEN 'BRASIL' THEN 'BRL'
  WHEN 'URUGUAY' THEN 'UYU'
  WHEN 'EEUU' THEN 'USD'
  WHEN 'RDM' THEN 'USD'
  ELSE 'ARS'
END
WHERE moneda_codigo IS NULL OR moneda_codigo = '';

UPDATE public."venta"
SET cotizacion_moneda = COALESCE(cotizacion, 1)
WHERE cotizacion_moneda IS NULL OR cotizacion_moneda = 0;

UPDATE public."venta"
SET total_moneda = COALESCE(total, 0)
WHERE total_moneda IS NULL OR total_moneda = 0;

UPDATE public."venta"
SET subtotal_moneda = COALESCE(total_sin_iva, 0)
WHERE subtotal_moneda IS NULL OR subtotal_moneda = 0;

UPDATE public."venta"
SET total_ars = CASE
  WHEN COALESCE(moneda_codigo, 'ARS') = 'ARS' THEN COALESCE(total, 0)
  ELSE COALESCE(total, 0) * COALESCE(cotizacion_moneda, cotizacion, 1)
END
WHERE total_ars IS NULL OR total_ars = 0;

-- -----------------------------------------------------------------------------
-- 5) Producto: datos base para vender/facturar luego
-- -----------------------------------------------------------------------------
ALTER TABLE public."producto"
ADD COLUMN IF NOT EXISTS nombre_corto text DEFAULT '';

ALTER TABLE public."producto"
ADD COLUMN IF NOT EXISTS descripcion_fiscal text DEFAULT '';

ALTER TABLE public."producto"
ADD COLUMN IF NOT EXISTS tipo_item text DEFAULT 'PRODUCTO';

ALTER TABLE public."producto"
ADD COLUMN IF NOT EXISTS unidad_medida text DEFAULT 'UN';

ALTER TABLE public."producto"
ADD COLUMN IF NOT EXISTS alicuota_iva numeric;

ALTER TABLE public."producto"
ADD COLUMN IF NOT EXISTS codigo_gtin text DEFAULT '';

ALTER TABLE public."producto"
ADD COLUMN IF NOT EXISTS controla_stock boolean NOT NULL DEFAULT true;

-- -----------------------------------------------------------------------------
-- 6) Precios por producto y moneda
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."productoPrecio" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id uuid NOT NULL REFERENCES public."producto"(id) ON DELETE CASCADE,
  moneda_codigo text NOT NULL REFERENCES public."moneda"(codigo) ON DELETE RESTRICT,
  precio numeric NOT NULL DEFAULT 0,
  es_default boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  vigencia_desde date,
  vigencia_hasta date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_productoPrecio_producto_id ON public."productoPrecio"(producto_id);
CREATE INDEX IF NOT EXISTS idx_productoPrecio_moneda_codigo ON public."productoPrecio"(moneda_codigo);

ALTER TABLE public."productoPrecio" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'productoPrecio'
      AND policyname = 'Authenticated full access productoPrecio'
  ) THEN
    CREATE POLICY "Authenticated full access productoPrecio"
      ON public."productoPrecio" FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 7) Stock: trazabilidad futura
-- -----------------------------------------------------------------------------
ALTER TABLE public."stockMovimiento"
ADD COLUMN IF NOT EXISTS referencia_tipo text DEFAULT '';

ALTER TABLE public."stockMovimiento"
ADD COLUMN IF NOT EXISTS referencia_id uuid;

ALTER TABLE public."stockMovimiento"
ADD COLUMN IF NOT EXISTS costo_moneda_codigo text DEFAULT '';

ALTER TABLE public."stockMovimiento"
ADD COLUMN IF NOT EXISTS costo_unitario numeric;

-- -----------------------------------------------------------------------------
-- 8) Seed inicial
-- -----------------------------------------------------------------------------
INSERT INTO public."moneda" (codigo, nombre, simbolo, decimales)
VALUES
  ('ARS', 'Peso Argentino', '$', 2),
  ('USD', 'Dólar Estadounidense', 'US$', 2),
  ('BRL', 'Real Brasileño', 'R$', 2),
  ('UYU', 'Peso Uruguayo', '$U', 2),
  ('EUR', 'Euro', '€', 2),
  ('CLP', 'Peso Chileno', '$', 0),
  ('MXN', 'Peso Mexicano', '$', 2)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public."paisMoneda" (pais, moneda_codigo, es_default, activa, orden)
VALUES
  ('ARGENTINA', 'ARS', true, true, 1),
  ('ARGENTINA', 'USD', false, true, 2),
  ('CHILE', 'CLP', true, true, 1),
  ('CHILE', 'USD', false, true, 2),
  ('MEXICO', 'MXN', true, true, 1),
  ('MEXICO', 'USD', false, true, 2),
  ('ESPANA', 'EUR', true, true, 1),
  ('ESPANA', 'USD', false, true, 2),
  ('BRASIL', 'BRL', true, true, 1),
  ('BRASIL', 'USD', false, true, 2),
  ('URUGUAY', 'UYU', true, true, 1),
  ('URUGUAY', 'USD', false, true, 2),
  ('EEUU', 'USD', true, true, 1),
  ('RDM', 'USD', true, true, 1),
  ('RDM', 'EUR', false, true, 2)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public."moneda" IS 'Catálogo de monedas habilitadas en el sistema.';
COMMENT ON TABLE public."paisMoneda" IS 'Relación de monedas disponibles por país.';
COMMENT ON TABLE public."productoPrecio" IS 'Precio por producto y moneda.';
