/**
 * RIFT.GG - Team Rosters Data
 * 팀별 5인 로스터 (포지션, 선수명, 실명, KDA)
 */

export const ROSTERS = {
  T1 : [["TOP","Doran","최현준",3.9],["JGL","Oner","문현준",4.4],["MID","Faker","이상혁",5.1],["BOT","Peyz","김수환",6.2],["SUP","Keria","류민석",5.8]],
  GEN: [["TOP","Kiin","김기인",4.6],["JGL","Canyon","김건부",5.4],["MID","Chovy","정지훈",7.3],["BOT","Ruler","박재혁",6.0],["SUP","Duro","주민규",4.9]],
  HLE: [["TOP","Zeus","최우제",4.8],["JGL","Kanavi","서진혁",4.7],["MID","Zeka","김건우",5.6],["BOT","Gumayusi","이민형",6.5],["SUP","Delight","유환중",5.2]],
  KT : [["TOP","PerfecT","이승민",4.1],["JGL","Cuzz","문우찬",4.3],["MID","Bdd","곽보성",5.2],["BOT","Aiming","김하람",5.9],["SUP","Pollu","이상현",4.4]],
  DK : [["TOP","Siwoo","전시우",3.7],["JGL","Lucid","최용혁",4.5],["MID","ShowMaker","허수",5.0],["BOT","Smash","이동하",5.3],["SUP","Career","김동환",4.2]],
  BFX: [["TOP","Clear","송현민",3.8],["JGL","Raptor","서동균",4.0],["MID","VicLa","이대광",4.6],["BOT","Diable","이창석",5.1],["SUP","Kellin","김형규",4.3]],
  NS : [["TOP","Kingen","황성훈",3.6],["JGL","Sponge","박기훈",3.4],["MID","Calix","김동현",4.2],["BOT","Taeyoon","김태윤",4.5],["SUP","Lehends","손시우",4.1]],
  DRX: [["TOP","Rich","이재원",3.5],["JGL","Vincenzo","심준승",3.3],["MID","ucal","손우현",4.0],["BOT","Jiwoo","정지우",4.4],["SUP","Andil","문관빈",3.6]],
  BRO: [["TOP","Casting","이동훈",3.2],["JGL","Gideon","김민상",3.1],["MID","Fisher","김정현",3.8],["BOT","Teddy","박진성",4.6],["SUP","Namgung","남궁현",3.4]],
  DNS: [["TOP","DuDu","이동주",3.9],["JGL","Pyosik","홍창현",3.7],["MID","Clozer","이주현",4.3],["BOT","deokdam","서대길",4.8],["SUP","Life","김정민",3.9]]
};

export function getRoster(teamCode) {
  return ROSTERS[teamCode] || [];
}
