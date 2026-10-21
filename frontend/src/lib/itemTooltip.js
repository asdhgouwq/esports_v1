const entities = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·', times: '×'};

function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    if (!name.startsWith('#')) return entities[name.toLowerCase()] ?? entity;
    const hex = name[1].toLowerCase() === 'x';
    const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '�';
  });
}

function textContent(html) {
  return decodeEntities(html
    .replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/?(?:p|div|ul|ol)\b[^>]*>/gi, '\n\n')
    .replace(/<\/?[a-z][^>]*>/gi, ''))
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

export function itemTooltipDetails(item) {
  const description = typeof item?.description === 'string' ? item.description : '';
  const stats = [];
  const effectsHtml = description.replace(/<stats\b[^>]*>([\s\S]*?)<\/stats\s*>/gi, (_match, content) => {
    stats.push(...textContent(content).split('\n').filter(Boolean));
    return '';
  });
  const effectsText = textContent(effectsHtml);
  const fallback = !description || !stats.length && !effectsText;
  const effects = fallback && typeof item?.plaintext === 'string' ? textContent(item.plaintext) : effectsText;
  return {stats, effects: effects.split(/\n{2,}/).filter(Boolean)};
}
