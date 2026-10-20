const express = require('express');
const { SummaryError } = require('../services/aiSummary');
const { ChatGptAuthError } = require('../services/chatgptAuth');

function createAiSummaryRouter(service, { frontendOrigin = 'http://127.0.0.1:5173' } = {}) {
  const router = express.Router();
  router.use('/matches/:gameId/ai-summary', require('../middleware/localRequest').localRequestGuard(frontendOrigin));
  const respond = (allowGenerate) => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const result = await service.getSummary(req.params.gameId, req.query.scope || 'series', { allowGenerate });
      res.json({ success: true, ...result });
    } catch (error) {
      const known = error instanceof SummaryError || error instanceof ChatGptAuthError;
      console.error('[AI summary]', known ? error.code : 'UNEXPECTED_ERROR');
      res.status(known ? error.status : 500).json({
        success: false, state: known && error.state ? error.state : 'error', code: known ? error.code : 'AI_ERROR',
        error: known ? error.message : 'AI 요약을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  };
  router.get('/matches/:gameId/ai-summary', respond(false));
  router.post('/matches/:gameId/ai-summary', respond(true));
  return router;
}

module.exports = { createAiSummaryRouter };
