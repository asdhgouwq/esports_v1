import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { scheduleStatus, scheduleTime, selectSchedules, stageLabel } from '../lib/worlds';
import WorldsHero from './WorldsHero';
import '../styles/worlds.css';

export default function WorldsHub({ compact = false }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const load = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function poll() {
      let delay = 30000;
      try {
        const value = await api.getWorlds(controller.signal);
        if (!controller.signal.aborted) { setData(value); setError(''); }
        if (value.running) delay = 3000;
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, delay);
      }
    }
    queueMicrotask(() => { if (!controller.signal.aborted) void poll(); });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision]);
  const sync = async () => { setBusy(true); try { await api.syncWorlds(); load(); } catch(e) { setError(e.message); } finally { setBusy(false); } };
  const rows = data?.schedules || [], completed = rows.filter(r=>scheduleStatus(r)==='completed').length;
  const visible = selectSchedules(rows, filter, search), pages = Math.max(1, Math.ceil(visible.length / 10)), current = Math.min(page, pages);
  const counts = data?.last?.counts;
  return <section className={`worlds-hub${compact ? ' is-compact' : ''}`} aria-label="2026 월즈 일정과 결과">
    {compact ? <WorldsHero /> : <header className="worlds-heading"><div><span className="eyebrow">2026 WORLD CHAMPIONSHIP</span><h1>월즈 <span>일정 · 결과</span></h1><p>플레이인부터 결승까지, 대진과 세트 기록을 함께 확인하세요.</p></div><span className="worlds-year">WORLDS <strong>26</strong></span></header>}
    <div className="worlds-metrics"><div><span>전체 대진</span><strong>{data ? rows.length : '—'}</strong></div><div><span>종료된 시리즈</span><strong>{data ? completed : '—'}</strong></div><div><span>예정 · 결과 대기</span><strong>{data ? rows.filter(r=>scheduleStatus(r)==='scheduled').length : '—'}</strong></div><div><span>연결된 세트 기록</span><strong>{counts?.games ?? '—'}<small> / 선수 기록 {counts?.players ?? '—'}건</small></strong></div></div>
    <div className="worlds-sync"><div><span className={`worlds-sync-dot ${data?.running ? 'working' : ''}`} /><strong>{data?.running ? '월즈 데이터 갱신 중' : data?.enabled ? `${data.intervalMinutes}분마다 자동 갱신` : '수동 갱신'}</strong><small>{data?.running ? data.last?.message : data?.last?.sourceFetchedAt ? `최근 확인 ${new Date(data.last.sourceFetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST` : '원본 데이터 확인 대기'}</small></div><button type="button" onClick={sync} disabled={busy || data?.running}>{busy || data?.running ? '갱신 중…' : '↻ 지금 갱신'}</button></div>
    <p className="worlds-source-note">Leaguepedia 기준 · 모든 시간은 한국 시간(KST) · 이 Mac의 서버가 실행되는 동안 자동 갱신됩니다.</p>
    {data?.last?.state === 'failed' && <p role="alert" className="worlds-error">최근 갱신 실패: {data.last.message} 저장된 기록은 계속 볼 수 있습니다.</p>}
    {data?.last?.counts?.pendingDetails > 0 && <p className="worlds-source-note">선수 통계 또는 밴픽 {data.last.counts.pendingDetails}건은 원본 등록을 기다리고 있습니다.</p>}
    {error && <p role="alert" className="worlds-error">{error} <button onClick={load}>다시 불러오기</button></p>}
    <div className="worlds-filters" id="worlds-fixtures"><div role="group" aria-label="월즈 일정 필터">{[['all','전체'],['scheduled','예정 · 결과 대기'],['completed','종료']].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>{setFilter(id);setPage(1);}}>{label}</button>)}</div><input aria-label="월즈 팀 또는 라운드 검색" placeholder="팀 · 라운드 검색" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} /></div>
    {!data && !error && <p className="worlds-empty" role="status">월즈 일정을 불러오고 있습니다.</p>}
    {data && !visible.length && <p className="worlds-empty">{rows.length ? '조건에 맞는 경기가 없습니다.' : '월즈 원본 데이터가 연결되면 표시됩니다.'}</p>}
    <div className="worlds-fixtures">{visible.slice((current-1)*10,current*10).map(row=>{
      const status = scheduleStatus(row), time = scheduleTime(row);
      const completed = status === 'completed', firstGame = row.games?.[0];
      return <article className={`worlds-fixture ${status}`} key={row.match_id}>
        <div className="worlds-fixture-meta"><span>{row.overview_page?.endsWith('/Play-In') ? 'PLAY-IN' : 'MAIN EVENT'} · {stageLabel(row.stage)}</span><time dateTime={row.datetime_utc || undefined}>{time.date} <b>{time.time}</b></time></div>
        <div className="worlds-fixture-teams"><strong className={row.winner===row.team1 ? 'winner' : ''}>{row.team1 || '진출 팀 미정'}</strong><span className="worlds-score">{completed ? `${row.team1_score} : ${row.team2_score}` : row.team1_score !== null && row.team2_score !== null && (row.team1_score > 0 || row.team2_score > 0) ? `${row.team1_score} : ${row.team2_score}` : 'VS'}</span><strong className={row.winner===row.team2 ? 'winner' : ''}>{row.team2 || '진출 팀 미정'}</strong></div>
        <div className="worlds-fixture-bottom"><span className="worlds-status">{completed ? '경기 종료' : status==='cancelled' ? '무효 경기' : '예정 · 결과 대기'}{row.best_of ? ` · BO${row.best_of}` : ''}</span>{firstGame ? <Link to={`/match/${encodeURIComponent(firstGame.game_id)}`}>세트 {row.games.length}개 · 기록 보기 ↗</Link> : <span>세트 기록 대기</span>}</div>
      </article>;
    })}</div>
    <footer className="worlds-pagination"><span>{visible.length}개 대진 · 원본에 등록된 일정 기준</span><div><button aria-label="월즈 이전 페이지" disabled={current===1} onClick={()=>setPage(current-1)}>←</button><span>{current} / {pages}</span><button aria-label="월즈 다음 페이지" disabled={current===pages} onClick={()=>setPage(current+1)}>→</button></div></footer>
  </section>;
}
