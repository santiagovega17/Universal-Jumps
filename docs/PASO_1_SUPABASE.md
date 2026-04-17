# Paso 1: Proyecto y base de datos en Supabase

Ya tenés cuenta en Supabase, Vercel y Git. Este paso es solo **Supabase**: crear el proyecto y las tablas.

---

## 1. Crear el proyecto en Supabase

1. Entrá a [https://supabase.com/dashboard](https://supabase.com/dashboard) e iniciá sesión.
2. Clic en **New project**.
3. Completá:
   - **Name:** por ejemplo `universal-jumps`.
   - **Database Password:** anotá una contraseña segura (la vas a necesitar para conectar desde el backend). Guardala en un lugar seguro.
   - **Region:** elegí la más cercana a vos o a tus usuarios (ej. South America (São Paulo)).
4. Clic en **Create new project** y esperá unos minutos a que termine de crearse.

---

## 2. Anotar URL y API keys

Cuando el proyecto esté listo:

1. En el menú izquierdo: **Project Settings** (ícono de engranaje).
2. Entrá a **API**.
3. Anotá (las vas a usar en Vercel y en el frontend):
   - **Project URL** — algo como `https://xxxxx.supabase.co`
   - **anon public** — clave pública (segura para el frontend).
   - **service_role** — clave privada (solo para el backend; **nunca** en el frontend).

Podés guardarlas en un archivo local tipo `.env.example` (sin subir el archivo con valores reales a Git). Ejemplo:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 3. Crear las tablas en la base de datos

Las tablas replican la estructura de tus hojas de Google Sheets para que después podamos migrar los datos y conectar la API.

1. En el menú izquierdo de Supabase, entrá a **SQL Editor**.
2. Clic en **New query**.
3. Abrí el archivo **`supabase/schema.sql`** de este repo (está en la carpeta `supabase`).
4. Copiá **todo** el contenido de ese archivo.
5. Pegalo en el editor SQL de Supabase.
6. Clic en **Run** (o Ctrl+Enter).

Si todo va bien, verás el mensaje de que las tablas se crearon. En **Table Editor** deberías ver todas las tablas nuevas.

---

## 4. Verificar que las tablas existen

1. En el menú: **Table Editor**.
2. Comprobá que aparecen estas tablas (nombres en camelCase):
   - `usuario`
   - `cajaMovimiento`
   - `configCaja`
   - `configCotizacion`
   - `configObjetivo`
   - `cliente`
   - `venta`
   - `producto`
   - `stockMovimiento`
   - `configMarcaModelo`

Todas pueden estar vacías por ahora; en un paso posterior migraremos los datos desde las hojas.

---

## 5. (Opcional) Activar Google para login

Para que más adelante el login con Google funcione:

1. En Supabase: **Authentication** → **Providers**.
2. Buscá **Google** y activalo.
3. En [Google Cloud Console](https://console.cloud.google.com/) creá credenciales OAuth 2.0 (tipo “Web application”) y configurá la pantalla de consentimiento si te lo pide.
4. En Supabase, pegá el **Client ID** y **Client Secret** de Google y guardá.

Podés dejar esto para cuando armemos el frontend con login; no es obligatorio para terminar el Paso 1.

---

## Resumen

- [ ] Proyecto creado en Supabase.
- [ ] Anotadas **Project URL**, **anon key** y **service_role key**.
- [ ] Ejecutado el SQL de **`supabase/schema.sql`** en el SQL Editor.
- [ ] Verificadas las tablas en Table Editor.

Cuando tengas esto listo, seguimos con el Paso 2: conectar el repo a Vercel y crear la API que use estas tablas.
