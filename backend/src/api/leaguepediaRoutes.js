const express = require('express');
const { LeaguepediaError } = require('../services/leaguepedia');

function localImportGuard(frontendOrigin = process.env.FRONTEND_URL || 'http://127.0.0.1:5173') {
  const expected = new URL(frontendOrigin);
  if (expected.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(expected.hostname)) throw new Error('Leaguepedia connection is local-only');
  const origins = new Set([expected.origin, `http://${expected.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1'}:${expected.port}`]);
  return (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const host = [`127.0.0.1:${req.socket.localPort}`, `localhost:${req.socket.localPort}`].includes(req.headers.host);
    const origin = req.headers.origin;
    if (!local || !host || (origin && !origins.has(origin)) || (req.method === 'POST' && (!origin || !req.is('application/json')))) return res.status(403).json({ error: '이 기기의 dol.gg 화면에서 데이터 연결을 진행해 주세요.' });
    next();
  };
}
function createLeaguepediaRouter(source, sync, options) {
  const router = express.Router();
  router.use('/leaguepedia', localImportGuard(options?.frontendOrigin));
  const handle = (action) => async (req, res) => {
    try { await action(req, res); }
    catch (error) {
      const known = error instanceof LeaguepediaError;
      if (error.retryAt) res.set('Retry-After', String(Math.max(1, Math.ceil((error.retryAt - Date.now()) / 1000))));
      res.status(known ? error.status : 500).json({ code: known ? error.code : 'CONNECTION_FAILED', error: known ? error.message : '데이터 연결을 확인하지 못했습니다.', retryAt: error.retryAt ? new Date(error.retryAt).toISOString() : null });
    }
  };
  router.get('/leaguepedia/status', handle(async (_req, res) => res.json({ ...(await source.status()), job: sync.getJob() })));
  router.post('/leaguepedia/connect', handle(async (req, res) => res.json(await source.connect(req.body))));
  router.post('/leaguepedia/import', handle(async (req, res) => {
    if (!(await source.status()).configured) throw new LeaguepediaError('LEAGUEPEDIA_AUTH_REQUIRED', '먼저 Fandom Bot Password를 연결해 주세요.', 401);
    const tournament = req.body?.tournament || 'LCK%';
    if (typeof tournament !== 'string' || tournament.length > 160 || !tournament.trim()) throw new LeaguepediaError('INVALID_IMPORT', '대회 이름을 입력해 주세요.', 400);
    res.status(202).json({ job: sync.startImport(tournament) });
  }));
  return router;
}
module.exports = { createLeaguepediaRouter, localImportGuard };
