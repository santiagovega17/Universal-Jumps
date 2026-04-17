-- =============================================================================
-- Etapa 1 Stock + Base fiscal ARCA
-- Ejecutar una sola vez en Supabase SQL Editor.
-- Diseño idempotente: usa IF NOT EXISTS / DO blocks para convivir con entornos
-- donde parte del esquema ya existe.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1) Precio por producto/pais/moneda (desde alta de articulo)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."productoPrecioPais" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id uuid NOT NULL REFERENCES public."producto"(id) ON DELETE CASCADE,
  pais text NOT NULL,
  moneda_codigo text NOT NULL REFERENCES public."moneda"(codigo) ON DELETE RESTRICT,
  precio_lista numeric NOT NULL DEFAULT 0,
  precio_minimo numeric,
  incluye_iva boolean NOT NULL DEFAULT true,
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_productoPrecioPais_precio_lista_nonneg CHECK (precio_lista >= 0),
  CONSTRAINT ck_productoPrecioPais_precio_minimo_nonneg CHECK (precio_minimo IS NULL OR precio_minimo >= 0),
  CONSTRAINT ck_productoPrecioPais_vigencias CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde),
  CONSTRAINT uq_productoPrecioPais_producto_pais_moneda_vdesde UNIQUE (producto_id, pais, moneda_codigo, vigencia_desde)
);

CREATE INDEX IF NOT EXISTS idx_productoPrecioPais_lookup
  ON public."productoPrecioPais"(producto_id, pais, moneda_codigo, activo, vigencia_desde);

CREATE INDEX IF NOT EXISTS idx_productoPrecioPais_pais_moneda
  ON public."productoPrecioPais"(pais, moneda_codigo);

ALTER TABLE public."productoPrecioPais" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'productoPrecioPais'
      AND policyname = 'Authenticated full access productoPrecioPais'
  ) THEN
    CREATE POLICY "Authenticated full access productoPrecioPais"
      ON public."productoPrecioPais" FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public."productoPrecioPais" IS 'Precio por producto, pais y moneda, con vigencia.';

-- -----------------------------------------------------------------------------
-- 2) Saldo actual de stock (para control concurrente con FOR UPDATE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."stockSaldo" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id uuid NOT NULL REFERENCES public."producto"(id) ON DELETE RESTRICT,
  talle text NOT NULL DEFAULT 'UNICO',
  pais text NOT NULL DEFAULT 'ARGENTINA',
  cantidad_disponible numeric NOT NULL DEFAULT 0,
  cantidad_reservada numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stockSaldo_producto_talle_pais UNIQUE (producto_id, talle, pais),
  CONSTRAINT ck_stockSaldo_disponible_nonneg CHECK (cantidad_disponible >= 0),
  CONSTRAINT ck_stockSaldo_reservada_nonneg CHECK (cantidad_reservada >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stockSaldo_producto_pais_talle
  ON public."stockSaldo"(producto_id, pais, talle);

ALTER TABLE public."stockSaldo" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stockSaldo'
      AND policyname = 'Authenticated full access stockSaldo'
  ) THEN
    CREATE POLICY "Authenticated full access stockSaldo"
      ON public."stockSaldo" FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public."stockSaldo" IS 'Saldo actual de stock por producto+talle+pais.';

-- -----------------------------------------------------------------------------
-- 3) Enriquecer stockMovimiento para trazabilidad operativa/fiscal
-- -----------------------------------------------------------------------------
ALTER TABLE public."stockMovimiento"
ADD COLUMN IF NOT EXISTS origen_tipo text DEFAULT '';

ALTER TABLE public."stockMovimiento"
ADD COLUMN IF NOT EXISTS origen_id uuid;

CREATE INDEX IF NOT EXISTS idx_stockMovimiento_origen
  ON public."stockMovimiento"(origen_tipo, origen_id);

COMMENT ON COLUMN public."stockMovimiento".origen_tipo IS 'VENTA, COMPRA, AJUSTE, DEVOLUCION, etc.';
COMMENT ON COLUMN public."stockMovimiento".origen_id IS 'ID de la entidad origen (venta/comprobante/etc).';

-- -----------------------------------------------------------------------------
-- 4) Cliente: datos fiscales para mapping ARCA
-- -----------------------------------------------------------------------------
ALTER TABLE public."cliente"
ADD COLUMN IF NOT EXISTS tipo_doc text DEFAULT '';

ALTER TABLE public."cliente"
ADD COLUMN IF NOT EXISTS tipo_doc_codigo smallint;

ALTER TABLE public."cliente"
ADD COLUMN IF NOT EXISTS nro_doc text DEFAULT '';

ALTER TABLE public."cliente"
ADD COLUMN IF NOT EXISTS condicion_iva text DEFAULT '';

ALTER TABLE public."cliente"
ADD COLUMN IF NOT EXISTS razon_social text DEFAULT '';

ALTER TABLE public."cliente"
ADD COLUMN IF NOT EXISTS domicilio_fiscal text DEFAULT '';

ALTER TABLE public."cliente"
ADD COLUMN IF NOT EXISTS email_facturacion text DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_cliente_tipo_doc_codigo'
      AND conrelid = 'public."cliente"'::regclass
  ) THEN
    ALTER TABLE public."cliente"
    ADD CONSTRAINT ck_cliente_tipo_doc_codigo
    CHECK (tipo_doc_codigo IS NULL OR tipo_doc_codigo IN (80, 86, 87, 89, 90, 91, 92, 93, 94, 95, 96, 99));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_cliente_tipo_doc_nro
  ON public."cliente"(tipo_doc_codigo, nro_doc);

COMMENT ON COLUMN public."cliente".tipo_doc_codigo IS 'Codigo ARCA/AFIP (ej: 80=CUIT, 96=DNI, 99=Consumidor Final).';

-- -----------------------------------------------------------------------------
-- 5) Venta en detalle (cabecera/detalle) con descuentos por linea
-- -----------------------------------------------------------------------------
ALTER TABLE public."venta"
ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public."cliente"(id) ON DELETE SET NULL;

ALTER TABLE public."venta"
ADD COLUMN IF NOT EXISTS estado_documental text NOT NULL DEFAULT 'BORRADOR';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_venta_estado_documental'
      AND conrelid = 'public."venta"'::regclass
  ) THEN
    ALTER TABLE public."venta"
    ADD CONSTRAINT ck_venta_estado_documental
    CHECK (estado_documental IN ('BORRADOR', 'CONFIRMADA', 'FACTURADA', 'ANULADA'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_venta_cliente_id ON public."venta"(cliente_id);
CREATE INDEX IF NOT EXISTS idx_venta_estado_documental ON public."venta"(estado_documental);

CREATE TABLE IF NOT EXISTS public."ventaItem" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id uuid NOT NULL REFERENCES public."venta"(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public."producto"(id) ON DELETE RESTRICT,
  talle text NOT NULL DEFAULT 'UNICO',
  cantidad numeric NOT NULL DEFAULT 0,
  precio_unitario numeric NOT NULL DEFAULT 0,
  porcentaje_descuento numeric DEFAULT 0,
  descuento_monto numeric DEFAULT 0,
  alicuota_iva numeric,
  subtotal_neto numeric NOT NULL DEFAULT 0,
  subtotal_iva numeric NOT NULL DEFAULT 0,
  subtotal_total numeric NOT NULL DEFAULT 0,
  precio_fuente_id uuid REFERENCES public."productoPrecioPais"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_ventaItem_cantidad_pos CHECK (cantidad > 0),
  CONSTRAINT ck_ventaItem_precio_nonneg CHECK (precio_unitario >= 0),
  CONSTRAINT ck_ventaItem_descuento_pct CHECK (porcentaje_descuento IS NULL OR (porcentaje_descuento >= 0 AND porcentaje_descuento <= 100)),
  CONSTRAINT ck_ventaItem_descuento_monto CHECK (descuento_monto IS NULL OR descuento_monto >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ventaItem_venta_id ON public."ventaItem"(venta_id);
CREATE INDEX IF NOT EXISTS idx_ventaItem_producto_talle ON public."ventaItem"(producto_id, talle);

ALTER TABLE public."ventaItem" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ventaItem'
      AND policyname = 'Authenticated full access ventaItem'
  ) THEN
    CREATE POLICY "Authenticated full access ventaItem"
      ON public."ventaItem" FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public."ventaItem" IS 'Detalle de venta con descuento antes de IVA.';

-- -----------------------------------------------------------------------------
-- 6) Comprobantes ARCA (cabecera/items/tributos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."comprobanteVenta" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id uuid REFERENCES public."venta"(id) ON DELETE SET NULL,
  tipo_cbte text NOT NULL,
  pto_vta integer NOT NULL,
  numero bigint NOT NULL,
  fecha_emision date NOT NULL,
  concepto integer NOT NULL DEFAULT 3, -- 1 productos, 2 servicios, 3 ambos
  fecha_servicio_desde date,
  fecha_servicio_hasta date,
  fecha_vencimiento_pago date,
  moneda text NOT NULL DEFAULT 'PES',
  cotizacion numeric NOT NULL DEFAULT 1,
  importe_neto numeric NOT NULL DEFAULT 0,
  importe_iva numeric NOT NULL DEFAULT 0,
  importe_total numeric NOT NULL DEFAULT 0,
  otros_tributos jsonb,
  resultado_arca text DEFAULT '',
  cae text DEFAULT '',
  cae_vto date,
  payload_request jsonb,
  payload_response jsonb,
  estado_envio_arca text NOT NULL DEFAULT 'PENDIENTE',
  intentos_envio integer NOT NULL DEFAULT 0,
  hash_payload text,
  ultimo_error_arca text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_comprobanteVenta_ptovta_tipo_num UNIQUE (pto_vta, tipo_cbte, numero),
  CONSTRAINT ck_comprobanteVenta_concepto CHECK (concepto IN (1, 2, 3)),
  CONSTRAINT ck_comprobanteVenta_importes_nonneg CHECK (importe_neto >= 0 AND importe_iva >= 0 AND importe_total >= 0),
  CONSTRAINT ck_comprobanteVenta_intentos_nonneg CHECK (intentos_envio >= 0),
  CONSTRAINT ck_comprobanteVenta_fechas_servicio
    CHECK (
      (concepto IN (1))
      OR (
        concepto IN (2, 3)
        AND fecha_servicio_desde IS NOT NULL
        AND fecha_servicio_hasta IS NOT NULL
        AND fecha_vencimiento_pago IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_comprobanteVenta_venta_id ON public."comprobanteVenta"(venta_id);
CREATE INDEX IF NOT EXISTS idx_comprobanteVenta_cae ON public."comprobanteVenta"(cae);
CREATE INDEX IF NOT EXISTS idx_comprobanteVenta_estado_envio ON public."comprobanteVenta"(estado_envio_arca);

ALTER TABLE public."comprobanteVenta" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comprobanteVenta'
      AND policyname = 'Authenticated full access comprobanteVenta'
  ) THEN
    CREATE POLICY "Authenticated full access comprobanteVenta"
      ON public."comprobanteVenta" FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public."comprobanteItem" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comprobante_id uuid NOT NULL REFERENCES public."comprobanteVenta"(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public."producto"(id) ON DELETE SET NULL,
  descripcion text NOT NULL DEFAULT '',
  unidad_medida text DEFAULT 'UN',
  cantidad numeric NOT NULL DEFAULT 0,
  precio_unitario numeric NOT NULL DEFAULT 0,
  porcentaje_descuento numeric DEFAULT 0,
  descuento_monto numeric DEFAULT 0,
  alicuota_iva numeric,
  subtotal_neto numeric NOT NULL DEFAULT 0,
  subtotal_iva numeric NOT NULL DEFAULT 0,
  subtotal_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_comprobanteItem_cantidad_pos CHECK (cantidad > 0),
  CONSTRAINT ck_comprobanteItem_precio_nonneg CHECK (precio_unitario >= 0),
  CONSTRAINT ck_comprobanteItem_descuento_pct CHECK (porcentaje_descuento IS NULL OR (porcentaje_descuento >= 0 AND porcentaje_descuento <= 100)),
  CONSTRAINT ck_comprobanteItem_descuento_monto CHECK (descuento_monto IS NULL OR descuento_monto >= 0)
);

CREATE INDEX IF NOT EXISTS idx_comprobanteItem_comprobante_id ON public."comprobanteItem"(comprobante_id);

ALTER TABLE public."comprobanteItem" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comprobanteItem'
      AND policyname = 'Authenticated full access comprobanteItem'
  ) THEN
    CREATE POLICY "Authenticated full access comprobanteItem"
      ON public."comprobanteItem" FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public."comprobanteTributo" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comprobante_id uuid NOT NULL REFERENCES public."comprobanteVenta"(id) ON DELETE CASCADE,
  tributo_codigo text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  base_imponible numeric NOT NULL DEFAULT 0,
  alicuota numeric,
  importe numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_comprobanteTributo_base_nonneg CHECK (base_imponible >= 0),
  CONSTRAINT ck_comprobanteTributo_importe_nonneg CHECK (importe >= 0)
);

CREATE INDEX IF NOT EXISTS idx_comprobanteTributo_comprobante_id
  ON public."comprobanteTributo"(comprobante_id);

ALTER TABLE public."comprobanteTributo" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comprobanteTributo'
      AND policyname = 'Authenticated full access comprobanteTributo'
  ) THEN
    CREATE POLICY "Authenticated full access comprobanteTributo"
      ON public."comprobanteTributo" FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public."comprobanteVenta" IS 'Cabecera de comprobante fiscal ARCA.';
COMMENT ON TABLE public."comprobanteItem" IS 'Detalle fiscal (snapshot) del comprobante emitido.';
COMMENT ON TABLE public."comprobanteTributo" IS 'Tributos/percepciones (IIBB, etc.) por comprobante.';

-- -----------------------------------------------------------------------------
-- 7) Seed inicial de stockSaldo desde historial existente
-- -----------------------------------------------------------------------------
INSERT INTO public."stockSaldo" (producto_id, talle, pais, cantidad_disponible, cantidad_reservada)
SELECT
  sm.producto_id,
  COALESCE(NULLIF(TRIM(sm.talle), ''), 'UNICO') AS talle,
  COALESCE(NULLIF(TRIM(sm.pais), ''), 'ARGENTINA') AS pais,
  GREATEST(
    SUM(
      CASE
        WHEN UPPER(COALESCE(sm.tipo, '')) IN ('INGRESO', 'AJUSTE_POSITIVO', 'LIBERACION_RESERVA') THEN COALESCE(sm.cantidad, 0)
        WHEN UPPER(COALESCE(sm.tipo, '')) IN ('EGRESO', 'AJUSTE_NEGATIVO', 'RESERVA') THEN -COALESCE(sm.cantidad, 0)
        ELSE 0
      END
    ),
    0
  ) AS cantidad_disponible,
  0 AS cantidad_reservada
FROM public."stockMovimiento" sm
GROUP BY sm.producto_id, COALESCE(NULLIF(TRIM(sm.talle), ''), 'UNICO'), COALESCE(NULLIF(TRIM(sm.pais), ''), 'ARGENTINA')
ON CONFLICT (producto_id, talle, pais) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8) Funcion transaccional de confirmacion de venta con lock de stock
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_confirmar_venta_con_stock(
  p_usuario_id uuid,
  p_vendedor text,
  p_fecha date,
  p_pais text,
  p_cliente_id uuid,
  p_cliente text,
  p_forma_pago text,
  p_moneda_codigo text,
  p_cotizacion_moneda numeric,
  p_observaciones text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_venta_id uuid;
  v_item jsonb;
  v_producto_id uuid;
  v_talle text;
  v_cantidad numeric;
  v_precio_unitario numeric;
  v_descuento_pct numeric;
  v_descuento_monto numeric;
  v_alicuota numeric;
  v_importe_bruto numeric;
  v_importe_descuento numeric;
  v_neto numeric;
  v_iva numeric;
  v_total_item numeric;
  v_total numeric := 0;
  v_total_neto numeric := 0;
  v_total_iva numeric := 0;
  v_total_ars numeric := 0;
  v_stock_disponible numeric;
  v_precio_fuente_id uuid;
  v_moneda text := COALESCE(NULLIF(TRIM(p_moneda_codigo), ''), 'ARS');
  v_cotizacion numeric := COALESCE(NULLIF(p_cotizacion_moneda, 0), 1);
BEGIN
  IF p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'usuario_id es requerido';
  END IF;
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'fecha es requerida';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items es requerido y debe ser un array no vacio';
  END IF;

  -- 1) Bloquear filas de stock objetivo para evitar carrera
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_talle := COALESCE(NULLIF(TRIM(v_item->>'talle'), ''), 'UNICO');

    IF v_producto_id IS NULL THEN
      RAISE EXCEPTION 'Cada item debe incluir producto_id';
    END IF;

    -- lock fila existente
    SELECT ss.cantidad_disponible
      INTO v_stock_disponible
    FROM public."stockSaldo" ss
    WHERE ss.producto_id = v_producto_id
      AND ss.talle = v_talle
      AND ss.pais = COALESCE(NULLIF(TRIM(p_pais), ''), 'ARGENTINA')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe stockSaldo para producto %, talle %, pais %',
        v_producto_id, v_talle, COALESCE(NULLIF(TRIM(p_pais), ''), 'ARGENTINA');
    END IF;
  END LOOP;

  -- 2) Crear cabecera de venta
  INSERT INTO public."venta" (
    usuario_id, vendedor, fecha, estado, chequeado, pais, cliente_id, cliente,
    forma_pago, total, total_sin_iva, moneda_codigo, cotizacion_moneda,
    subtotal_moneda, total_moneda, total_ars, observaciones, cotizacion, anio,
    estado_documental
  )
  VALUES (
    p_usuario_id,
    COALESCE(NULLIF(TRIM(p_vendedor), ''), ''),
    p_fecha,
    'PENDIENTE',
    'NO',
    COALESCE(NULLIF(TRIM(p_pais), ''), 'ARGENTINA'),
    p_cliente_id,
    COALESCE(NULLIF(TRIM(p_cliente), ''), ''),
    COALESCE(NULLIF(TRIM(p_forma_pago), ''), ''),
    0, 0, v_moneda, v_cotizacion,
    0, 0, 0, COALESCE(p_observaciones, ''), v_cotizacion,
    EXTRACT(YEAR FROM p_fecha)::smallint,
    'CONFIRMADA'
  )
  RETURNING id INTO v_venta_id;

  -- 3) Insertar items, descontar stock y generar movimientos
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_talle := COALESCE(NULLIF(TRIM(v_item->>'talle'), ''), 'UNICO');
    v_cantidad := COALESCE((v_item->>'cantidad')::numeric, 0);
    v_precio_unitario := COALESCE((v_item->>'precio_unitario')::numeric, 0);
    v_descuento_pct := COALESCE((v_item->>'porcentaje_descuento')::numeric, 0);
    v_descuento_monto := COALESCE((v_item->>'descuento_monto')::numeric, 0);
    v_alicuota := COALESCE((v_item->>'alicuota_iva')::numeric, 21);
    v_precio_fuente_id := NULLIF(v_item->>'precio_fuente_id', '')::uuid;

    IF v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para producto %', v_producto_id;
    END IF;
    IF v_precio_unitario < 0 THEN
      RAISE EXCEPTION 'Precio unitario invalido para producto %', v_producto_id;
    END IF;
    IF v_descuento_pct < 0 OR v_descuento_pct > 100 THEN
      RAISE EXCEPTION 'Porcentaje descuento invalido para producto %', v_producto_id;
    END IF;
    IF v_descuento_monto < 0 THEN
      RAISE EXCEPTION 'Descuento monto invalido para producto %', v_producto_id;
    END IF;

    SELECT ss.cantidad_disponible
      INTO v_stock_disponible
    FROM public."stockSaldo" ss
    WHERE ss.producto_id = v_producto_id
      AND ss.talle = v_talle
      AND ss.pais = COALESCE(NULLIF(TRIM(p_pais), ''), 'ARGENTINA')
    FOR UPDATE;

    IF v_stock_disponible < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %, talle %: disponible %, solicitado %',
        v_producto_id, v_talle, v_stock_disponible, v_cantidad;
    END IF;

    v_importe_bruto := v_cantidad * v_precio_unitario;
    v_importe_descuento := GREATEST((v_importe_bruto * (v_descuento_pct / 100)) + v_descuento_monto, 0);
    v_importe_descuento := LEAST(v_importe_descuento, v_importe_bruto);
    v_neto := v_importe_bruto - v_importe_descuento;
    v_iva := v_neto * (v_alicuota / 100);
    v_total_item := v_neto + v_iva;

    INSERT INTO public."ventaItem" (
      venta_id, producto_id, talle, cantidad, precio_unitario,
      porcentaje_descuento, descuento_monto, alicuota_iva,
      subtotal_neto, subtotal_iva, subtotal_total, precio_fuente_id
    )
    VALUES (
      v_venta_id, v_producto_id, v_talle, v_cantidad, v_precio_unitario,
      v_descuento_pct, v_importe_descuento, v_alicuota,
      v_neto, v_iva, v_total_item, v_precio_fuente_id
    );

    INSERT INTO public."stockMovimiento" (
      producto_id, fecha, talle, tipo, cantidad, referencia_tipo, referencia_id,
      observacion_usuario, pais, origen_tipo, origen_id
    )
    VALUES (
      v_producto_id, p_fecha, v_talle, 'EGRESO', v_cantidad, 'VENTA', v_venta_id,
      COALESCE(p_observaciones, ''), COALESCE(NULLIF(TRIM(p_pais), ''), 'ARGENTINA'),
      'VENTA', v_venta_id
    );

    UPDATE public."stockSaldo"
    SET cantidad_disponible = cantidad_disponible - v_cantidad,
        updated_at = now()
    WHERE producto_id = v_producto_id
      AND talle = v_talle
      AND pais = COALESCE(NULLIF(TRIM(p_pais), ''), 'ARGENTINA');

    v_total := v_total + v_total_item;
    v_total_neto := v_total_neto + v_neto;
    v_total_iva := v_total_iva + v_iva;
  END LOOP;

  v_total_ars := CASE WHEN v_moneda = 'ARS' THEN v_total ELSE v_total * v_cotizacion END;

  UPDATE public."venta"
  SET total = v_total,
      total_sin_iva = v_total_neto,
      subtotal_moneda = v_total_neto,
      total_moneda = v_total,
      total_ars = v_total_ars,
      updated_at = now()
  WHERE id = v_venta_id;

  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'total', v_total,
    'total_neto', v_total_neto,
    'total_iva', v_total_iva,
    'total_ars', v_total_ars
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 9) Notas operativas (aplican en capa de servicio/API)
-- -----------------------------------------------------------------------------
-- A) Confirmacion de venta concurrente:
--    - Iniciar transaccion
--    - SELECT ... FROM stockSaldo WHERE ... FOR UPDATE
--    - Validar disponible >= cantidad
--    - Insertar venta + ventaItem
--    - Insertar stockMovimiento (EGRESO)
--    - Actualizar stockSaldo
--    - Commit
--
-- B) Idempotencia ARCA:
--    - Ante timeout, no reemitir directo.
--    - Consultar primero estado del comprobante (equivalente FECompConsultar)
--      usando ptovta/tipo/numero y/o hash_payload.
--    - Reintentar solo si no hay comprobante emitido.
