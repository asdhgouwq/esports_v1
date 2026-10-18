const axios = require('axios');

class LeaguepediaService {
  constructor() {
    this.apiUrl = 'https://lol.fandom.com/api.php';
  }

  async cargoQuery(params) {
    try {
      const response = await axios.get(this.apiUrl, {
        headers: {
          'User-Agent': 'DolGG-Backend/1.0 (contact: your-email@example.com) axios/1.x'
        },
        params: {
          action: 'cargoquery',
          format: 'json',
          ...params
        }
      });
      
      if (response.data.error) {
        throw new Error(`Cargo API Error: ${response.data.error.info}`);
      }
      
      return response.data.cargoquery.map(item => item.title);
    } catch (error) {
      console.error('[LeaguepediaService] Query failed:', error.message);
      throw error;
    }
  }

  async getRecentMatches(tournamentName = 'LCK 2024%', limit = 10) {
    console.log(`[LeaguepediaService] Fetching recent matches for ${tournamentName}...`);
    
    const params = {
      tables: 'ScoreboardGames',
      fields: 'GameId, MatchId, Tournament, DateTime_UTC, Team1, Team2, WinTeam, LossTeam, Patch, Team1Bans, Team2Bans, Team1Picks, Team2Picks, Gamelength_Number',
      where: `Tournament LIKE '${tournamentName}'`,
      order_by: 'DateTime_UTC DESC',
      limit: limit
    };

    const games = await this.cargoQuery(params);
    return games;
  }

  async getPlayerStats(gameId) {
    console.log(`[LeaguepediaService] Fetching player stats for GameId: ${gameId}...`);
    
    const params = {
      tables: 'ScoreboardPlayers',
      fields: 'GameId, Name, Role, Champion, Kills, Deaths, Assists, Gold, CS, DamageToChampions, Item0, Item1, Item2, Item3, Item4, Item5, Trinket, PrimaryTree, Keystone',
      where: `GameId = '${gameId}'`,
      order_by: 'Role'
    };

    const players = await this.cargoQuery(params);
    return players;
  }
}

const leaguepediaService = new LeaguepediaService();
module.exports = leaguepediaService;
