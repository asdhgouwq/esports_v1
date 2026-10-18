const leaguepediaService = require('./leaguepedia');
const supabase = require('../config/supabase');

class DataSyncService {
  async syncMatches(tournamentName = 'LCK 2024 Spring', limit = 10) {
    console.log('[DataSync] Starting match sync...');
    if (!supabase) {
      console.error('[DataSync] Supabase client not initialized.');
      return;
    }

    try {
      const matches = await leaguepediaService.getRecentMatches(tournamentName, limit);
      
      for (const match of matches) {
        const payload = {
          game_id: match.GameId,
          match_id: match.MatchId,
          tournament: match.Tournament,
          datetime_utc: match.DateTime_UTC,
          team1: match.Team1,
          team2: match.Team2,
          win_team: match.WinTeam,
          loss_team: match.LossTeam,
          patch: match.Patch,
          team1_bans: match.Team1Bans,
          team2_bans: match.Team2Bans,
          team1_picks: match.Team1Picks,
          team2_picks: match.Team2Picks,
          gamelength_number: match.Gamelength_Number ? parseFloat(match.Gamelength_Number) : null
        };

        const { error } = await supabase
          .from('matches')
          .upsert(payload, { onConflict: 'game_id' });

        if (error) {
          console.error(`[DataSync] Error upserting match ${match.GameId}:`, error.message);
        } else {
          console.log(`[DataSync] Upserted match ${match.GameId} successfully.`);
        }
      }
      console.log('[DataSync] Match sync completed.');
    } catch (error) {
      console.error('[DataSync] Sync failed:', error.message);
    }
  }

  async syncPlayerStats(gameId) {
    console.log(`[DataSync] Starting player stats sync for GameId: ${gameId}...`);
    if (!supabase) return;

    try {
      const players = await leaguepediaService.getPlayerStats(gameId);

      for (const player of players) {
        const payload = {
          id: `${player.GameId}_${player.Name}`,
          game_id: player.GameId,
          name: player.Name,
          role: player.Role,
          champion: player.Champion,
          kills: player.Kills ? parseInt(player.Kills, 10) : 0,
          deaths: player.Deaths ? parseInt(player.Deaths, 10) : 0,
          assists: player.Assists ? parseInt(player.Assists, 10) : 0,
          gold: player.Gold ? parseInt(player.Gold, 10) : 0,
          cs: player.CS ? parseInt(player.CS, 10) : 0,
          damage_to_champions: player.DamageToChampions ? parseInt(player.DamageToChampions, 10) : 0,
          item0: player.Item0,
          item1: player.Item1,
          item2: player.Item2,
          item3: player.Item3,
          item4: player.Item4,
          item5: player.Item5,
          trinket: player.Trinket,
          primary_tree: player.PrimaryTree,
          keystone: player.Keystone
        };

        const { error } = await supabase
          .from('player_stats')
          .upsert(payload, { onConflict: 'id' });

        if (error) {
          console.error(`[DataSync] Error upserting player ${player.Name}:`, error.message);
        }
      }
      console.log(`[DataSync] Player stats sync completed for GameId: ${gameId}.`);
    } catch (error) {
      console.error('[DataSync] Stats sync failed:', error.message);
    }
  }
}

const dataSyncService = new DataSyncService();
module.exports = dataSyncService;
