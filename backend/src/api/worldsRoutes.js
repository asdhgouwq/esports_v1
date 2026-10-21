const express = require('express');
const { localImportGuard } = require('./leaguepediaRoutes');
const { LeaguepediaError } = require('../services/leaguepedia');
function createWorldsRouter(sync, options) {
  const router = express.Router();
  router.use('/worlds', localImportGuard(options?.frontendOrigin));
  router.get('/worlds/status', (_req,res)=>res.json(sync.status()));
  router.get('/worlds', async (_req,res)=>{ try { res.json(await sync.event()); } catch(e) { res.status(e.status || 503).json({ error: e instanceof LeaguepediaError ? e.message : '월즈 데이터 조회에 실패했습니다.' }); } });
  router.post('/worlds/sync', (_req,res)=>res.status(202).json(sync.startSync()));
  if (options?.timelineSync) {
    router.get('/worlds/timelines/status', (_req,res)=>res.json(options.timelineSync.status()));
    router.post('/worlds/timelines/sync', (_req,res)=>res.status(202).json(options.timelineSync.startSync()));
  }
  if (options?.objectives) {
    router.get('/worlds/objectives/status', (_req,res)=>res.json(options.objectives.status()));
    router.post('/worlds/objectives/sync', (_req,res)=>res.status(202).json(options.objectives.startSync()));
  }
  return router;
}
module.exports = { createWorldsRouter };
