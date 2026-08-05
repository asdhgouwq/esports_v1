/**
 * RIFT.GG - Matches Data
 * 경기 일정 및 결과 (상태: upcoming, live, done)
 */

export const MATCHES = [
  { id:"m101", league:"LCK", stage:"라운드 4", date:"2026-07-28", time:"17:00", bo:3,
    a:"GEN", b:"HLE", sa:1, sb:1, status:"live", liveNote:"3세트 진행 중 · 24분" },
  { id:"m102", league:"LCK", stage:"라운드 4", date:"2026-07-28", time:"20:00", bo:3,
    a:"T1", b:"DK", sa:null, sb:null, status:"upcoming" },

  { id:"m103", league:"LCK", stage:"라운드 4", date:"2026-07-29", time:"17:00", bo:3,
    a:"KT", b:"BFX", sa:null, sb:null, status:"upcoming" },
  { id:"m104", league:"LCK", stage:"라운드 4", date:"2026-07-29", time:"20:00", bo:3,
    a:"DRX", b:"NS", sa:null, sb:null, status:"upcoming" },
  { id:"m105", league:"LPL", stage:"서머 정규", date:"2026-07-29", time:"18:00", bo:3,
    a:"BLG", b:"TES", sa:null, sb:null, status:"upcoming" },
  { id:"m106", league:"LCK", stage:"라운드 4", date:"2026-07-30", time:"17:00", bo:3,
    a:"BRO", b:"DNS", sa:null, sb:null, status:"upcoming" },
  { id:"m107", league:"LEC", stage:"서머 정규", date:"2026-07-30", time:"01:00", bo:3,
    a:"G2", b:"FNC", sa:null, sb:null, status:"upcoming" },

  { id:"m201", league:"LCK", stage:"라운드 4", date:"2026-07-25", time:"20:00", bo:3,
    a:"T1", b:"GEN", sa:2, sb:1, status:"done", featured:true },
  { id:"m202", league:"LCK", stage:"라운드 4", date:"2026-07-24", time:"17:00", bo:3,
    a:"HLE", b:"KT", sa:2, sb:0, status:"done" },
  { id:"m203", league:"LCK", stage:"라운드 4", date:"2026-07-23", time:"20:00", bo:3,
    a:"DK", b:"BFX", sa:2, sb:1, status:"done" },
  { id:"m204", league:"LCK", stage:"라운드 4", date:"2026-07-21", time:"17:00", bo:3,
    a:"NS", b:"GEN", sa:0, sb:2, status:"done" },
  { id:"m205", league:"LCK", stage:"라운드 3", date:"2026-07-19", time:"17:00", bo:3,
    a:"DNS", b:"DRX", sa:2, sb:1, status:"done", noReport:true },
  { id:"m206", league:"LPL", stage:"서머 정규", date:"2026-07-22", time:"18:00", bo:3,
    a:"TES", b:"BLG", sa:1, sb:2, status:"done", noReport:true }
];

export function getMatchById(id) {
  return MATCHES.find(m => m.id === id);
}

export function getMatchesByLeague(league) {
  return MATCHES.filter(m => m.league === league);
}

export function getMatchesByDate(date) {
  return MATCHES.filter(m => m.date === date);
}

export function getMatchesByStatus(status) {
  return MATCHES.filter(m => m.status === status);
}
