const {
  getBalanceCaja,
  getHistorialCaja,
  getMediosPagoCaja,
  normalizePais,
} = require('../../lib/cajaService');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, mensaje: 'Metodo no permitido' });
  }

  try {
    const pais = normalizePais(req.query.pais || 'ARGENTINA');
    const mes = Number(req.query.mes || 0);
    const anio = Number(req.query.anio || 2026);
    const safeMes = Number.isFinite(mes) ? mes : 0;
    const safeAnio = Number.isFinite(anio) ? anio : 2026;

    const [balance, historial, mediosPago] = await Promise.all([
      getBalanceCaja({ pais, mes: safeMes, anio: safeAnio }),
      getHistorialCaja({ pais, mes: safeMes, anio: safeAnio }),
      getMediosPagoCaja({ pais, mes: safeMes, anio: safeAnio }),
    ]);

    return res.status(200).json({
      error: false,
      data: {
        balance,
        historial,
        mediosPago,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: true, mensaje: e.message || 'Error inesperado' });
  }
};
