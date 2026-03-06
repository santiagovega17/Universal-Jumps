/**
 * Login y seguridad: perfil de usuario.
 */
function obtenerPerfilUsuario() {
  var emailUsuario = Session.getActiveUser().getEmail();
  if (!emailUsuario) emailUsuario = Session.getEffectiveUser().getEmail();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaUsuarios = ss.getSheetByName('USUARIOS');

  if (!hojaUsuarios) return { error: true, mensaje: "CRÍTICO: No existe la hoja 'USUARIOS'." };

  const datos = hojaUsuarios.getDataRange().getValues();
  let perfil = null;

  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0].toString().trim().toLowerCase() === emailUsuario.toString().trim().toLowerCase()) {
      perfil = { email: datos[i][0], rol: datos[i][1], hoja: datos[i][2] || '', acceso: true, activo: (datos[i][3] || 'SI').toString().toUpperCase(), tipoObjetivo: (datos[i][4] || '').toString().toUpperCase() };
      break;
    }
  }

  if (!perfil) return { error: true, authError: true, emailDetectado: emailUsuario, mensaje: "Acceso denegado." };
  return perfil;
}
