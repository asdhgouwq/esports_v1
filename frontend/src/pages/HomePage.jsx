import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CompetitionNav from '../components/CompetitionNav';
import WorldsHub from '../components/WorldsHub';
import RecentMatches from '../components/RecentMatches';
import { belongsToCompetition } from '../config/competitions';
import { useMatchData } from '../hooks/useMatchData';
import { useDDragon } from '../contexts/DDragonContext';
import { getChampionImageUrl, formatGameLength } from '../lib/utils';
import '../styles/dashboard.css';

const split = (value) => (value || '').split(',').map((s) => s.trim()).filter(Boolean);
const initials = (name = '') => name.split(' ').map((s) => s[0]).join('').slice(0, 3).toUpperCase();
export default function HomePage({ competition: selectedCompetition, group }) {
  const { matches, loading, error, refetch } = useMatchData(selectedCompetition ? { limit: 200 } : { limit: 200, expand_series: 'true' });
  const { version } = useDDragon();
  const competitionId = selectedCompetition?.id || '';
  const [tournament, setTournament] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const categoryMatches = useMemo(() => matches.filter((m) => belongsToCompetition(m.tournament, competitionId)), [matches, competitionId]);
  const tournaments = useMemo(() => [...new Set(categoryMatches.map((m) => m.tournament).filter(Boolean))].sort(), [categoryMatches]);
  const activeTournament = tournaments.includes(tournament) ? tournament : '';
  const filtered = useMemo(() => categoryMatches.filter((m) => (!activeTournament || m.tournament === activeTournament) && `${m.team1} ${m.team2} ${m.tournament}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => sort === 'longest' ? Number(b.gamelength_number || 0) - Number(a.gamelength_number || 0) : new Date(b.datetime_utc) - new Date(a.datetime_utc)), [categoryMatches, activeTournament, search, sort]);
  const stats = useMemo(() => {
    const teams = new Set(), champions = new Map();
    let duration = 0, timed = 0, blue = 0, completed = 0;
    filtered.forEach((m) => {
      [m.team1, m.team2].filter(Boolean).forEach((t) => teams.add(t));
      if (Number(m.gamelength_number) > 0) { duration += Number(m.gamelength_number); timed++; }
      if (m.win_team && [m.team1, m.team2].includes(m.win_team)) { completed++; if (m.win_team === m.team1) blue++; }
      const picks = [...split(m.team1_picks), ...split(m.team2_picks)], bans = [...split(m.team1_bans), ...split(m.team2_bans)];
      [...new Set([...picks, ...bans])].forEach((name) => { const row = champions.get(name) || { name, picks: 0, bans: 0 }; if (picks.includes(name)) row.picks++; if (bans.includes(name)) row.bans++; champions.set(name, row); });
    });
    return { teams: teams.size, average: timed ? formatGameLength(duration / timed) : '—', blue: completed ? Math.round(blue / completed * 100) : null, champions: [...champions.values()].sort((a, b) => b.picks + b.bans - a.picks - a.bans).slice(0, 6) };
  }, [filtered]);
  const pages = Math.max(1, Math.ceil(filtered.length / 12)), current = Math.min(page, pages);
  const ready = !loading && !error;
  return <div className={`stats-dashboard${competitionId === 'worlds' ? ' worlds-page' : ''}`}>
    {selectedCompetition && <nav className="competition-breadcrumb" aria-label="현재 위치"><Link to="/">메인</Link><span>/</span><span>{group.label}</span><span>/</span><strong>{selectedCompetition.label}</strong></nav>}
    {competitionId !== 'worlds' && <div className="dashboard-heading"><div><div className="eyebrow">{selectedCompetition ? group.subtitle : 'LEAGUE OF LEGENDS / ESPORTS DATABASE'}</div><h1>{selectedCompetition ? <>{selectedCompetition.label} <span>경기 · 통계</span></> : <>경기의 흐름을 읽는 <span>데이터.</span></>}</h1><p>{selectedCompetition ? `${selectedCompetition.description}의 시즌별 경기 결과와 밴픽 통계를 살펴보세요.` : '프로 경기 결과부터 밴픽까지, 리그 오브 레전드의 모든 순간을 살펴보세요.'}</p></div><div className="database-label"><span /> {selectedCompetition ? selectedCompetition.label : 'MATCH EXPLORER'}<small>Leaguepedia 기반 경기 데이터</small></div></div>}
    <CompetitionNav selected={competitionId} />
    {competitionId === 'worlds' && <WorldsHub compact />}
    {!selectedCompetition ? <RecentMatches matches={matches} loading={loading} error={error} refetch={refetch} /> : <>
    <div className="competition-scope"><span>{selectedCompetition ? `${selectedCompetition.label} · ${selectedCompetition.description}` : '전체 리그 · 국제 대회'}</span><small>불러온 최근 최대 200경기 내에서 조회</small></div>
    <div className="dashboard-tabs"><span className="selected">경기 개요</span>{!selectedCompetition && <><Link to="/schedule">일정 · 결과 ↗</Link><Link to="/standings">팀 순위 ↗</Link></>}</div>
    <section className="metric-grid" aria-label="조회된 경기 통계">
      <Metric label="조회된 경기" value={ready ? filtered.length : '—'} unit="GAMES" detail="현재 필터에 해당하는 경기" />
      <Metric label="참가 팀" value={ready ? stats.teams : '—'} unit="TEAMS" detail="조회된 경기 기준" />
      <Metric label="평균 경기 시간" value={ready ? stats.average : '—'} unit="MIN : SEC" detail="경기 시간이 있는 데이터 기준" />
      <Metric label="블루 진영 승률" value={ready && stats.blue !== null ? `${stats.blue}%` : '—'} unit="BLUE SIDE" detail="승패가 기록된 경기 기준" />
    </section>
    <div className="dashboard-columns"><section className="results-panel" id={competitionId === 'worlds' ? 'worlds-game-records' : undefined}>
      <div className="panel-title"><div><span className="eyebrow">MATCH DATABASE</span><h2>경기 탐색 <span>{ready ? filtered.length : '—'}</span></h2></div><button className="text-button" onClick={refetch} disabled={loading}>↻ 새로고침</button></div>
      <div className="match-filters"><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="팀 또는 대회 검색" placeholder="팀 또는 대회 검색" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label><select aria-label="대회 필터" value={activeTournament} onChange={(e) => { setTournament(e.target.value); setPage(1); }}><option value="">전체 시즌 · 대회</option>{tournaments.map((t) => <option key={t}>{t}</option>)}</select><select aria-label="경기 정렬" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="newest">최신 경기순</option><option value="longest">경기 시간순</option></select></div>
      <div className="table-scroll"><table className="match-table"><thead><tr><th>날짜 / 대회</th><th>BLUE SIDE</th><th>결과</th><th>RED SIDE</th><th>시간 / 패치</th><th><span className="sr-only">상세</span></th></tr></thead><tbody>{ready && filtered.slice((current - 1) * 12, current * 12).map((m) => <tr key={m.game_id}>
        <td><span className="match-date">{m.datetime_utc ? new Date(m.datetime_utc).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '날짜 미정'}</span><small>{m.tournament}</small></td>
        <td><Team name={m.team1} picks={m.team1_picks} version={version} /></td><td className="result-cell"><span className={m.win_team === m.team1 ? 'win-mark' : ''}>{m.win_team ? (m.win_team === m.team1 ? 'W' : 'L') : '—'}</span><i>:</i><span className={m.win_team === m.team2 ? 'win-mark' : ''}>{m.win_team ? (m.win_team === m.team2 ? 'W' : 'L') : '—'}</span></td><td><Team name={m.team2} picks={m.team2_picks} version={version} red /></td>
        <td className="duration-cell">{formatGameLength(m.gamelength_number)}<small>{m.patch ? `Patch ${m.patch}` : '패치 미기록'}</small></td><td><Link className="match-detail-link" to={`/match/${encodeURIComponent(m.game_id)}`} aria-label={`${m.team1} 대 ${m.team2} 경기 상세`}>↗</Link></td>
      </tr>)}</tbody></table></div>
      {loading && <div className="database-state" role="status"><div className="loading-line" />경기 데이터를 불러오고 있습니다.</div>}
      {!loading && error && <div className="database-state" role="alert"><strong>경기 데이터를 불러오지 못했습니다.</strong><p>데이터 서버 연결을 확인한 후 다시 시도해 주세요.</p><button className="outline-button" onClick={refetch}>다시 불러오기</button></div>}
      {ready && !filtered.length && <div className="database-state"><strong>{categoryMatches.length ? '검색 결과가 없습니다.' : selectedCompetition ? `${selectedCompetition.label} 경기 데이터가 없습니다.` : '아직 등록된 경기가 없습니다.'}</strong><p>{categoryMatches.length ? '다른 팀 이름이나 시즌으로 검색해 보세요.' : '경기 데이터가 연결되면 결과와 통계가 이곳에 표시됩니다.'}</p>{categoryMatches.length > 0 && <button className="outline-button" onClick={() => { setSearch(''); setTournament(''); setPage(1); }}>필터 초기화</button>}</div>}
      <div className="table-footer"><span>최근 최대 200경기 기준 · {ready ? filtered.length : '—'}개 결과</span><div><button aria-label="이전 페이지" disabled={current === 1} onClick={() => setPage(current - 1)}>←</button><span>{current} / {pages}</span><button aria-label="다음 페이지" disabled={current === pages} onClick={() => setPage(current + 1)}>→</button></div></div>
    </section><aside className="insights-column"><section className="champion-panel"><div className="panel-title"><div><span className="eyebrow">DRAFT TRENDS</span><h2>밴픽 트렌드</h2></div><span className="small-tag">TOP 6</span></div><p className="panel-description">조회된 경기의 픽 + 밴 횟수 기준</p><div className="champion-list">{ready && stats.champions.map((c, i) => <div className="champion-row" key={c.name}><span className="champion-rank">{String(i + 1).padStart(2, '0')}</span><img src={getChampionImageUrl(version, c.name)} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /><div><strong>{c.name}</strong><small><span>{c.picks} PICKS</span> · {c.bans} BANS</small></div><b>{c.picks + c.bans}</b></div>)}{(!ready || !stats.champions.length) && <div className="trend-empty">{loading ? '밴픽 집계 중…' : '밴픽 데이터가 연결되면\n챔피언별 트렌드를 확인할 수 있습니다.'}</div>}</div></section><section className="explore-panel"><span className="eyebrow">EXPLORE THE LEGENDS</span><h2>숫자 너머의 경기력</h2><p>팀별 승패와 경기 상세 기록을<br />함께 살펴보세요.</p><Link to="/teams">팀 둘러보기 <span>↗</span></Link><Link to="/standings">팀 순위 확인 <span>↗</span></Link></section><div className="data-note"><span>ⓘ</span><p>통계는 현재 불러온 경기만 반영합니다. 전체 시즌 공식 순위와 다를 수 있습니다.</p></div></aside></div>
    </>}
    <footer className="dashboard-footer"><strong>dol<span>.gg</span></strong><span>Date of Legends</span><small>경기 데이터: Leaguepedia · 게임 에셋: Riot Games Data Dragon</small></footer>
  </div>;
}
function Metric({ label, value, unit, detail }) { return <div className="metric"><span>{label}</span><div><strong>{value}</strong><small>{unit}</small></div><p>{detail}</p></div>; }
function Team({ name, picks, version, red }) { return <div className="team-cell"><span className={`team-monogram ${red ? 'red' : ''}`}>{initials(name)}</span><div><strong>{name}</strong><div className="compact-picks">{split(picks).map((c) => <img key={c} src={getChampionImageUrl(version, c)} alt={c} title={c} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />)}</div></div></div>; }
