/**
 * RIFT.GG - Constants & Configuration
 * 팀, 리그, 포지션, 색상 상수
 */

export const TEAMS = {
  T1 : {code:"T1",  name:"T1",                 color:"#e2012d", founded:2003, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/T1.png"},
  GEN: {code:"GEN", name:"Gen.G",              color:"#c9a227", founded:2017, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/Gen.G.png"},
  HLE: {code:"HLE", name:"한화생명e스포츠",       color:"#f5811f", founded:2018, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/Hanwha_Life_Esports.png"},
  KT : {code:"KT",  name:"KT 롤스터",            color:"#8a1538", founded:2012, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/KT_Rolster.png"},
  DK : {code:"DK",  name:"Dplus KIA",          color:"#163f6d", founded:2012, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/Dplus_KIA.png"},
  BFX: {code:"BFX", name:"BNK FearX",          color:"#00a79b", founded:2020, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/BNK_FearX.png"},
  NS : {code:"NS",  name:"농심 레드포스",         color:"#b8272d", founded:2021, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/Nongshim_RedForce.png"},
  DRX: {code:"DRX", name:"키움 DRX",            color:"#4a90d9", founded:2012, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/DRX.png"},
  BRO: {code:"BRO", name:"한진 브리온",          color:"#3d7dbf", founded:2015, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/Hanhwa_Brion.png"},
  DNS: {code:"DNS", name:"DN 수퍼스",           color:"#2b4de0", founded:2024, region:"KR", logo:"https://lck.gg/image/cms/2023/teams/DN_Supernovas.png"},
  BLG: {code:"BLG", name:"Bilibili Gaming",    color:"#1f5fd6", founded:2017, region:"CN", logo:"https://lol.fandom.com/wiki/File:BilibiliGaming.png"},
  TES: {code:"TES", name:"Top Esports",        color:"#c0392b", founded:2017, region:"CN", logo:"https://lol.fandom.com/wiki/File:Top_Esports.png"},
  G2 : {code:"G2",  name:"G2 Esports",         color:"#e4002b", founded:2015, region:"EU", logo:"https://lol.fandom.com/wiki/File:G2_Esports.png"},
  FNC: {code:"FNC", name:"Fnatic",             color:"#ff5800", founded:2004, region:"EU", logo:"https://lol.fandom.com/wiki/File:Fnatic.png"}
};

export const LEAGUES = {
  LCK: { name: "LCK", region: "Korea", color: "#2a78d6" },
  LPL: { name: "LPL", region: "China", color: "#ff6b35" },
  LEC: { name: "LEC", region: "Europe", color: "#1baf7a" }
};

export const POSITIONS = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "봇",
  SUP: "서포터"
};

export const MATCH_STATUS = {
  UPCOMING: "upcoming",
  LIVE: "live",
  DONE: "done"
};

export const VIEWPORTS = ["home", "schedule", "standings", "teams", "analysis"];
