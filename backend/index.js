require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ddragonService = require('./src/services/ddragon');
const routes = require('./src/api/routes');
const { createAiSummaryService } = require('./src/services/aiSummary');
const { createAiSummaryRouter } = require('./src/api/aiSummaryRoutes');
const supabase = require('./src/config/supabase');
const { createChatGptAuth } = require('./src/services/chatgptAuth');
const { createChatGptRouter } = require('./src/api/chatgptRoutes');
const { createMatchDraftService } = require('./src/services/matchDraft');
const { createMatchDraftRouter } = require('./src/api/matchDraftRoutes');
const leaguepedia = require('./src/services/leaguepedia');
const { createLeaguepediaRouter } = require('./src/api/leaguepediaRoutes');
const dataSync = require('./src/services/dataSync');
const { createMatchTimelineService } = require('./src/services/matchTimeline');
const { createMatchTimelineRouter } = require('./src/api/matchTimelineRoutes');
const timeline = createMatchTimelineService();

const { createWorldsSync } = require('./src/services/worldsSync');
const { createWorldsRouter } = require('./src/api/worldsRoutes');
const worlds = createWorldsSync({ db: supabase, source: leaguepedia, year: Number(process.env.WORLDS_YEAR) || 2026, intervalMs: Math.max(15, Number(process.env.WORLDS_SYNC_INTERVAL_MINUTES) || 15) * 60000 });

const app = express();
const port = process.env.PORT || 3000;
const frontendOrigin = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const auth = createChatGptAuth({ fixedModel: 'gpt-6-luna', callbackUrl: `http://127.0.0.1:${port}/auth/callback` });

app.use(cors({ origin: [frontendOrigin, 'http://localhost:5173'], credentials: true }));
app.use(express.json());

ddragonService.init().then(() => {
  console.log('[Express] DataDragon initialization finished.');
});

app.use('/api', routes);
app.use('/api', createMatchTimelineRouter(timeline));
app.use('/api', createWorldsRouter(worlds, { frontendOrigin }));
app.use('/api', createLeaguepediaRouter(leaguepedia, dataSync, { frontendOrigin }));
app.use('/api', createMatchDraftRouter(createMatchDraftService({ db: supabase, loadDraft: async (gameId) => { const saved = await supabase.from('game_drafts').select('raw_draft').eq('game_id', gameId).maybeSingle(); return saved.data ? [saved.data.raw_draft] : leaguepedia.getDraft(gameId); } })));
app.use(createChatGptRouter(auth, { frontendOrigin }));
app.use('/api', createAiSummaryRouter(createAiSummaryService({ db: supabase, getTimeline: gameId => timeline.getTimeline(gameId),
  getInferenceContext: process.env.AI_AUTH_MODE === 'api_key' ? undefined : () => auth.summaryContext(),
})));

app.listen(port, '127.0.0.1', () => {
  console.log(`[Express] Server running on port ${port}`);
  worlds.start().catch(() => console.error('[Worlds] Automatic sync initialization failed'));
});
