const axios = require('axios');

class DataDragonService {
  constructor() {
    this.baseUrl = 'https://ddragon.leagueoflegends.com';
    this.version = null;
    this.champions = null;
  }

  async init() {
    try {
      if (this.version) return;
      
      const response = await axios.get(`${this.baseUrl}/api/versions.json`);
      this.version = response.data[0];
      console.log(`[DataDragon] Initialized with version: ${this.version}`);
      
      const champRes = await axios.get(`${this.baseUrl}/cdn/${this.version}/data/en_US/champion.json`);
      this.champions = champRes.data.data;
    } catch (error) {
      console.error('[DataDragon] Initialization failed:', error.message);
      this.version = '14.1.1';
    }
  }

  getChampionImageUrl(championId) {
    if (!championId) return '';
    const formattedName = championId.replace(/[' ]/g, '').replace(/^[a-z]/, c => c.toUpperCase());
    
    const exceptionMap = {
      'Wukong': 'MonkeyKing',
      'RenataGlasc': 'Renata'
    };
    
    const finalId = exceptionMap[formattedName] || formattedName;
    return `${this.baseUrl}/cdn/${this.version}/img/champion/${finalId}.png`;
  }

  getItemImageUrl(itemId) {
    if (!itemId) return '';
    return `${this.baseUrl}/cdn/${this.version}/img/item/${itemId}.png`;
  }

  getRuneImageUrl(iconPath) {
    if (!iconPath) return '';
    return `${this.baseUrl}/cdn/img/${iconPath}`;
  }
}

const ddragonService = new DataDragonService();
module.exports = ddragonService;
