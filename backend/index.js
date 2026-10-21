require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./src/api/routes');
const { createAiSummaryService, DEFAULT_MODEL } = require('./src/services/aiSummary');
const { localRequestGuard, localFrontendOrigins, requestErrorHandler } = require('./src/middleware/localRequest');
const { createAiSummaryRouter } = require('./src/api/aiSummaryRoutes');
const supabase = require('./src/config/supabase');
const { createChatGptAuth } = require('./src/services/chatgptAuth');
const { createChatGptRouter } = require('./src/api/chatgptRoutes');
const { createMatchDraftService, hasDraftMetadata } = require('./src/services/matchDraft');
const { createMatchDraftRouter } = require('./src/api/matchDraftRoutes');
const leaguepedia = require('./src/services/leaguepedia');
const { createLeaguepediaRouter } = require('./src/api/leaguepediaRoutes');
const dataSync = require('./src/services/dataSync');
const { createMatchTimelineService } = require('./src/services/matchTimeline');
const { createMatchTimelineRouter } = require('./src/api/matchTimelineRoutes');
const timeline = createMatchTimelineService();
const {createPlayerLoadoutService}=require('./src/services/playerLoadouts');
const {createPlayerLoadoutRouter}=require('./src/api/playerLoadoutRoutes');
const loadouts=createPlayerLoadoutService({db:supabase,source:leaguepedia,getTimeline:gameId=>timeline.getTimeline(gameId)});

const { createWorldsSync } = require('./src/services/worldsSync');
const { createWorldsRouter } = require('./src/api/worldsRoutes');
const { createWorldsTimelineSync } = require('./src/services/worldsTimelineSync');
const { createLolesportsCatalog } = require('./src/services/lolesportsCatalog');
const { createMatchObjectivesService } = require('./src/services/matchObjectives');
const year = Number(process.env.WORLDS_YEAR) || 2026;
const intervalMs = Math.max(15, Number(process.env.WORLDS_SYNC_INTERVAL_MINUTES) || 15) * 60000;
const objectives = createMatchObjectivesService({db:supabase,year,intervalMs});
const timelineSync = createWorldsTimelineSync({ db: supabase, catalog: createLolesportsCatalog(), year, intervalMs });
const worlds = createWorldsSync({ db: supabase, source: leaguepedia, year, intervalMs,
  onSynced: () => { if (objectives.status().enabled) objectives.startSync(); if (timelineSync.status().enabled) timelineSync.startSync(); }, getTimelineStatus: () => timelineSync.status() });

const app = express();
const port = process.env.PORT || 3000;
const frontendOrigin = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const auth = createChatGptAuth({ fixedModel: DEFAULT_MODEL, callbackUrl: `http://127.0.0.1:${port}/auth/callback` });

app.disable('x-powered-by');
app.use(localRequestGuard(frontendOrigin));
app.use(cors({ origin: localFrontendOrigins(frontendOrigin), credentials: true }));
app.use(express.json({ limit: '16kb' }));

app.use('/api', routes);
app.use('/api', createMatchTimelineRouter({ async getTimeline(gameId) {
  const [result,objectiveTotals] = await Promise.all([timeline.getTimeline(gameId),objectives.getObjectives(gameId).catch(() => null)]);
  return {...(result.state === 'not_recorded' ? timelineSync.gameStatus(gameId) : result),objectiveTotals};
} }));
app.use('/api', createPlayerLoadoutRouter(loadouts));
app.use('/api', createWorldsRouter(worlds, { frontendOrigin, timelineSync, objectives }));
app.use('/api', createLeaguepediaRouter(leaguepedia, dataSync, { frontendOrigin }));
app.use('/api', createMatchDraftRouter(createMatchDraftService({ db: supabase, loadDraft: async (gameId) => { const saved = await supabase.from('game_drafts').select('raw_draft').eq('game_id', gameId).maybeSingle(); return hasDraftMetadata(saved.data?.raw_draft) ? [saved.data.raw_draft] : leaguepedia.getDraft(gameId); } })));
app.use(createChatGptRouter(auth, { frontendOrigin }));
app.use('/api', createAiSummaryRouter(createAiSummaryService({ db: supabase, getTimeline: gameId => timeline.getTimeline(gameId),
  getInferenceContext: process.env.AI_AUTH_MODE === 'api_key' ? undefined : () => auth.summaryContext(),
}), { frontendOrigin }));

app.use(requestErrorHandler);

app.listen(port, '127.0.0.1', () => {
  console.log(`[Express] Server running on port ${port}`);
  worlds.start().catch(() => console.error('[Worlds] Automatic sync initialization failed'));
  timelineSync.start().catch(() => console.error('[Worlds timeline] Automatic sync initialization failed'));
  objectives.start().catch(() => console.error('[Worlds objectives] Automatic sync initialization failed'));
});
