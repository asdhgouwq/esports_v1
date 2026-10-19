const express = require('express');
const { localImportGuard } = require('./leaguepediaRoutes');
const { LeaguepediaError } = require('../services/leaguepedia');
function createWorldsRouter(sync, options) {
  const router = express.Router();
  router.use('/worlds', localImportGuard(options?.frontendOrigin));
  router.get('/worlds/status', (_req,res)=>res.json(sync.status()));
  router.get('/worlds', async (_req,res)=>{ try { res.json(await sync.event()); } catch(e) { res.status(e.status || 503).json({ error: e instanceof LeaguepediaError ? e.message : '월즈 데이터 조회에 실패했습니다.' }); } });
  router.post('/worlds/sync', (_req,res)=>res.status(202).json(sync.startSync()));
  return router;
}
module.exports = { createWorldsRouter };
