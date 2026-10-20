const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function localFrontendOrigins(frontendOrigin) {
  const frontend = new URL(frontendOrigin);
  if (frontend.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(frontend.hostname)) throw new Error('A local frontend URL is required');
  const origin = frontend.origin;
  frontend.hostname = frontend.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  return [origin, frontend.origin];
}
function localRequestGuard(frontendOrigin = 'http://127.0.0.1:5173') {
  const origins = new Set(localFrontendOrigins(frontendOrigin));
  return (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
    const origin = req.headers.origin;
    const localHost = [`127.0.0.1:${req.socket.localPort}`, `localhost:${req.socket.localPort}`].includes(req.headers.host);
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (!LOOPBACK.has(req.socket.remoteAddress) || !localHost || (origin && !origins.has(origin))
      || (write && (!origin || !req.is('application/json')))
      || (!origin && req.path.startsWith('/api') && req.headers['sec-fetch-site'] === 'cross-site')) {
      return res.status(403).json({ error: '이 기기의 dol.gg 화면에서 요청해 주세요.' });
    }
    next();
  };
}
function requestErrorHandler(error, _req, res, _next) {
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({ error: status === 413 ? '요청 크기가 너무 큽니다.' : status === 400 ? '올바른 JSON 요청이 필요합니다.' : '요청을 처리하지 못했습니다.' });
}
module.exports = { localRequestGuard, localFrontendOrigins, requestErrorHandler };
