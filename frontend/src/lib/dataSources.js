export const CC_LICENSE = 'https://creativecommons.org/licenses/by-sa/3.0/';
export const CHAINCC_SOURCE = 'https://chaincc.lol/free/data';
export const CHAINCC_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
export function leaguepediaArticle(gameId) {
  if (typeof gameId !== 'string' || !gameId.includes('/')) return null;
  const title = gameId.slice(0, gameId.lastIndexOf('/'));
  return {title, url: `https://lol.fandom.com/wiki/${encodeURIComponent(title.replaceAll(' ', '_')).replaceAll('%2F', '/')}`};
}
