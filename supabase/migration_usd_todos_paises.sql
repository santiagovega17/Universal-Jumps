-- Habilita USD como moneda adicional en todos los paises.
-- Ejecutar una sola vez en Supabase SQL Editor.

INSERT INTO public."paisMoneda" (pais, moneda_codigo, es_default, activa, orden)
VALUES
  ('ARGENTINA', 'USD', false, true, 2),
  ('CHILE', 'USD', false, true, 2),
  ('MEXICO', 'USD', false, true, 2),
  ('ESPANA', 'USD', false, true, 2),
  ('BRASIL', 'USD', false, true, 2),
  ('URUGUAY', 'USD', false, true, 2),
  ('EEUU', 'USD', true, true, 1),
  ('RDM', 'USD', true, true, 1)
ON CONFLICT (pais, moneda_codigo) DO NOTHING;
