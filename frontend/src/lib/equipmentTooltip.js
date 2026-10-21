const lookup = (catalog, id) => catalog && Object.hasOwn(catalog, id) ? catalog[id] : null;
const description = (...values) => values.find(value => typeof value === 'string' && value.trim() && !value.includes('{{')) || '';
const runeStyleDescriptions = new Map([
  ['8000', '공격 강화 및 지속적 피해'],
  ['8100', '빠른 접근과 폭발적 피해'],
  ['8200', '스킬 강화 및 자원 관리'],
  ['8300', '창의적 방식의 전투 보조'],
  ['8400', '내구력 및 군중 제어'],
]);

export function equipmentTooltipEntry(type, id, equipment = {}) {
  if (type === 'item') return lookup(equipment.localizedItems, id) || lookup(equipment.items, id);
  const source = type === 'rune' ? equipment.runes?.find(rune => String(rune.id) === String(id)) : type === 'spell' ? lookup(equipment.spells, id) : null;
  const localized = type === 'rune' ? lookup(equipment.localizedRunes, id) : type === 'spell' ? lookup(equipment.localizedSpells, id) : null;
  const entry = localized || source;
  if (!entry) return null;
  const effect = type === 'rune'
    ? runeStyleDescriptions.get(String(id)) || description(localized?.longDesc, localized?.shortDesc, source?.longDesc, source?.shortDesc)
    : description(localized?.description, source?.description);
  return {...entry, name: localized?.name || source?.name, description: effect};
}
