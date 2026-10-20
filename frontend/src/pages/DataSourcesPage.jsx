import {Link} from 'react-router-dom';
import {CC_LICENSE} from '../components/DataAttribution';
import '../styles/data-attribution.css';
const External=({href,children})=><a href={href} target="_blank" rel="noreferrer">{children} ↗</a>;
export default function DataSourcesPage() {
 return <article className="data-sources-page"><Link to="/" className="sources-back">← 경기 목록</Link><header><span className="eyebrow">DATA SOURCES</span><h1>데이터 출처·이용 안내</h1><p>어디서 온 기록인지, 어떤 방식으로 정리했는지 안내합니다.</p><small>안내 확인일: 2026년 10월 20일</small></header>
 <section><h2>경기·밴픽·선수 통계</h2><p><External href="https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki">Leaguepedia</External> 및 해당 문서 기여자들의 기록을 Cargo API로 가져옵니다. 일정, 경기 결과, 밴픽 순서와 선수의 최종 통계를 정규화하고 팀별 수치를 집계합니다. 경기 상세의 출처 링크에서 관련 대회 문서와 기여 이력을 확인할 수 있습니다.</p>
 <p>별도 표시가 없는 Leaguepedia 원본과 이를 바탕으로 가공한 기록은 <External href={CC_LICENSE}>Creative Commons 저작자표시-동일조건변경허락 3.0 Unported (CC BY-SA 3.0)</External>에 따라 제공합니다. 재사용 시 원본·기여자, 라이선스와 변경 사실을 표시하고 파생 콘텐츠에는 동일 라이선스를 적용해야 합니다. 이 안내는 사이트 전체 코드나 별도 출처의 이미지·피드에 같은 라이선스를 부여한다는 뜻이 아닙니다.</p>
 <p className="sources-links"><External href="https://lol.fandom.com/wiki/Leaguepedia:Copyrights">Leaguepedia 저작권 안내</External><External href="https://www.fandom.com/licensing">Fandom 라이선스 정책</External></p></section>
 <section><h2>경기 흐름·시간대별 골드</h2><p>LoL Esports 웹사이트의 공개 접근 가능한 LiveStats 피드에서 수집한 기록을 사용합니다. 골드는 약 10초 간격으로 표시하고, 누적 기록의 변화를 사건으로 정리합니다. 연결된 세트에만 타임라인을 표시하며 피드 경과 시간은 실제 게임 시계와 수초 차이가 있을 수 있습니다.</p>
 <div className="sources-status"><strong>피드의 저장·재배포 허용 범위는 확인되지 않았습니다.</strong><p>공개 접근과 재배포 허가는 별개입니다. 이 출처 표시는 별도의 이용 허가나 공식 데이터 공급 계약을 의미하지 않습니다. 상시 공개 운영·상업적 이용 전에는 제공자의 조건과 필요한 권한을 확인해야 합니다.</p></div>
 <p>확인한 Riot 안내는 공식 프로 경기 데이터 제공 경로로 GRID를 소개합니다. 일반 Riot 개발자 API 조건을 이 피드의 별도 이용 허가로 간주하지 않습니다.</p><p className="sources-links"><External href="https://riotesportsdata.com/en-us/league-of-legends/">공식 e스포츠 데이터 안내</External><External href="https://developer.riotgames.com/policies/general">Riot 개발자 정책</External><External href="https://www.riotgames.com/en/terms-of-service">Riot 이용 약관</External></p></section>
 <section><h2>게임 이미지·AI 요약</h2><p>챔피언·아이템 이미지는 Riot Games의 Data Dragon을 사용합니다. 이미지와 상표에는 Leaguepedia의 CC 라이선스가 자동 적용되지 않습니다.</p><p>AI 요약은 수집한 기록을 바탕으로 dol.gg에서 생성한 해설이며 공식 해설이 아닙니다. 수치·사건 시점을 원본과 대조하지만 오류가 있을 수 있습니다. 위치·교전 상세 등 확인되지 않은 내용은 기록으로 단정하지 않습니다.</p><p className="sources-links"><External href="https://developer.riotgames.com/docs/lol#data-dragon">Data Dragon 안내</External><External href="https://www.riotgames.com/en/legal">Riot 팬 프로젝트 정책</External></p></section>
 <section><h2>다른 통계 사이트와의 관계</h2><p>현재 dol.gg는 gol.gg 또는 OP.GG의 데이터를 자동 수집하거나 공급받지 않습니다. 두 사이트의 데이터를 확인·비교한 사실은 재사용 허가나 제휴를 의미하지 않습니다.</p></section>
 </article>;
}
