/**
 * Gestión de usuarios y vendedores.
 */
function obtenerListaVendedores() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'lista_vendedores';
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaUsuarios = ss.getSheetByName('USUARIOS');
  if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

  const datos = hojaUsuarios.getDataRange().getValues();
  let vendedores = [];
  let vendedoresInactivos = [];

  for (let i = 1; i < datos.length; i++) {
    let rol = (datos[i][1] || '').toString().toUpperCase();
    if (rol === 'VENDEDOR') {
      let nombreHoja = datos[i][2] || '';
      let activo = (datos[i][3] || 'SI').toString().toUpperCase();
      let tipoObjetivo = (datos[i][4] || '').toString().toUpperCase();

      let vendedor = {
        nombre: nombreHoja,
        email: datos[i][0] || '',
        rol: rol,
        activo: activo === 'SI',
        tipoObjetivo: tipoObjetivo
      };

      if (activo === 'SI') vendedores.push(vendedor);
      else vendedoresInactivos.push(vendedor);
    }
  }

  const resultado = { error: false, activos: vendedores, inactivos: vendedoresInactivos };
  try { cache.put(cacheKey, JSON.stringify(resultado), 600); } catch (e) {}
  return resultado;
}

function obtenerTodosUsuarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaUsuarios = ss.getSheetByName('USUARIOS');
  if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

  const datos = hojaUsuarios.getDataRange().getValues();
  let usuarios = [];

  for (let i = 1; i < datos.length; i++) {
    usuarios.push({
      email: datos[i][0] || '',
      rol: (datos[i][1] || '').toString().toUpperCase(),
      nombre: datos[i][2] || datos[i][0],
      activo: (datos[i][3] || 'SI').toString().toUpperCase() === 'SI',
      tipoObjetivo: (datos[i][4] || '').toString().toUpperCase()
    });
  }

  return { error: false, usuarios: usuarios };
}

function crearNuevoUsuario(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaUsuarios = ss.getSheetByName('USUARIOS');
  if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

  const datosUsuarios = hojaUsuarios.getDataRange().getValues();
  const emailNuevo = datos.email.toString().trim().toLowerCase();

  for (let i = 1; i < datosUsuarios.length; i++) {
    if ((datosUsuarios[i][0] || '').toString().trim().toLowerCase() === emailNuevo) {
      return { error: true, mensaje: "Ya existe un usuario con este email." };
    }
  }

  const rol = (datos.rol || 'VENDEDOR').toString().toUpperCase();
  const nombreUsuario = datos.nombre.trim();

  if (rol === 'VENDEDOR') {
    if (ss.getSheetByName(nombreUsuario)) {
      return { error: true, mensaje: "Ya existe una hoja con este nombre." };
    }

    const nuevaHoja = ss.insertSheet(nombreUsuario);
    nuevaHoja.getRange(1, 1, 1, 13).setValues([[
      'FECHA', 'ESTADO', 'CHEQUEADO', 'PAIS', 'CLIENTE', 'CONCEPTO', 'FORMA DE PAGO',
      'CANTIDAD', 'PRECIO', 'TOTAL', 'TOTAL (SIN IVA)', 'OBSERVACIONES', 'COTIZACION'
    ]]);
    nuevaHoja.getRange(1, 1, 1, 13).setFontWeight('bold');
  }

  hojaUsuarios.appendRow([
    datos.email,
    rol,
    nombreUsuario,
    'SI',
    rol === 'VENDEDOR' ? (datos.tipoObjetivo || 'RANGO') : ''
  ]);

  CacheService.getScriptCache().remove('lista_vendedores');
  return { error: false, mensaje: "Usuario creado correctamente." };
}

function actualizarUsuario(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaUsuarios = ss.getSheetByName('USUARIOS');
  if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

  const datosUsuarios = hojaUsuarios.getDataRange().getValues();
  const nombreOriginal = datos.nombreOriginal ? datos.nombreOriginal.toString().trim() : "";

  for (let i = 1; i < datosUsuarios.length; i++) {
    if ((datosUsuarios[i][2] || '').toString().trim() === nombreOriginal) {
      if (datos.email !== datosUsuarios[i][0]) {
        for (let j = 1; j < datosUsuarios.length; j++) {
          if (j !== i && (datosUsuarios[j][0] || '').toString().trim().toLowerCase() === datos.email.toString().trim().toLowerCase()) {
            return { error: true, mensaje: "Ya existe otro usuario con este email." };
          }
        }
      }

      hojaUsuarios.getRange(i + 1, 1).setValue(datos.email);
      if (datos.rol) hojaUsuarios.getRange(i + 1, 2).setValue(datos.rol.toUpperCase());
      if (datos.tipoObjetivo) hojaUsuarios.getRange(i + 1, 5).setValue(datos.tipoObjetivo);

      CacheService.getScriptCache().remove('lista_vendedores');
      return { error: false, mensaje: "Usuario actualizado correctamente." };
    }
  }

  return { error: true, mensaje: "Usuario no encontrado." };
}

function actualizarEstadoUsuario(email, activo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaUsuarios = ss.getSheetByName('USUARIOS');
  if (!hojaUsuarios) return { error: true, mensaje: "No existe la hoja 'USUARIOS'." };

  const datos = hojaUsuarios.getDataRange().getValues();
  const emailBusqueda = email.toString().trim().toLowerCase();

  for (let i = 1; i < datos.length; i++) {
    if ((datos[i][0] || '').toString().trim().toLowerCase() === emailBusqueda) {
      hojaUsuarios.getRange(i + 1, 4).setValue(activo ? 'SI' : 'NO');
      CacheService.getScriptCache().remove('lista_vendedores');
      return { error: false, mensaje: "Estado actualizado correctamente." };
    }
  }
  return { error: true, mensaje: "Usuario no encontrado." };
}

function cambiarRolUsuario(email, nuevoRol) {
  return actualizarUsuario({ email: email, nombreOriginal: email, rol: nuevoRol });
}
