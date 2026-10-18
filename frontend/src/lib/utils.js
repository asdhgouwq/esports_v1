const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

const EXCEPTION_MAP = {
  Wukong: 'MonkeyKing',
  Nunu: 'Nunu',
  RenataGlasc: 'Renata',
};

export function getChampionImageUrl(version, championName) {
  if (!championName || !version) return '';
  const formatted = championName
    .replace(/[' ]/g, '')
    .replace(/^[a-z]/, (c) => c.toUpperCase());
  const finalId = EXCEPTION_MAP[formatted] || formatted;
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${finalId}.png`;
}

export function getItemImageUrl(version, itemId) {
  if (!itemId || !version) return '';
  return `${DDRAGON_BASE}/cdn/${version}/img/item/${itemId}.png`;
}

export function getRuneImageUrl(iconPath) {
  if (!iconPath) return '';
  return `${DDRAGON_BASE}/cdn/img/${iconPath}`;
}

export function formatGameLength(minutes) {
  if (!minutes) return '--:--';
  const totalSeconds = Math.round(Number(minutes) * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
