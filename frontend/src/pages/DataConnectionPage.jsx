import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import '../styles/data-connection.css';

export default function DataConnectionPage() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tournament, setTournament] = useState('LCK%');
  const refresh = useCallback(async () => {
    try { setStatus(await api.leaguepediaStatus()); }
    catch (error) { setMessage(error.message); }
  }, []);
  useEffect(() => {
    let active = true;
    api.leaguepediaStatus().then((value) => { if (active) setStatus(value); }).catch((error) => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  const running = status?.job?.state === 'running';
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, [running, refresh]);
  async function connect(event) {
    event.preventDefault(); setBusy(true); setMessage('Fandom 계정과 Cargo 권한 확인 중…');
    try {
      const connected = await api.leaguepediaConnect({ username, password });
      setStatus((previous) => ({ ...previous, ...connected }));
      setMessage('연결했습니다. 아래에서 실제 경기 한 개를 가져오세요.');
    } catch (error) { setMessage(error.message); }
    finally { setPassword(''); setBusy(false); }
  }
  async function importGame() {
    setBusy(true); setMessage('');
    try {
      const { job } = await api.leaguepediaImport(tournament);
      setStatus((previous) => ({ ...previous, job }));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  const result = status?.job?.result;
  const pending = busy || running;
  return <div className="data-connection-page">
    <header className="data-connection-title"><span className="eyebrow">LEAGUEPEDIA / DATA SOURCE</span><h1>실제 경기를 연결하세요<span>.</span></h1><p>종료된 경기의 결과, 선수 10명 통계, 밴픽 선택 순서를 한 번에 가져옵니다.</p><div className="data-connection-badges"><span>무료 API</span><span>경기 종료 후 데이터</span><span>원본 확인 후 저장</span></div></header>
    <section className="data-connect-card" style={{ marginBottom: 24 }}><div className="data-card-heading"><h2>2026 월즈 자동 수집</h2><span>일정 · 결과 · 밴픽 · 선수 기록</span></div><p>서버가 실행되는 동안 15분마다 월즈 기록을 확인합니다. 일정·결과 화면에서 갱신 상태를 확인하거나 지금 갱신할 수 있습니다.</p><Link to="/schedule">월즈 일정과 수집 현황 보기 ↗</Link></section>
    <div className="data-connection-grid">
      <section className="data-setup-guide" aria-labelledby="fandom-steps"><span className="eyebrow">FIRST TIME SETUP</span><h2 id="fandom-steps">Fandom에서 먼저 준비하기</h2><ol>
        <li><strong>무료 계정 만들기</strong><p><a href="https://auth.fandom.com/register" target="_blank" rel="noreferrer">Fandom 회원가입 ↗</a> 후 가입한 이메일로 온 인증 링크를 눌러 주세요.</p></li>
        <li><strong>Bot Password 만들기</strong><p><a href="https://lol.fandom.com/wiki/Special:BotPasswords" target="_blank" rel="noreferrer">Bot Password 설정 ↗</a>에서 Bot 이름을 <code>dolgg</code>로 만드세요.</p></li>
        <li><strong>Cargo 권한 선택</strong><p><q>Create, query and delete data through the Cargo extension</q> 항목을 선택해 발급하세요. 이 앱은 경기 조회에만 사용합니다.</p></li>
        <li><strong>계정 연결란에 발급값 입력</strong><p>표시된 Bot 로그인 이름 <code>계정이름@dolgg</code>와 Bot Password를 입력하세요. 일반 계정 비밀번호와 다릅니다.</p></li>
      </ol><a className="data-docs-link" href="https://lol.fandom.com/wiki/Help:Leaguepedia_API#Cargo" target="_blank" rel="noreferrer">Leaguepedia 공식 API 안내 ↗</a></section>
      <div className="data-connection-forms"><section className="data-connect-card" aria-labelledby="fandom-connect"><div className="data-card-heading"><h2 id="fandom-connect">01 · 계정 연결</h2><span>{status?.connected ? '연결됨' : status?.configured ? '설정 저장됨' : '연결 필요'}</span></div>
        {status?.username && <p className="data-account-name">{status.username}</p>}
        <form onSubmit={connect}><label>Bot 로그인 이름<input aria-label="Bot 로그인 이름" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="계정이름@dolgg" autoComplete="off" required maxLength={200} disabled={pending} /></label><label>Bot Password<input type="password" aria-label="Bot Password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="발급된 Bot 전용 비밀번호" autoComplete="off" required maxLength={500} disabled={pending} /></label><button type="submit" disabled={pending || !status}>{busy ? '확인 중…' : status?.configured ? '계정 다시 연결' : 'Fandom 연결'}</button></form><small>입력값은 이 Mac의 서버에만 저장됩니다. GitHub나 경기 데이터베이스에는 올라가지 않습니다.</small>
      </section><section className="data-connect-card" aria-labelledby="game-import"><div className="data-card-heading"><h2 id="game-import">02 · 실제 경기 가져오기</h2><span>1 GAME</span></div><p>선택한 대회의 최근 경기에서 종료된 1세트를 가져옵니다. 시리즈 전체 결과와는 별도입니다.</p><label>대회 이름 필터<input aria-label="가져올 대회 이름" value={tournament} onChange={(event) => setTournament(event.target.value)} disabled={pending} maxLength={160} placeholder="LCK%" /></label><small><code>%</code>는 나머지 이름을 뜻합니다. 예: <code>LCK%</code>, <code>Worlds 2024%</code></small><button type="button" onClick={importGame} disabled={pending || !status?.configured || !tournament.trim()}>{running ? '경기 기록 가져오는 중…' : '실제 경기 한 개 가져오기'}</button><small>요청 간격 15초 · 캐시 재사용 · 제한 시 대기 후 재시도<br />결과·선수·밴픽 검증과 Supabase 저장이 끝나야 완료로 표시합니다.</small>
      </section></div>
    </div>
    {message && <p className="data-connection-message" role="status">{message}</p>}
    {status?.job && <section className={`data-import-result ${status.job.state}`} aria-live="polite"><span className="eyebrow">{status.job.state === 'complete' ? 'IMPORT COMPLETE' : status.job.state === 'running' ? 'IMPORTING' : 'IMPORT NEEDS ATTENTION'}</span><h2>{status.job.message}</h2>{running && <p>원본 요청 간격을 지키며 처리합니다. 잠시 기다려 주세요.</p>}{status.job.retryAt && <p>다시 시도할 수 있는 시각: {new Date(status.job.retryAt).toLocaleTimeString('ko-KR')}</p>}{result && <><p>{result.tournament} · {new Date(result.date).toLocaleDateString('ko-KR')}<br />{result.team1} VS {result.team2} · 승리 {result.winner}<br />경기 1개 · 선수 {result.players}명 · 밴픽 순서 확인됨</p><Link to={`/match/${encodeURIComponent(result.gameId)}`}>실제 경기 기록 보기 ↗</Link></>}</section>}
  </div>;
}
