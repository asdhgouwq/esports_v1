const teams = [
  {
    "name": "HANJIN BRION",
    "image": "https://static.lolesports.com/teams/1716454325887_Nowyprojekt.png",
    "aliases": [
      "BRO",
      "BRION",
      "한진 브리온"
    ]
  },
  {
    "name": "NONGSHIM RED FORCE",
    "image": "https://static.lolesports.com/teams/NSFullonDark.png",
    "aliases": [
      "NS",
      "농심 레드포스"
    ]
  },
  {
    "name": "kt Rolster",
    "image": "https://static.lolesports.com/teams/kt_darkbackground.png",
    "aliases": [
      "KT",
      "KT 롤스터"
    ]
  },
  {
    "name": "Hanwha Life Esports",
    "image": "https://static.lolesports.com/teams/1631819564399_hle-2021-worlds.png",
    "aliases": [
      "HLE",
      "한화생명"
    ]
  },
  {
    "name": "BNK FEARX",
    "image": "https://static.lolesports.com/teams/1734691810721_BFXfullcolorfordarkbg.png",
    "aliases": [
      "BFX",
      "FEARX"
    ]
  },
  {
    "name": "DN SOOPers",
    "image": "https://static.lolesports.com/teams/1767340467921_DN_SOOPerslogo_profile.webp",
    "aliases": [
      "DNS"
    ]
  },
  {
    "name": "Gen.G Esports",
    "image": "https://static.lolesports.com/teams/1773829250929_GENGLOGO_GOLD.png",
    "aliases": [
      "Gen.G",
      "GenG",
      "GEN",
      "젠지"
    ]
  },
  {
    "name": "T1",
    "image": "https://static.lolesports.com/teams/1726801573959_539px-T1_2019_full_allmode.png",
    "aliases": []
  },
  {
    "name": "KIWOOM DRX",
    "image": "https://static.lolesports.com/teams/1774247803537_horizontal_EN_Wh.png",
    "aliases": [
      "DRX",
      "키움 DRX"
    ]
  },
  {
    "name": "Dplus KIA",
    "image": "https://static.lolesports.com/teams/1673260049703_DPlusKIALOGO11.png",
    "aliases": [
      "DK",
      "Dplus",
      "디플러스 기아"
    ]
  },
  {
    "name": "Karmine Corp",
    "image": "https://static.lolesports.com/teams/1704714951336_KC.png",
    "aliases": [
      "KC",
      "카르민 코프"
    ]
  },
  {
    "name": "Cloud9 Kia",
    "image": "https://static.lolesports.com/teams/1736924120254_C9Kia_IconBlue_Transparent_2000x2000.png",
    "aliases": [
      "Cloud9",
      "C9"
    ]
  },
  {
    "name": "MVK Esports",
    "image": "https://static.lolesports.com/teams/1767089709161_White_Logo.png",
    "aliases": [
      "MVK"
    ]
  },
  {
    "name": "FURIA",
    "image": "https://static.lolesports.com/teams/FURIA---black.png",
    "aliases": []
  },
  {
    "name": "Invictus Gaming",
    "image": "https://static.lolesports.com/teams/1634762917340_300px-Invictus_Gaming_logo.png",
    "aliases": [
      "IG",
      "iG",
      "인빅터스 게이밍"
    ]
  },
  {
    "name": "TOP ESPORTS",
    "image": "https://static.lolesports.com/teams/1592592064571_TopEsportsTES-01-FullonDark.png",
    "aliases": [
      "TES"
    ]
  },
  {
    "name": "BILIBILI GAMING",
    "image": "https://static.lolesports.com/teams/1682322954525_Bilibili_Gaming_logo_20211.png",
    "aliases": [
      "BLG"
    ]
  },
  {
    "name": "Movistar KOI",
    "image": "https://static.lolesports.com/teams/1734012609283_MKOI_FullColor_Blue.png",
    "aliases": [
      "MKOI"
    ]
  },
  {
    "name": "Anyone's Legend",
    "image": "https://static.lolesports.com/teams/1641199582689_.png",
    "aliases": [
      "AL"
    ]
  },
  {
    "name": "G2 Esports",
    "image": "https://static.lolesports.com/teams/G2-FullonDark.png",
    "aliases": [
      "G2"
    ]
  },
  {
    "name": "Team Liquid Alienware",
    "image": "https://static.lolesports.com/teams/1769357207762_TLAlienware_Minimal_Bug-White.png",
    "aliases": [
      "Team Liquid",
      "TL",
      "TLAW"
    ]
  },
  {
    "name": "CTBC Flying Oyster",
    "image": "https://static.lolesports.com/teams/1656307849320_CFO_Logo.png",
    "aliases": [
      "CFO"
    ]
  },
  {
    "name": "LOS",
    "image": "https://static.lolesports.com/teams/1784013312149_LOS-OLaranja.png",
    "aliases": [
      "LØS"
    ]
  },
  {
    "name": "Team Secret Whales",
    "image": "https://static.lolesports.com/teams/1774598000328_White_EyeText_600p.png",
    "aliases": [
      "TSW"
    ]
  },
  {
    "name": "LYON",
    "image": "https://static.lolesports.com/teams/1743717443673_isotypelyon-03.png",
    "aliases": [
      "LYON (2024 American Team)"
    ]
  }
];
const normalize = name => String(name ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const logos = new Map(teams.flatMap(team => [team.name, ...team.aliases].map(name => [normalize(name), team.image])));

export function teamLogoUrl(name) {
  const image = logos.get(normalize(name));
  return image ? `https://am-a.akamaihd.net/image?resize=128:&f=${encodeURIComponent(image)}` : null;
}
