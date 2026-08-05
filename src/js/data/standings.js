/**
 * RIFT.GG - League Standings Data
 * 리그 순위표 (레전드 그룹, 라이즈 그룹)
 */

export const STANDINGS = {
  legend: {
    label: "레전드 그룹",
    note: "플레이오프 직행권 경쟁 · 상위 팀은 부전승 라운드 확보",
    rows: [
      { t:"HLE", w:21, l:5,  sw:46, sl:19, streak:"W4", form:["W","W","W","L","W"] },
      { t:"GEN", w:20, l:6,  sw:44, sl:22, streak:"W2", form:["W","W","L","W","W"] },
      { t:"T1",  w:19, l:7,  sw:43, sl:25, streak:"W3", form:["W","W","W","L","W"] },
      { t:"KT",  w:16, l:10, sw:37, sl:29, streak:"L1", form:["L","W","W","L","W"] },
      { t:"DK",  w:14, l:12, sw:33, sl:32, streak:"W1", form:["W","L","W","L","L"] }
    ]
  },
  rise: {
    label: "라이즈 그룹",
    note: "플레이-인 시드 및 잔류 경쟁",
    rows: [
      { t:"BFX", w:13, l:13, sw:31, sl:32, streak:"L2", form:["L","L","W","W","L"] },
      { t:"NS",  w:11, l:15, sw:27, sl:35, streak:"W1", form:["W","L","L","W","L"] },
      { t:"DNS", w:9,  l:17, sw:24, sl:38, streak:"L1", form:["L","W","L","L","W"] },
      { t:"DRX", w:8,  l:18, sw:22, sl:39, streak:"L3", form:["L","L","L","W","L"] },
      { t:"BRO", w:6,  l:20, sw:18, sl:42, streak:"L1", form:["L","L","W","L","L"] }
    ]
  }
};

export function getGroupStandings(group) {
  return STANDINGS[group] || null;
}
