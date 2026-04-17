# Paso 4: Configurar Auth con Google en Supabase

Para que el login con Google funcione, debés configurar Supabase y Google Cloud.

## 1. Supabase - Authentication

### URL Configuration
En **Supabase Dashboard** → **Authentication** → **URL Configuration**:

- **Site URL**: `https://universal-jumps.vercel.app` (o tu dominio de producción)
- **Redirect URLs** (agregar ambos):
  - `http://localhost:3000`
  - `http://localhost:3000/**`
  - `https://universal-jumps.vercel.app`
  - `https://universal-jumps.vercel.app/**`

### Providers - Google
En **Authentication** → **Providers** → **Google**:

1. Activar el provider Google
2. Copiar el **Callback URL** que muestra Supabase (ej: `https://nrzzhzdyorbrdnndcnjg.supabase.co/auth/v1/callback`)

## 2. Google Cloud Console

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un proyecto o seleccionar uno existente
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
4. Tipo: **Web application**
5. **Authorized redirect URIs**: pegar el Callback URL de Supabase
6. Copiar **Client ID** y **Client Secret**

## 3. Volver a Supabase

En **Providers** → **Google**, pegar:

- **Client ID** (de Google)
- **Client Secret** (de Google)

Guardar.

## 4. Usuarios autorizados

Solo pueden ingresar los usuarios que existan en la tabla `usuario` de Supabase con el mismo **email** que su cuenta de Google, y con `activo = 'SI'`.

Si el email de Google no está en `usuario`, verás: *"Tu usuario no tiene permisos."*

## 5. Fallback demo

Si la configuración de Auth falla o faltan variables de entorno, la app usará el perfil demo (admin) para que puedas seguir trabajando.
