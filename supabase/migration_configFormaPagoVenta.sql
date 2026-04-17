-- Ejecutar una vez en Supabase SQL Editor si la tabla aún no existe.
-- Medios de pago configurables para el formulario de ventas.

CREATE TABLE IF NOT EXISTS public."configFormaPagoVenta" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_configFormaPagoVenta_nombre UNIQUE (nombre)
);

CREATE INDEX IF NOT EXISTS idx_configFormaPagoVenta_orden ON public."configFormaPagoVenta"(orden);

ALTER TABLE public."configFormaPagoVenta" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access configFormaPagoVenta"
  ON public."configFormaPagoVenta" FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Datos iniciales (solo si la tabla está vacía)
INSERT INTO public."configFormaPagoVenta" (nombre, orden)
SELECT v.nombre, v.orden
FROM (
  VALUES
    ('Mercado Pago', 0),
    ('Transferencia', 1),
    ('Efectivo', 2),
    ('Cta corriente', 3),
    ('Mercado Libre', 4),
    ('Amazon', 5),
    ('Prisma', 6),
    ('Paypal', 7),
    ('Banco Bci (CL)', 8),
    ('Dólar App (MX)', 9),
    ('Banco Sadabell (ESP)', 10),
    ('Banco Itaú (URU)', 11)
) AS v(nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM public."configFormaPagoVenta" LIMIT 1);

COMMENT ON TABLE public."configFormaPagoVenta" IS 'Medios de pago del formulario de ventas (configurables).';
