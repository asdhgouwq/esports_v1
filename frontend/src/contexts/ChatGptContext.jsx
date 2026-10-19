import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, API_URL } from '../lib/api';
import '../styles/chatgpt-connection.css';

const ChatGptContext = createContext(null);

export function ChatGptProvider({ children }) {
  const [account, setAccount] = useState({ mode: 'chatgpt', loading: true, profiles: [] });
  const [models, setModels] = useState([]);
  const [message, setMessage] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
  const [revision, setRevision] = useState(0);
  const alive = useRef(true);
  const refreshVersion = useRef(0);
  const changing = useRef(false);

  const refresh = useCallback(async () => {
    if (changing.current) return;
    const version = ++refreshVersion.current;
    const current = () => alive.current && refreshVersion.current === version;
    try {
      const state = await api.chatGptStatus();
      if (!current()) return;
      setConnectionError('');
      setAccount({ ...state, loading: false });
      if (!state.signInPending) { setSigningIn(false); setLoginUrl(''); }
      if (state.connected && state.planEnabled) {
        try {
          const data = await api.chatGptModels();
          if (current()) { setModels(data.models); setAccount({ ...data, loading: false }); }
        } catch (error) { if (current()) setConnectionError(error.message); }
      } else setModels([]);
    } catch (error) {
      if (current()) { setAccount((previous) => ({ ...previous, loading: false, unavailable: true })); setConnectionError(error.message); }
    }
  }, []);

  useEffect(() => { alive.current = true; refresh(); return () => { alive.current = false; refreshVersion.current++; }; }, [refresh]);
  useEffect(() => {
    if (!signingIn) return;
    const timer = window.setInterval(refresh, 2500);
    const expiry = window.setTimeout(() => { setSigningIn(false); setLoginUrl(''); setMessage('로그인 시간이 만료되었습니다. 다시 연결해 주세요.'); }, 600000);
    return () => { window.clearInterval(timer); window.clearTimeout(expiry); };
  }, [signingIn, refresh]);

  async function signIn(newAccount = false) {
    const popup = window.open('about:blank', '_blank');
    if (popup) { popup.opener = null; popup.document.body.textContent = 'ChatGPT 로그인 준비 중…'; }
    changing.current = true; refreshVersion.current++;
    setBusy(true); setMessage(''); setConnectionError('');
    try {
      const data = await api.chatGptSignIn({ newAccount, profileId: newAccount ? undefined : account.activeId });
      const url = new URL(data.authorizationUrl);
      if (url.origin !== new URL(API_URL).origin || url.pathname !== '/auth/chatgpt/start') throw new Error('로그인 주소를 확인하지 못했습니다.');
      setLoginUrl(data.authorizationUrl);
      setSigningIn(true);
      if (popup) popup.location.replace(data.authorizationUrl);
    } catch (error) { popup?.close(); setMessage(error.message); }
    finally { changing.current = false; setBusy(false); }
  }

  async function change(action) {
    changing.current = true; refreshVersion.current++;
    setBusy(true); setMessage(''); setConnectionError('');
    try {
      const result = await action();
      setAccount({ ...result, loading: false });
      setRevision((value) => value + 1);
      if (result.message) setMessage(result.message);
      changing.current = false;
      await refresh();
    } catch (error) { setMessage(error.message); }
    finally { changing.current = false; setBusy(false); }
  }

  async function acknowledge() {
    setAccount((previous) => ({ ...previous, welcomePending: false }));
    try { await api.chatGptAcknowledge(); } catch (error) { setMessage(error.message); }
  }

  return <ChatGptContext.Provider value={{ ...account, models, message: connectionError || message, busy, signingIn, loginUrl, revision, refresh, signIn,
    selectModel: (slug) => change(() => api.chatGptSelectModel(slug)),
    selectAccount: (id) => change(() => api.chatGptSelectAccount(id)),
    disconnect: () => change(() => api.chatGptDisconnect()),
  }}>
    {children}
    {account.welcomePending && <div className="chatgpt-welcome-backdrop"><section className="chatgpt-welcome" role="dialog" aria-modal="true" aria-labelledby="chatgpt-welcome-title" aria-describedby="chatgpt-welcome-description"><span className="chatgpt-plan-tag">ChatGPT</span><h2 id="chatgpt-welcome-title">ChatGPT 구독이 연결됐어요</h2><p id="chatgpt-welcome-description">이제 dol.gg의 AI 요약에 ChatGPT 구독 한도를 사용합니다. 앱별 사용량과 허용 범위는 ChatGPT 설정에서 관리할 수 있어요.</p><a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">사용량 관리 ↗</a><button type="button" autoFocus onClick={acknowledge}>확인</button></section></div>}
  </ChatGptContext.Provider>;
}

export function useChatGpt() {
  const value = useContext(ChatGptContext);
  if (!value) throw new Error('ChatGptProvider is required');
  return value;
}
