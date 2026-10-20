const express = require('express');
const { LeaguepediaError } = require('../services/leaguepedia');

const { localRequestGuard } = require('../middleware/localRequest');
const localImportGuard = (origin = process.env.FRONTEND_URL || 'http://127.0.0.1:5173') => localRequestGuard(origin);
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
