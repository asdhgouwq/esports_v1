export const dragonNames={chemtech:'화학공학',hextech:'마법공학',cloud:'바람',infernal:'화염',mountain:'대지',ocean:'바다',elder:'장로'};
export const objectiveLabels = { dragon: '용', void_grubs: '유충', baron: '바론', herald: '전령', first_blood: '퍼스트블러드', first_tower: '첫 포탑' };
// Firsts refer to the entire game, never each team's first occurrence.
export function objectiveTimeline(data) {
  const valid = (data.events || []).filter(e => Number.isFinite(e.seconds) && e.seconds >= 0 && [data.blue.team, data.red.team].includes(e.team));
  const events = valid.filter(e => ['dragon', 'void_grubs', 'baron', 'herald'].includes(e.kind)).map(e => ({ ...e }));
  if (data.coverage.complete) for (const [source, kind] of [['kills', 'first_blood'], ['tower', 'first_tower']]) {
    const sorted = valid.filter(e => e.kind === source).sort((a,b) => a.seconds-b.seconds);
    const earliest = sorted.filter(e => e.seconds === sorted[0]?.seconds);
    // A tied scoreboard update from opposing teams cannot establish who was first.
    if (earliest.length === 1) events.push({ ...earliest[0], kind, count: 1 });
  }
  return events.sort((a,b) => a.seconds-b.seconds || a.id.localeCompare(b.id));
}
