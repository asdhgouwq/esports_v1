const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash, randomUUID} = require('node:crypto');
const {attachPlayerTeams} = require('./playerTeams');
const fields = 'GameId,Link=Name,Team,Champion,PrimaryTree,SecondaryTree,KeystoneRune=Keystone,SummonerSpells__full=SummonerSpells,Items__full=Items,Trinket,RoleBoundItem';
const fileName = id => `${createHash('sha256').update(id).digest('hex')}.json`;
const clean = value => typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : null;
const slots = (value, delimiter, count) => {
  const values = String(value || '').split(delimiter);
  return Array.from({length: count}, (_, i) => clean(values[i]));
};
function normalizeLoadouts(rows, roster, gameId) {
  if (roster.length !== 10 || rows.length !== 10 || new Set(roster.map(row => row.name)).size !== 10 || new Set(rows.map(row => row.Name)).size !== 10) throw new Error('Incomplete loadout roster');
  return rows.map(row => {
    const player = roster.find(player => player.name === row.Name && player.game_id === gameId);
    if (!player || row.GameId !== gameId || player.team !== row.Team || player.champion !== row.Champion) throw new Error('Loadout identity mismatch');
    return {name: row.Name, team: row.Team, champion: row.Champion, primaryTree: clean(row.PrimaryTree), secondaryTree: clean(row.SecondaryTree), keystone: clean(row.Keystone), spells: slots(row.SummonerSpells, ',', 2), items: slots(row.Items, ';', 6), trinket: clean(row.Trinket), roleBoundItem: clean(row.RoleBoundItem)};
  });
}
function validSaved(saved, roster, gameId, now) {
  const age = now - Date.parse(saved.fetchedAt);
  const text = value => value === null || (typeof value === 'string' && value.length <= 160);
  return saved.version === 2 && saved.state === 'ready' && saved.gameId === gameId && age >= 0 && age < 86400000
    && Array.isArray(saved.players) && saved.players.length === 10 && new Set(saved.players.map(row => row.name)).size === 10
    && saved.players.every(row => roster.some(player => player.name === row.name && player.team === row.team && player.champion === row.champion)
      && Array.isArray(row.items) && row.items.length === 6 && row.items.every(text)
      && Array.isArray(row.spells) && row.spells.length === 2 && row.spells.every(text)
      && ['primaryTree', 'secondaryTree', 'keystone', 'trinket', 'roleBoundItem'].every(key => text(row[key])));
}
function createPlayerLoadoutService({db, source, directory = path.resolve(__dirname, '../../data/player-loadouts'), now = () => Date.now()} = {}) {
  const pending = new Map();
  const memory = new Map();
  async function load(gameId) {
    const [stats, match] = await Promise.all([db.from('player_stats').select('*').eq('game_id', gameId), db.from('matches').select('*').eq('game_id', gameId).maybeSingle()]);
    if (stats.error || match.error || !match.data) throw new Error('Loadout roster unavailable');
    const roster = attachPlayerTeams(stats.data || [], [match.data]);
    if (roster.length !== 10) throw new Error('Incomplete loadout roster');
    const file = path.join(directory, fileName(gameId));
    try {
      const saved = JSON.parse(await fs.readFile(file, 'utf8'));
      if (validSaved(saved, roster, gameId, now())) return saved;
    } catch {}
    const literal = gameId.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const rows = await source.cargoQuery({tables: 'ScoreboardPlayers', fields, where: `GameId = '${literal}'`, limit: 20});
    const result = {version: 2, state: 'ready', gameId, source: 'Leaguepedia · ScoreboardPlayers', fetchedAt: new Date(now()).toISOString(), players: normalizeLoadouts(rows, roster, gameId)};
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.mkdir(directory, {recursive: true});
      await fs.writeFile(temporary, JSON.stringify(result));
      await fs.rename(temporary, file);
    } catch {
      await fs.unlink(temporary).catch(() => {});
      console.warn('[Player loadouts] Disk cache unavailable.');
    }
    return result;
  }
  function getLoadouts(gameId) {
    if (typeof gameId !== 'string' || !gameId.trim() || gameId.length > 300 || /[\x00-\x1f]/.test(gameId)) return Promise.resolve({state: 'unavailable'});
    const cached = memory.get(gameId);
    if (cached?.expiresAt > now()) return Promise.resolve(cached.value);
    if (pending.has(gameId)) return pending.get(gameId);
    if (pending.size >= 8) return Promise.reject(new Error('Loadout requests busy'));
    const task = load(gameId).then(value => {
      memory.set(gameId, {value, expiresAt: now() + 60000});
      if (memory.size > 100) memory.delete(memory.keys().next().value);
      return value;
    }).finally(() => pending.delete(gameId));
    pending.set(gameId, task);
    return task;
  }
  return {getLoadouts};
}
module.exports = {createPlayerLoadoutService, normalizeLoadouts};
