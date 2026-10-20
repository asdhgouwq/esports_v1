const express = require('express');
const supabase = require('../config/supabase');
const dataSyncService = require('../services/dataSync');
const { localImportGuard } = require('./leaguepediaRoutes');
const { attachPlayerTeams } = require('../services/playerTeams');

function createApiRouter({ db = supabase, sync = dataSyncService } = {}) {
  const router = express.Router();
  router.param('gameId', (req, res, next, id) => {
    if (!id.trim() || id.length > 300 || /[\x00-\x1f]/.test(id)) return res.status(400).json({ error: '올바른 경기 ID가 필요합니다.' });
    next();
  });
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'dol.gg Backend API is running' });
  });

  router.get('/matches', async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Supabase not initialized.' });

      const { tournament, limit = '30', expand_series } = req.query;
      if (typeof limit !== 'string' || !/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 200
        || (tournament !== undefined && (typeof tournament !== 'string' || !tournament.trim() || tournament.length > 160))
        || (expand_series !== undefined && !['true', 'false'].includes(expand_series))) {
        return res.status(400).json({ success: false, error: '조회 개수는 1~200, 대회 이름은 160자 이내여야 합니다.' });
      }

      let query = db
        .from('matches')
        .select('*')
        .order('datetime_utc', { ascending: false })
        .limit(Number(limit));

      if (tournament) {
        query = query.eq('tournament', tournament);
      }

      const { data: matches, error } = await query;
      if (error) throw error;

      // Fetch every stored set of the selected series so the initial row limit
      // cannot cut a best-of series in half and undercount its score.
      let result = matches;
      if (req.query.expand_series === 'true' && matches.length) {
        const ids = [...new Set(matches.map((match) => match.match_id).filter(Boolean))];
        const byGame = new Map(matches.map((match) => [match.game_id, match]));
        if (ids.length) {
          let offset = 0;
          while (true) {
            const { data: sets, error: setsError } = await db.from('matches').select('*').in('match_id', ids).order('game_id').range(offset, offset + 499);
            if (setsError) throw setsError;
            sets.forEach((set) => byGame.set(set.game_id, set));
            if (sets.length < 500) break;
            offset += 500;
          }
        }
        result = [...byGame.values()];
      }
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('[API] GET /matches:', error.code || 'DATABASE_ERROR');
      res.status(500).json({ success: false, error: '경기 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  });

  router.get('/matches/:gameId/stats', async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Supabase not initialized.' });

      const { data: stats, error } = await db
        .from('player_stats')
        .select('*')
        .eq('game_id', req.params.gameId);

      if (error) throw error;
      const match = await db.from('matches').select('*').eq('game_id', req.params.gameId).maybeSingle();
      if (match.error) throw match.error;
      res.json({ success: true, data: attachPlayerTeams(stats, match.data ? [match.data] : []) });
    } catch (error) {
      console.error('[API] GET /stats:', error.code || 'DATABASE_ERROR');
      res.status(500).json({ success: false, error: '경기 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  });

  router.get('/standings', async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Supabase not initialized.' });

      const { tournament } = req.query;
      if (tournament !== undefined && (typeof tournament !== 'string' || !tournament.trim() || tournament.length > 160)) return res.status(400).json({ error: '올바른 대회 이름이 필요합니다.' });
      let query = db.from('matches').select('team1, team2, win_team, loss_team, tournament');
      if (tournament) query = query.eq('tournament', tournament);

      const { data: matches, error } = await query;
      if (error) throw error;

      const teamMap = Object.create(null);
      matches.forEach(({ team1, team2, win_team, loss_team }) => {
        [team1, team2].forEach((team) => {
          if (team && !teamMap[team]) teamMap[team] = { team, wins: 0, losses: 0 };
        });
        if (win_team && teamMap[win_team]) teamMap[win_team].wins++;
        if (loss_team && teamMap[loss_team]) teamMap[loss_team].losses++;
      });

      const standings = Object.values(teamMap).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
      res.json({ success: true, data: standings });
    } catch (error) {
      console.error('[API] GET /standings:', error.code || 'DATABASE_ERROR');
      res.status(500).json({ success: false, error: '경기 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  });

  router.post('/sync', localImportGuard(), async (req, res) => {
    try {
      const { tournament = 'LCK%', limit = 1 } = req.body;
      res.json(await sync.syncMatches(tournament, Number(limit)));
    } catch (error) {
      res.status(error.status || 500).json({ success: false, code: error.code || 'IMPORT_FAILED', error: error.status ? error.message : '경기 가져오기에 실패했습니다.' });
    }
  });

  return router;
}
module.exports = createApiRouter();
module.exports.createApiRouter = createApiRouter;
