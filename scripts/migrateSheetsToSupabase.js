/* eslint-disable no-console */
require('dotenv').config();

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const ANIO_ACTIVO = Number(process.env.MIGRATION_ANIO || 2026);
const CHUNK_SIZE = 500;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno: ${name}`);
  return value;
}

function normalizePais(value) {
  const src = (value || '').toString().trim().toUpperCase();
  const noAccents = src.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (noAccents === 'USA') return 'EEUU';
  if (noAccents === 'ESPANA') return 'ESPANA';
  return noAccents || 'ARGENTINA';
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const n = Number(value.toString().replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number') {
    // Google serial date -> JS date
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const dt = new Date(ms);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const text = value.toString().trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const dt = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const parts = text.split('/');
  if (parts.length === 3) {
    const dd = Number(parts[0]);
    const mm = Number(parts[1]);
    const yyyy = Number(parts[2]);
    if (dd && mm && yyyy) {
      const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }

  const dt = new Date(text);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toIsoDate(value) {
  const dt = parseDate(value);
  if (!dt) return null;
  return dt.toISOString().slice(0, 10);
}

function getYearFromDate(value) {
  const dt = parseDate(value);
  return dt ? dt.getUTCFullYear() : null;
}

function safeText(value) {
  return (value || '').toString().trim();
}

function getIvaDivisorByPais(pais) {
  const p = (pais || '').toString().toUpperCase();
  if (p === 'URUGUAY') return 1.22;
  if (p === 'CHILE' || p === 'BRASIL') return 1.19;
  if (p === 'MEXICO') return 1.16;
  if (p === 'EEUU') return 1.07;
  if (p === 'RDM') return 1.0;
  return 1.21;
}

async function insertInChunks(supabase, table, rows) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`[${table}] ${error.message}`);
  }
}

async function upsertInChunks(supabase, table, rows, onConflict) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`[${table}] ${error.message}`);
  }
}

async function deleteAllTableData(supabase) {
  const order = [
    'stockMovimiento',
    'venta',
    'cajaMovimiento',
    'producto',
    'cliente',
    'configObjetivo',
    'configMarcaModelo',
    'configCaja',
    'configCotizacion',
    'usuario',
  ];

  for (const table of order) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`[reset:${table}] ${error.message}`);
  }
}

async function buildSheetsClient() {
  const email = getRequiredEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getRequiredEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

async function getSheetTitles(sheetsApi, spreadsheetId) {
  const res = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return (res.data.sheets || []).map((s) => s.properties.title);
}

async function getValues(sheetsApi, spreadsheetId, sheetName) {
  const escaped = sheetName.replace(/'/g, "''");
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${escaped}'`,
  });
  return res.data.values || [];
}

function mapUsuarios(rows) {
  return rows
    .slice(1)
    .filter((r) => safeText(r[0]))
    .map((r) => ({
      email: safeText(r[0]).toLowerCase(),
      rol: safeText(r[1]).toUpperCase() || 'VENDEDOR',
      nombre: safeText(r[2]) || safeText(r[0]),
      activo: safeText(r[3]).toUpperCase() || 'SI',
      tipo_objetivo: safeText(r[4]).toUpperCase() || '',
    }));
}

function mapConfigCaja(rows) {
  return rows
    .slice(1)
    .filter((r) => safeText(r[0]) && safeText(r[1]))
    .map((r) => ({
      tipo: safeText(r[0]),
      nombre: safeText(r[1]),
      padre: safeText(r[2]),
      pais: normalizePais(r[3] || 'ARGENTINA'),
      sentido: safeText(r[4]) || 'EGRESO',
    }));
}

function mapConfigCotizaciones(rows) {
  return rows
    .slice(1)
    .filter((r) => safeText(r[0]))
    .map((r) => ({
      pais: normalizePais(r[0]),
      factor: toNumber(r[2], toNumber(r[1], 1)),
    }))
    .filter((r) => r.factor > 0);
}

function mapConfigObjetivos(rows) {
  return rows
    .slice(1)
    .filter((r) => safeText(r[0]) && safeText(r[2]))
    .map((r) => ({
      trimestre: safeText(r[0]),
      trimestre_numero: toNumber(r[1], null),
      identificador: safeText(r[2]),
      porcentaje_botas: toNumber(r[3], 0),
      porcentaje_certs: toNumber(r[4], 0),
      unidades_botas: toNumber(r[5], 0),
      unidades_certs: toNumber(r[6], 0),
      facturacion_botas: toNumber(r[7], 0),
      facturacion_certs: toNumber(r[8], 0),
    }));
}

function mapClientes(rows) {
  return rows
    .slice(1)
    .filter((r) => safeText(r[1]) || safeText(r[2]) || safeText(r[3]))
    .map((r) => ({
      nombre: safeText(r[1]),
      apellido: safeText(r[2]),
      dni: safeText(r[3]),
      telefono: safeText(r[4]),
      correo: safeText(r[5]),
      domicilio: safeText(r[6]),
      provincia: safeText(r[7]),
      pais: normalizePais(r[8]),
    }));
}

function mapConfigMarcaModelo(rows) {
  return rows
    .slice(1)
    .map((r) => {
      const marca = safeText(r[0]);
      if (!marca) return null;
      if (r.length >= 3) {
        return {
          marca,
          tipo: safeText(r[1]) || 'General',
          modelo: safeText(r[2]),
        };
      }
      return {
        marca,
        tipo: 'General',
        modelo: safeText(r[1]),
      };
    })
    .filter((r) => r && r.modelo);
}

function mapProductos(rows) {
  return rows
    .slice(1)
    .map((r) => {
      const codigo = safeText(r[0]);
      if (!codigo) return null;

      if (r.length >= 10) {
        return {
          codigo,
          marca: safeText(r[1]),
          tipo: safeText(r[2]),
          modelo: safeText(r[3]),
          color: safeText(r[4]),
          descripcion: safeText(r[5]),
          imagen_url: safeText(r[6]),
          activo: safeText(r[7]).toUpperCase() || 'SI',
          divide_talles: safeText(r[8]).toUpperCase() || 'SI',
          pais: normalizePais(r[9]),
        };
      }

      // Compatibilidad estructura vieja
      return {
        codigo,
        marca: safeText(r[1]),
        tipo: '',
        modelo: safeText(r[2] || r[1]),
        color: safeText(r[3] || ''),
        descripcion: safeText(r[4] || ''),
        imagen_url: safeText(r[5] || ''),
        activo: safeText(r[6]).toUpperCase() || 'SI',
        divide_talles: 'SI',
        pais: normalizePais(r[7] || 'ARGENTINA'),
      };
    })
    .filter(Boolean);
}

function mapCajaMovimientos(rows) {
  return rows
    .slice(1)
    .map((r) => {
      const fecha = toIsoDate(r[0]);
      if (!fecha) return null;
      return {
        fecha,
        tipo: safeText(r[1]).toUpperCase(),
        concepto: safeText(r[2]),
        descripcion: safeText(r[3]),
        forma_pago: safeText(r[4]),
        monto: toNumber(r[5], 0),
        observaciones: safeText(r[6]),
        estado: safeText(r[7]).toUpperCase() || 'PAGADO',
        vencimiento: toIsoDate(r[8]),
        pais: normalizePais(r[9]),
        cotizacion_usada: safeText(r[10]),
        anio: getYearFromDate(r[0]) || ANIO_ACTIVO,
      };
    })
    .filter(Boolean);
}

function mapVentasFromSheetRows(vendedor, rows, usuarioIdByNombre) {
  const usuarioId = usuarioIdByNombre[normalizeUpper(vendedor)] || null;
  if (!usuarioId) return [];

  return rows
    .slice(1)
    .map((r) => {
      const fecha = toIsoDate(r[0]);
      if (!fecha) return null;

      const pais = normalizePais(r[3]);
      const cantidad = toNumber(r[7], 0);
      const precio = toNumber(r[8], 0);
      const total = toNumber(r[9], cantidad * precio);
      const totalSinIva = toNumber(r[10], total / getIvaDivisorByPais(pais));

      return {
        usuario_id: usuarioId,
        vendedor: vendedor,
        fecha,
        estado: safeText(r[1]) || 'Pendiente',
        chequeado: safeText(r[2]).toUpperCase() || 'NO',
        pais,
        cliente: safeText(r[4]),
        concepto: safeText(r[5]),
        forma_pago: safeText(r[6]),
        cantidad,
        precio,
        total,
        total_sin_iva: totalSinIva,
        observaciones: safeText(r[11]),
        cotizacion: toNumber(r[12], 1),
        anio: getYearFromDate(r[0]) || ANIO_ACTIVO,
      };
    })
    .filter(Boolean);
}

function mapStockMovimientos(rows, productoIdByCodigo) {
  const result = [];
  let skippedNoProducto = 0;

  rows.slice(1).forEach((r) => {
    const fecha = toIsoDate(r[0]);
    if (!fecha) return;
    const codigo = safeText(r[1]);
    const productoId = productoIdByCodigo[codigo];
    if (!productoId) {
      skippedNoProducto += 1;
      return;
    }

    const paisCol7 = safeText(r[7]);
    const paisCol6 = safeText(r[6]);
    const pais = normalizePais(paisCol7 || paisCol6 || 'ARGENTINA');

    result.push({
      producto_id: productoId,
      fecha,
      talle: safeText(r[2]) || 'UNICO',
      tipo: safeText(r[3]).toUpperCase(),
      cantidad: toNumber(r[4], 0),
      observacion_usuario: safeText(r[5]),
      pais,
    });
  });

  return { rows: result, skippedNoProducto };
}

function normalizeUpper(value) {
  return safeText(value).toUpperCase();
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const run = args.has('--run');
  const dryRun = !run || args.has('--dry-run');
  const reset = args.has('--reset');
  const yes = args.has('--yes');

  if (run && !yes) {
    throw new Error('Para ejecutar migracion real agrega --yes (seguridad).');
  }

  if (run && !reset) {
    throw new Error('Para evitar duplicados, ejecutar con --reset en migracion real.');
  }

  const supabaseUrl = getRequiredEnv('SUPABASE_URL');
  const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const spreadsheetId = getRequiredEnv('GOOGLE_SHEET_ID');

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sheetsApi = await buildSheetsClient();
  const titles = await getSheetTitles(sheetsApi, spreadsheetId);

  console.log('--- Migracion Sheets -> Supabase ---');
  console.log('Spreadsheet:', spreadsheetId);
  console.log('Mode:', dryRun ? 'DRY-RUN' : 'RUN');
  console.log('Sheets detectadas:', titles.length);

  const sheetData = {};
  const knownSheets = [
    'USUARIOS',
    'CONFIG-CAJA',
    'CONFIG-COTIZACIONES',
    'CONFIG-OBJETIVOS',
    'CONFIG-MARCAS-MODELOS',
    'CLIENTES',
    'CAJA',
    'STOCK_DEFINICION',
    'STOCK_MOVIMIENTOS',
  ];

  for (const name of knownSheets) {
    if (titles.includes(name)) {
      sheetData[name] = await getValues(sheetsApi, spreadsheetId, name);
    } else {
      sheetData[name] = [];
      console.warn(`Aviso: no existe hoja ${name}`);
    }
  }

  const usuarios = mapUsuarios(sheetData['USUARIOS']);
  const configCaja = mapConfigCaja(sheetData['CONFIG-CAJA']);
  const configCotizaciones = mapConfigCotizaciones(sheetData['CONFIG-COTIZACIONES']);
  const configObjetivos = mapConfigObjetivos(sheetData['CONFIG-OBJETIVOS']);
  const configMarcaModelo = mapConfigMarcaModelo(sheetData['CONFIG-MARCAS-MODELOS']);
  const clientes = mapClientes(sheetData.CLIENTES);
  const cajaMovimientos = mapCajaMovimientos(sheetData.CAJA);
  const productos = mapProductos(sheetData.STOCK_DEFINICION);

  // hojas de vendedores = nombres en USUARIOS con rol VENDEDOR
  const vendedorSheetNames = usuarios
    .filter((u) => u.rol === 'VENDEDOR' && u.nombre)
    .map((u) => u.nombre);

  // En dry-run cargar solo conteos
  const ventasPorVendedor = {};
  for (const vendedor of vendedorSheetNames) {
    if (!titles.includes(vendedor)) {
      ventasPorVendedor[vendedor] = [];
      console.warn(`Aviso: hoja de vendedor no encontrada: ${vendedor}`);
      continue;
    }
    ventasPorVendedor[vendedor] = await getValues(sheetsApi, spreadsheetId, vendedor);
  }

  console.log('Conteos origen:');
  console.log(`- usuarios: ${usuarios.length}`);
  console.log(`- configCaja: ${configCaja.length}`);
  console.log(`- configCotizacion: ${configCotizaciones.length}`);
  console.log(`- configObjetivo: ${configObjetivos.length}`);
  console.log(`- configMarcaModelo: ${configMarcaModelo.length}`);
  console.log(`- clientes: ${clientes.length}`);
  console.log(`- cajaMovimiento: ${cajaMovimientos.length}`);
  console.log(`- productos: ${productos.length}`);
  console.log(`- hojas de ventas: ${Object.keys(ventasPorVendedor).length}`);

  if (dryRun) {
    console.log('Dry-run finalizado. No se insertaron datos.');
    console.log('Para correr migracion real: npm run migrate:run');
    return;
  }

  if (reset) {
    console.log('Limpiando tablas destino (--reset)...');
    await deleteAllTableData(supabase);
  }

  console.log('Migrando usuarios...');
  await upsertInChunks(supabase, 'usuario', usuarios, 'email');
  const { data: usuariosDb, error: usuariosErr } = await supabase.from('usuario').select('id, email, nombre, rol');
  if (usuariosErr) throw new Error(`[usuario/select] ${usuariosErr.message}`);

  const usuarioIdByNombre = {};
  (usuariosDb || []).forEach((u) => {
    if (u.nombre) usuarioIdByNombre[normalizeUpper(u.nombre)] = u.id;
  });

  // Crear placeholders para vendedores no presentes en usuario
  const missingVendedores = vendedorSheetNames.filter((n) => !usuarioIdByNombre[normalizeUpper(n)]);
  if (missingVendedores.length) {
    const placeholders = missingVendedores.map((nombre) => ({
      email: `${nombre.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') || 'vendedor'}.migrado@local.dev`,
      rol: 'VENDEDOR',
      nombre,
      activo: 'SI',
      tipo_objetivo: 'RANGO',
    }));
    await upsertInChunks(supabase, 'usuario', placeholders, 'email');
    const { data: usuariosDb2, error: usuariosErr2 } = await supabase.from('usuario').select('id, nombre');
    if (usuariosErr2) throw new Error(`[usuario/select2] ${usuariosErr2.message}`);
    (usuariosDb2 || []).forEach((u) => {
      if (u.nombre) usuarioIdByNombre[normalizeUpper(u.nombre)] = u.id;
    });
  }

  console.log('Migrando configuraciones...');
  await insertInChunks(supabase, 'configCaja', configCaja);
  await upsertInChunks(supabase, 'configCotizacion', configCotizaciones, 'pais');
  await insertInChunks(supabase, 'configObjetivo', configObjetivos);
  await upsertInChunks(supabase, 'configMarcaModelo', configMarcaModelo, 'marca,tipo,modelo');

  console.log('Migrando clientes...');
  await insertInChunks(supabase, 'cliente', clientes);

  console.log('Migrando productos...');
  await upsertInChunks(supabase, 'producto', productos, 'codigo');
  const { data: productosDb, error: prodErr } = await supabase.from('producto').select('id, codigo');
  if (prodErr) throw new Error(`[producto/select] ${prodErr.message}`);
  const productoIdByCodigo = {};
  (productosDb || []).forEach((p) => {
    productoIdByCodigo[safeText(p.codigo)] = p.id;
  });

  console.log('Migrando ventas...');
  const ventasRows = [];
  for (const vendedor of Object.keys(ventasPorVendedor)) {
    const rows = ventasPorVendedor[vendedor];
    ventasRows.push(...mapVentasFromSheetRows(vendedor, rows, usuarioIdByNombre));
  }
  await insertInChunks(supabase, 'venta', ventasRows);

  console.log('Migrando caja...');
  await insertInChunks(supabase, 'cajaMovimiento', cajaMovimientos);

  console.log('Migrando movimientos de stock...');
  const stockMap = mapStockMovimientos(sheetData.STOCK_MOVIMIENTOS, productoIdByCodigo);
  await insertInChunks(supabase, 'stockMovimiento', stockMap.rows);

  console.log('--- Migracion finalizada ---');
  console.log(`ventas insertadas: ${ventasRows.length}`);
  console.log(`stock movimientos insertados: ${stockMap.rows.length}`);
  console.log(`stock movimientos omitidos (sin producto): ${stockMap.skippedNoProducto}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
