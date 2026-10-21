import {DDragonContext} from './appContexts';
import {useApiQuery} from '../hooks/useApiQuery';

const EMPTY = {runes: [], spells: {}, items: {}, localizedRunes: {}, localizedSpells: {}, localizedItems: {}};
async function getJson(url, signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error('Game catalog unavailable');
  return response.json();
}
const root = version => `https://ddragon.leagueoflegends.com/cdn/${version}/data/`;
const fetchVersions = (_key, signal) => getJson('https://ddragon.leagueoflegends.com/api/versions.json', signal);
const fetchChampions = async (version, signal) => (await getJson(`${root(version)}ko_KR/champion.json`, signal)).data;
async function fetchEquipment(version, signal) {
  const results = await Promise.allSettled(['en_US/runesReforged.json', 'en_US/summoner.json', 'en_US/item.json', 'ko_KR/item.json', 'ko_KR/runesReforged.json', 'ko_KR/summoner.json'].map(file => getJson(`${root(version)}${file}`, signal)));
  const [runes, spells, items, localizedItems, localizedRunes, localizedSpells] = results.map(result => result.status === 'fulfilled' ? result.value : null);
  const flattenRunes = styles => (styles || []).flatMap(style => [style, ...style.slots.flatMap(slot => slot.runes)]);
  return {
    runes: flattenRunes(runes), spells: spells?.data || {}, items: items?.data || {},
    localizedRunes: Object.fromEntries(flattenRunes(localizedRunes).map(rune => [rune.id, rune])),
    localizedSpells: localizedSpells?.data || {}, localizedItems: localizedItems?.data || {},
  };
}
export function DDragonProvider({children}) {
  const {data: versions} = useApiQuery('"versions"', fetchVersions);
  const version = versions?.[0] || null;
  const key = version ? JSON.stringify(version) : null;
  const {data: champions} = useApiQuery(key, fetchChampions);
  const {data: equipment} = useApiQuery(key, fetchEquipment);
  return <DDragonContext.Provider value={{version, champions: champions || {}, equipment: equipment || EMPTY}}>{children}</DDragonContext.Provider>;
}
