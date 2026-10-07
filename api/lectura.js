const { randomUUID, createHash } = require('node:crypto');
const ORIGEN = 'https://script.google.com/macros/s/AKfycbw8X1UsQXLOpdmC2k5SaHjQGRRwzL8I-OViSVJ9IDuGjtqoOf_3t-b_6wNnDJkMt3d1/exec';
const TAMANO = 1024 * 1024;

// Solo lecturas; Apps Script valida la sesion y el permiso de cada fotografia.
module.exports = async function lectura(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const error = (codigo, mensaje) => res.status(codigo).json({status:'error', message:mensaje});
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return error(405,'Utilice POST.'); }
  let data;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!raw || Buffer.byteLength(raw) > 200000) return error(413,'Consulta demasiado grande.');
    data = JSON.parse(raw);
  } catch (_) { return error(400,'Consulta no valida.'); }
  if (!data || !['semana','fotoInforme'].includes(data.accion)) return error(400,'Accion de lectura no valida.');
  if (typeof data.token !== 'string' || !data.token || data.token.length > 4096) return error(401,'Inicie sesion para continuar.');
  const foto = data.accion === 'fotoInforme';
  const offset = data.offset === undefined ? 0 : data.offset;
  if (foto && (!Number.isSafeInteger(offset) || offset < 0 || offset > 16 * TAMANO || offset % TAMANO)) return error(400,'Parte de fotografia no valida.');
  const consulta = foto
    ? {accion:data.accion, token:data.token, id:data.id, paseFotos:data.paseFotos}
    : {accion:data.accion, token:data.token, inicio:data.inicio};
  try {
    const upstream = await fetch(ORIGEN + '?solicitud=' + randomUUID(), {
      method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(consulta), cache:'no-store', signal:AbortSignal.timeout(50000)
    });
    if (!upstream.ok) return error(502,'Google no respondio correctamente (' + upstream.status + '). Reintente la consulta.');
    const resultado = await upstream.json();
    if (resultado.status !== 'success') return res.status(200).json(resultado);
    if (foto) {
      if (typeof resultado.base64 !== 'string' || resultado.base64.length > 16 * TAMANO || offset >= resultado.base64.length) return error(502,'Respuesta de fotografia no valida.');
      const total = resultado.base64.length;
      const huella = createHash('sha256').update(resultado.base64).digest('hex');
      return res.status(200).json({status:'success',id:resultado.id,tipo:resultado.tipo,
        base64:resultado.base64.slice(offset,offset+TAMANO),offset,total,huella,
        siguiente:offset+TAMANO < total ? offset+TAMANO : null});
    }
    if (Buffer.byteLength(JSON.stringify(resultado)) > 4000000) return error(413,'La semana supera el limite de consulta.');
    return res.status(200).json(resultado);
  } catch (_) { return error(502,'No fue posible recuperar la consulta desde Google. Reintente.'); }
};
