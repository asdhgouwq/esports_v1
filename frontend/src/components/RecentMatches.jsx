import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupRecentMatches, matchDate } from '../lib/recentMatches';
import { COMPETITIONS, belongsToCompetition, competitionPath } from '../config/competitions';
import '../styles/recent-matches.css';

export default function RecentMatches({ matches, loading, error, refetch }) {
  const rows = useMemo(() => groupRecentMatches(matches), [matches]);
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / 15));
  const current = Math.min(page, pages);
  return <section className="results-panel recent-matches" aria-label="전체 리그 최근 경기">
    <div className="panel-title"><div><span className="eyebrow">LATEST RESULTS · ALL COMPETITIONS</span><h2>최근 진행된 경기</h2><p>모든 리그와 국제 대회의 경기 결과를 최신순으로 확인하세요.</p></div><button className="text-button" disabled={loading} onClick={refetch}>↻ 새로고침</button></div>
    <div className="recent-table-scroll"><table className="recent-table"><thead><tr><th scope="col">날짜 <span>KST</span></th><th scope="col">리그 · 대회</th><th scope="col" className="recent-team-heading">팀</th><th scope="col" className="recent-score-heading">스코어</th><th scope="col">상대 팀</th></tr></thead><tbody>
      {!loading && !error && rows.slice((current - 1) * 15, current * 15).map((row) => {
        const competition = COMPETITIONS.find((c) => belongsToCompetition(row.tournament, c.id));
        return <tr key={row.id}>
          <td className="recent-date">{matchDate(row.date)}</td>
          <td>{competition ? <Link className="recent-league" to={competitionPath(competition.id)}>{competition.label}<span>↗</span></Link> : <span className="recent-league">기타 대회</span>}<small>{row.tournament}</small></td>
          <td className="recent-team-left"><span className={row.score1 > row.score2 ? 'recent-winner' : ''}>{row.team1}</span></td>
          <td className="recent-score"><Link to={`/match/${encodeURIComponent(row.gameId)}`} aria-label={`${row.team1} ${row.score1} 대 ${row.score2} ${row.team2} 경기 상세`}><b className={row.score1 > row.score2 ? 'recent-winner' : ''}>{row.score1}</b><i>:</i><b className={row.score2 > row.score1 ? 'recent-winner' : ''}>{row.score2}</b></Link>{row.singleGame && <small>단일 세트</small>}</td>
          <td><span className={row.score2 > row.score1 ? 'recent-winner' : ''}>{row.team2}</span></td>
        </tr>;
      })}
    </tbody></table></div>
    {loading && <div className="database-state" role="status"><div className="loading-line" />최근 경기 결과를 불러오고 있습니다.</div>}
    {!loading && error && <div className="database-state" role="alert"><strong>경기 결과를 불러오지 못했습니다.</strong><p>잠시 후 다시 시도해 주세요.</p><button className="outline-button" onClick={refetch}>다시 불러오기</button></div>}
    {!loading && !error && !rows.length && <div className="database-state"><strong>아직 등록된 경기 결과가 없습니다.</strong><p>경기가 등록되면 날짜·대회·대진·스코어가 최신순으로 표시됩니다.</p></div>}
    <div className="table-footer"><span>최신순 · 스코어는 수집된 세트 기록 기준</span><div><button aria-label="이전 경기 페이지" disabled={current === 1} onClick={() => setPage(current - 1)}>←</button><span>{current} / {pages}</span><button aria-label="다음 경기 페이지" disabled={current === pages} onClick={() => setPage(current + 1)}>→</button></div></div>
  </section>;
}
