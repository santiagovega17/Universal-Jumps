-- =============================================================================
-- Universal Jumps – Esquema Supabase (UML: nombres en camelCase)
-- - Tablas en singular y camelCase: cajaMovimiento, configCaja, etc.
-- - Relaciones con claves foráneas (venta → usuario, stockMovimiento → producto)
-- Ejecutar en Supabase → SQL Editor → New query → Pegar y Run
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Usuario (usuario del sistema / vendedor)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."usuario" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  rol text NOT NULL DEFAULT 'VENDEDOR',
  nombre text NOT NULL,
  activo text NOT NULL DEFAULT 'SI',
  tipo_objetivo text DEFAULT '',
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuario_email ON public."usuario"(email);
CREATE INDEX IF NOT EXISTS idx_usuario_auth_user_id ON public."usuario"(auth_user_id);

-- -----------------------------------------------------------------------------
-- CajaMovimiento (movimiento de caja)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."cajaMovimiento" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha date NOT NULL,
  tipo text NOT NULL,
  concepto text NOT NULL DEFAULT '',
  descripcion text DEFAULT '',
  forma_pago text DEFAULT '',
  monto numeric NOT NULL DEFAULT 0,
  observaciones text DEFAULT '',
  estado text DEFAULT 'PAGADO',
  vencimiento date,
  pais text NOT NULL DEFAULT 'ARGENTINA',
  cotizacion_usada text DEFAULT '',
  anio smallint,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cajaMovimiento_fecha ON public."cajaMovimiento"(fecha);
CREATE INDEX IF NOT EXISTS idx_cajaMovimiento_pais_anio ON public."cajaMovimiento"(pais, anio);
CREATE INDEX IF NOT EXISTS idx_cajaMovimiento_tipo ON public."cajaMovimiento"(tipo);

-- -----------------------------------------------------------------------------
-- ConfigCaja (ítem de configuración: concepto, medio, descripción)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."configCaja" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo text NOT NULL,
  nombre text NOT NULL,
  padre text DEFAULT '',
  pais text NOT NULL DEFAULT 'ARGENTINA',
  sentido text DEFAULT 'EGRESO',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configCaja_pais_tipo ON public."configCaja"(pais, tipo);

-- -----------------------------------------------------------------------------
-- ConfigCotizacion (cotización por país)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."configCotizacion" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pais text NOT NULL UNIQUE,
  factor numeric NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- ConfigObjetivo (objetivo por trimestre / rango o vendedor)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."configObjetivo" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trimestre text NOT NULL,
  trimestre_numero int,
  identificador text NOT NULL,
  porcentaje_botas numeric DEFAULT 0,
  porcentaje_certs numeric DEFAULT 0,
  unidades_botas int DEFAULT 0,
  unidades_certs int DEFAULT 0,
  facturacion_botas numeric DEFAULT 0,
  facturacion_certs numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configObjetivo_trimestre ON public."configObjetivo"(trimestre);

-- -----------------------------------------------------------------------------
-- Cliente
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."cliente" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre text DEFAULT '',
  apellido text DEFAULT '',
  dni text DEFAULT '',
  telefono text DEFAULT '',
  correo text DEFAULT '',
  domicilio text DEFAULT '',
  provincia text DEFAULT '',
  pais text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_pais ON public."cliente"(pais);

-- -----------------------------------------------------------------------------
-- Venta (cada venta pertenece a un usuario/vendedor)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."venta" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id uuid NOT NULL REFERENCES public."usuario"(id) ON DELETE RESTRICT,
  vendedor text NOT NULL,
  fecha date NOT NULL,
  estado text DEFAULT 'PENDIENTE',
  chequeado text DEFAULT 'NO',
  pais text NOT NULL DEFAULT 'ARGENTINA',
  cliente text DEFAULT '',
  concepto text DEFAULT '',
  forma_pago text DEFAULT '',
  cantidad numeric DEFAULT 0,
  precio numeric DEFAULT 0,
  total numeric DEFAULT 0,
  total_sin_iva numeric DEFAULT 0,
  observaciones text DEFAULT '',
  cotizacion numeric DEFAULT 1,
  anio smallint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venta_usuario_id ON public."venta"(usuario_id);
CREATE INDEX IF NOT EXISTS idx_venta_vendedor ON public."venta"(vendedor);
CREATE INDEX IF NOT EXISTS idx_venta_fecha_anio ON public."venta"(fecha, anio);
CREATE INDEX IF NOT EXISTS idx_venta_pais ON public."venta"(pais);

-- -----------------------------------------------------------------------------
-- Producto (definición de producto en stock). codigo = ID de negocio
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."producto" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo text NOT NULL UNIQUE,
  marca text DEFAULT '',
  tipo text DEFAULT '',
  modelo text DEFAULT '',
  color text DEFAULT '',
  descripcion text DEFAULT '',
  imagen_url text DEFAULT '',
  activo text NOT NULL DEFAULT 'SI',
  divide_talles text NOT NULL DEFAULT 'SI',
  pais text NOT NULL DEFAULT 'ARGENTINA',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producto_pais ON public."producto"(pais);
CREATE INDEX IF NOT EXISTS idx_producto_activo ON public."producto"(activo);
CREATE INDEX IF NOT EXISTS idx_producto_codigo ON public."producto"(codigo);

-- -----------------------------------------------------------------------------
-- StockMovimiento (cada movimiento pertenece a un producto)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."stockMovimiento" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id uuid NOT NULL REFERENCES public."producto"(id) ON DELETE RESTRICT,
  fecha date NOT NULL,
  talle text DEFAULT 'UNICO',
  tipo text NOT NULL,
  cantidad numeric NOT NULL DEFAULT 0,
  observacion_usuario text DEFAULT '',
  pais text NOT NULL DEFAULT 'ARGENTINA',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stockMovimiento_producto_id ON public."stockMovimiento"(producto_id);
CREATE INDEX IF NOT EXISTS idx_stockMovimiento_pais_fecha ON public."stockMovimiento"(pais, fecha);

-- -----------------------------------------------------------------------------
-- ConfigMarcaModelo (marca, tipo, modelo para catálogo)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."configMarcaModelo" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  marca text NOT NULL,
  tipo text DEFAULT '',
  modelo text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_configMarcaModelo_marca_tipo_modelo UNIQUE (marca, tipo, modelo)
);

CREATE INDEX IF NOT EXISTS idx_configMarcaModelo_marca ON public."configMarcaModelo"(marca);

-- -----------------------------------------------------------------------------
-- RLS (Row Level Security)
-- -----------------------------------------------------------------------------
ALTER TABLE public."usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cajaMovimiento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."configCaja" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."configCotizacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."configObjetivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."venta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."producto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stockMovimiento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."configMarcaModelo" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access usuario" ON public."usuario" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access cajaMovimiento" ON public."cajaMovimiento" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access configCaja" ON public."configCaja" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access configCotizacion" ON public."configCotizacion" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access configObjetivo" ON public."configObjetivo" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access cliente" ON public."cliente" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access venta" ON public."venta" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access producto" ON public."producto" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access stockMovimiento" ON public."stockMovimiento" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access configMarcaModelo" ON public."configMarcaModelo" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public."usuario" IS 'Usuario (vendedor/admin). nombre = nombre de hoja del vendedor.';
COMMENT ON TABLE public."cajaMovimiento" IS 'Movimiento de caja.';
COMMENT ON TABLE public."venta" IS 'Venta. Relación N:1 con Usuario (vendedor).';
COMMENT ON TABLE public."producto" IS 'Producto (definición de stock). codigo = ID de negocio.';
COMMENT ON TABLE public."stockMovimiento" IS 'Movimiento de stock. Relación N:1 con Producto.';

-- =============================================================================
-- NOTA: Migración desde Sheets y uso en la API
-- =============================================================================
--
-- 1) VENTAS
--    En la hoja solo tenés el nombre del vendedor (ej. "María Laura"). En esta
--    base, cada venta tiene usuario_id (UUID) que apunta a un registro en "usuario".
--    • Al MIGRAR: por cada fila de venta, buscás en "usuario" el que tiene
--      nombre = ese vendedor y guardás su id en venta.usuario_id.
--    • En la API: cuando el frontend manda "guardar venta, vendedor: María Laura",
--      el backend busca en "usuario" por nombre, obtiene el id y guarda la venta
--      con ese usuario_id (y opcionalmente el texto vendedor para mostrar).
--
-- 2) MOVIMIENTOS DE STOCK
--    En la hoja tenés el código del producto (ej. "BOT-001"). En esta base,
--    cada movimiento tiene producto_id (UUID) que apunta a un registro en "producto".
--    • Al MIGRAR: por cada fila de movimiento, buscás en "producto" el que tiene
--      codigo = ese ID de producto y guardás su id en stockMovimiento.producto_id.
--    • En la API: cuando piden "agregar movimiento del producto BOT-001", el
--      backend busca en "producto" por codigo, obtiene el id y guarda el movimiento
--      con ese producto_id.
--
