const normalize = value => String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const indexes = new WeakMap();
const JUNGLE_PETS = new Map([['1101', ['red', '빨강', '1211']], ['1102', ['blue', '파랑', '1210']], ['1103', ['green', '초록', '1209']]]);
function indexCatalog(catalog, properties) {
  if (!catalog || typeof catalog !== 'object') return new Map();
  let index = indexes.get(catalog);
  if (index) return index;
  index = new Map();
  for (const [id, record] of Object.entries(catalog)) {
    const entry = Array.isArray(catalog) ? record : {...record, id: record.id || id};
    for (const key of new Set(properties.map(property => normalize(entry[property])).filter(Boolean))) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(entry);
    }
  }
  indexes.set(catalog, index);
  return index;
}
export function findRune(value, catalog) {
  if (value === null || value === undefined || value === '') return null;
  return indexCatalog(catalog, ['id', 'key', 'name']).get(normalize(value))?.[0] || null;
}
export function findSpell(value, catalog) {
  if (value === null || value === undefined || value === '') return null;
  const candidates = indexCatalog(catalog, ['id', 'key', 'name']).get(normalize(value)) || [];
  const standard = candidates.filter(spell => spell.modes?.includes('CLASSIC') && !spell.id.includes('_Jade') && !spell.id.includes('Cherry'));
  return standard.length === 1 ? standard[0] : candidates.length === 1 ? candidates[0] : null;
}
export function findItem(value, catalog) {
  if (!value) return null;
  if (catalog && Object.hasOwn(catalog, value)) return {...catalog[value], id: String(value)};
  const candidates = indexCatalog(catalog, ['name']).get(normalize(value)) || [];
  if (candidates.length === 1) return candidates[0];
  const classic = candidates.filter(item => item.maps?.['11'] && !item.requiredAlly && !item.requiredChampion);
  const standard = classic.filter(item => /^\d{4}$/.test(item.id));
  return classic.length === 1 ? classic[0] : standard.length === 1 ? standard[0] : null;
}
export function matchingLoadout(data, player) {
  if (data?.state !== 'ready' || data.gameId !== player.game_id || !Array.isArray(data.players)) return null;
  const matches = data.players.filter(row => row.name === player.name && row.team === player.team && row.champion === player.champion);
  return matches.length === 1 ? matches[0] : null;
}
export function findRoleQuest(value, catalog) {
  const item = findItem(value, catalog);
  return item?.name === 'Jungle Quest Reward' ? null : item;
}
export function findJunglePet(value, catalog) {
  const pet = JUNGLE_PETS.get(String(value)), item = pet && findItem(String(value), catalog);
  const artwork = pet && findItem(pet[2], catalog);
  if (item && artwork?.image) return {...item, image: artwork.image, color: pet[0], colorLabel: pet[1]};
  return null;
}
