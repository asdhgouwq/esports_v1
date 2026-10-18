const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const dataSyncService = require('../services/dataSync');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'dol.gg Backend API is running' });
});

router.get('/matches', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not initialized.' });

    const { tournament, limit = 30 } = req.query;

    let query = supabase
      .from('matches')
      .select('*')
      .order('datetime_utc', { ascending: false })
      .limit(parseInt(limit, 10));

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
          const { data: sets, error: setsError } = await supabase.from('matches').select('*').in('match_id', ids).order('game_id').range(offset, offset + 499);
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
    console.error('[API] GET /matches:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/matches/:gameId/stats', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not initialized.' });

    const { data: stats, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('game_id', req.params.gameId);

    if (error) throw error;
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error(`[API] GET /matches/${req.params.gameId}/stats:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/standings', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not initialized.' });

    let query = supabase.from('matches').select('team1, team2, win_team, loss_team, tournament');
    if (req.query.tournament) {
      query = query.eq('tournament', req.query.tournament);
    }

    const { data: matches, error } = await query;
    if (error) throw error;

    const teamMap = {};
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
    console.error('[API] GET /standings:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { tournament = 'LCK 2024 Summer', limit = 20 } = req.body;
    console.log(`[API] POST /sync - tournament: ${tournament}, limit: ${limit}`);
    await dataSyncService.syncMatches(tournament, parseInt(limit, 10));
    res.json({ success: true, synced: limit, tournament });
  } catch (error) {
    console.error('[API] POST /sync:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
