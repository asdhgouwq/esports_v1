const express = require('express');
const { MatchDraftError } = require('../services/matchDraft');

function createMatchDraftRouter(service) {
  const router = express.Router();
  router.get('/matches/:gameId/draft', async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await service.getDraft(req.params.gameId)); }
    catch (error) {
      const known = error instanceof MatchDraftError;
      res.status(known ? error.status : 500).json({ code: known ? error.code : 'DRAFT_UNAVAILABLE', error: known ? error.message : '밴픽 순서를 불러오지 못했습니다.' });
    }
  });
  return router;
}

module.exports = { createMatchDraftRouter };
