import { useChatGpt } from '../contexts/appContexts';

export default function ChatGptConnection() {
  const auth = useChatGpt();
  if (auth.mode !== 'chatgpt') return null;
  return <section className="chatgpt-connection" aria-label="ChatGPT 구독 연결">
    <div className="chatgpt-connection-heading"><strong>ChatGPT 구독으로 AI 요약 사용</strong><span>{auth.loading ? '확인 중' : auth.connected && auth.planEnabled ? '구독 연결됨' : auth.connected ? '구독 승인 필요' : '로그인 필요'}</span></div>
    <p>로그인한 ChatGPT 계정의 구독 한도로 경기 해설을 생성합니다.</p>
    {auth.profiles?.length > 0 && <label className="chatgpt-account-picker">연결 계정<select aria-label="ChatGPT 연결 계정" value={auth.activeId || ''} disabled={auth.busy || auth.signingIn} onChange={(event) => auth.selectAccount(event.target.value)}>{auth.profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.label}{profile.connected ? '' : ' · 연결 해제됨'}</option>)}</select></label>}
    <div className="chatgpt-connection-actions">
      {(!auth.connected || !auth.planEnabled) && <button type="button" className="chatgpt-sign-in" disabled={auth.loading || auth.busy || auth.signingIn} onClick={() => auth.signIn()}>{auth.signingIn ? '브라우저에서 로그인 완료해 주세요' : 'Continue with ChatGPT'}</button>}
      {auth.connected && <button type="button" className="chatgpt-text-button" disabled={auth.busy || auth.signingIn} onClick={auth.disconnect}>연결 해제</button>}
      {auth.profiles?.length > 0 && <button type="button" className="chatgpt-text-button" disabled={auth.busy || auth.signingIn} onClick={() => auth.signIn(true)}>다른 계정 추가</button>}
      <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">사용량 관리 ↗</a>
      {auth.unavailable && <button type="button" className="chatgpt-text-button" onClick={auth.refresh}>연결 다시 확인</button>}
    </div>
    {auth.signingIn && auth.loginUrl && <p className="chatgpt-connection-message">로그인 창이 보이지 않으면 <a href={auth.loginUrl} target="_blank" rel="noreferrer">로그인 창 열기</a>를 눌러 주세요.</p>}
    {auth.message && <p className="chatgpt-connection-message" role="status">{auth.message}</p>}
    <small>이 기기의 개인용 연결 · ChatGPT 구독 한도와 앱별 사용 제한이 적용됩니다.</small>
  </section>;
}
