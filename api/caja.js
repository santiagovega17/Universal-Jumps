const {
  getBalanceCaja,
  getHistorialCaja,
  getMediosPagoCaja,
  getConsolidadoCaja,
  getProximosVencimientosCaja,
  getMovimientoCajaById,
  updateEstadoMovimientoCaja,
  deleteMovimientoCaja,
  saveMovimientoCaja,
  normalizePais,
} = require('../lib/cajaService');

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return req.body;
}

module.exports = async (req, res) => {
  const action = (req.query.action || '').toString().trim();
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      const pais = normalizePais(req.query.pais || 'ARGENTINA');
      const mes = toNumber(req.query.mes, 0);
      const anio = toNumber(req.query.anio, 2026);

      if (action === 'balance') {
        const data = await getBalanceCaja({ pais, mes, anio });
        return res.status(200).json({ error: false, data });
      }

      if (action === 'historial') {
        const data = await getHistorialCaja({ pais, mes, anio });
        return res.status(200).json({ error: false, data });
      }

      if (action === 'medios') {
        const data = await getMediosPagoCaja({ pais, mes, anio });
        return res.status(200).json({ error: false, data });
      }

      if (action === 'consolidado') {
        const anioSolo = toNumber(req.query.anio, 2026);
        const data = await getConsolidadoCaja({ pais, anio: anioSolo });
        return res.status(200).json({ error: false, data });
      }

      if (action === 'datos-completo') {
        const [balance, historial, mediosPago] = await Promise.all([
          getBalanceCaja({ pais, mes, anio }),
          getHistorialCaja({ pais, mes, anio }),
          getMediosPagoCaja({ pais, mes, anio }),
        ]);
        return res.status(200).json({ error: false, data: { balance, historial, mediosPago } });
      }

      if (action === 'movimiento-item') {
        const id = req.query.id || req.query.filaIndex;
        if (!id) return res.status(400).json({ error: true, mensaje: 'id es requerido' });
        const data = await getMovimientoCajaById(id);
        return res.status(200).json({ error: false, data });
      }

      if (action === 'proximos-vencimientos') {
        const limite = toNumber(req.query.limite, 3);
        const data = await getProximosVencimientosCaja({ pais, limite });
        return res.status(200).json({ error: false, data });
      }

      return res.status(400).json({ error: true, mensaje: 'action no soportado en GET' });
    }

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      const body = getBody(req);

      if (action === 'movimiento') {
        const result = await saveMovimientoCaja(body);
        return res.status(200).json({ error: false, mensaje: result.mensaje });
      }

      if (action === 'movimiento-estado') {
        const id = body.id || body.filaIndex;
        const nuevoEstado = body.nuevoEstado || body.estado;
        if (!id || !nuevoEstado) {
          return res.status(400).json({ error: true, mensaje: 'id y nuevoEstado son requeridos' });
        }
        await updateEstadoMovimientoCaja(id, nuevoEstado);
        return res.status(200).json({ error: false });
      }

      if (action === 'movimiento-delete') {
        const id = body.id || body.filaIndex || req.query.id || req.query.filaIndex;
        if (!id) return res.status(400).json({ error: true, mensaje: 'id es requerido' });
        await deleteMovimientoCaja(id);
        return res.status(200).json({ error: false });
      }

      return res.status(400).json({ error: true, mensaje: 'action no soportado en escritura' });
    }

    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  } catch (e) {
    const status = method === 'GET' ? 500 : 400;
    return res.status(status).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
