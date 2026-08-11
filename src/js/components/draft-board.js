function hashStringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 50%)`;
}

export function renderDraftBoard(banpick) {
  if (!banpick) return '';

  const { a, b, blue, key } = banpick;

  const phases = [
    { name: '1차 밴 6개', start: 0, end: 6 },
    { name: '1차 픽 6개', start: 6, end: 12 },
    { name: '2차 밴 4개', start: 12, end: 16 },
    { name: '2차 픽 4개', start: 16, end: 20 }
  ];

  const order = [
    'a', 'b', 'a', 'b', 'a', 'b',
    'a', 'b', 'a', 'b', 'a', 'b',
    'b', 'a', 'b', 'a',
    'a', 'b', 'a', 'b'
  ];

  const allPicks = [...a.picks, ...a.bans, ...b.picks, ...b.bans].flat().slice(0, 20);
  const allBans = [...a.bans, ...b.bans].flat();

  let boardHtml = '';

  for (let i = 0; i < 20; i++) {
    const side = order[i];
    const sideData = side === 'a' ? a : b;
    const isBan = i < 6 || (i >= 12 && i < 16);

    let champ = '';
    let isKey = false;

    if (isBan) {
      const banIdx = i < 6 ? i : i - 12;
      const banList = side === 'a' ? a.bans : b.bans;
      champ = banList?.[banIdx] || '';
    } else {
      const pickIdx = i < 12 ? i - 6 : i - 16;
      const pickList = side === 'a' ? a.picks : b.picks;
      champ = pickList?.[pickIdx]?.[0] || '';
    }

    isKey = champ === key;

    const tileClass = `tile ${isBan ? 'ban' : 'pick'} ${isKey ? 'key' : ''}`;
    const bgColor = hashStringToColor(champ);

    boardHtml += `
      <div class="slot">
        <div class="${tileClass}" style="background-color:${bgColor}">
          <span class="ord">${i + 1}</span>
          <span>${champ}</span>
        </div>
      </div>
    `;
  }

  const phaseHtml = phases.map(p => {
    return `<div class="phase-mark">${p.name}</div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">밴픽 보드</h3>
      </div>
      <div class="card-body">
        <div class="draft-scroll">
          <div class="draft">
            ${boardHtml}
          </div>
        </div>

        <div class="bp-summary">
          <div class="bp-col">
            <h5>${a.team || '팀 A'}</h5>
            <div class="bp-line">
              <span class="bp-lb">밴:</span>
              <div>${a.bans?.join(' / ') || '-'}</div>
            </div>
            <div class="bp-line">
              <span class="bp-lb">픽:</span>
              <div>${a.picks?.map(p => p[0]).join(' / ') || '-'}</div>
            </div>
          </div>
          <div class="bp-col">
            <h5>${b.team || '팀 B'}</h5>
            <div class="bp-line">
              <span class="bp-lb">밴:</span>
              <div>${b.bans?.join(' / ') || '-'}</div>
            </div>
            <div class="bp-line">
              <span class="bp-lb">픽:</span>
              <div>${b.picks?.map(p => p[0]).join(' / ') || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
