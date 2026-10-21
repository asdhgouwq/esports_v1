import {useState} from 'react';
import { useAiSummary } from '../hooks/useAiSummary';
import '../styles/ai-summary.css';
import ChatGptConnection from './ChatGptConnection';
import { useChatGpt } from '../contexts/appContexts';

export default function AiMatchSummary(props) {
  const [visited, setVisited] = useState(false);
  const title = props.scope === 'game' ? `${props.setNumber}세트 AI 요약` : 'AI 경기 총평';
  return <details className="ai-summary-disclosure" onToggle={event => {if (event.currentTarget.open) setVisited(true);}}>
    <summary><strong><span aria-hidden="true">✦</span> {title}</strong><span className="ai-summary-toggle"><span className="when-closed">펼치기</span><span className="when-open">접기</span><i aria-hidden="true">⌄</i></span></summary>
    {visited && <AiSummaryContent {...props}/>}
  </details>;
}

function AiSummaryContent({ gameId, scope = 'series', available, loading, dataError }) {
  const auth = useChatGpt();
  const result = useAiSummary(gameId, scope, available && !loading && !dataError);
  const state = loading ? 'loading_data' : dataError ? 'data_error' : !available ? 'waiting_for_data' : result.state;
  const ready = state === 'ready' && result.report;
  const description = scope === 'series'
    ? '전체 결과와 세트별 흐름을 AI가 알기 쉽게 풀어드립니다.'
    : '이 세트의 결과와 밴픽, 주요 선수 기록을 AI가 정리합니다.';
  const states = {
    loading_data: ['경기 기록을 확인하고 있어요', '기록을 불러온 뒤 AI 요약을 준비합니다.'],
    loading: ['AI가 경기를 요약하고 있어요', '결과와 주요 기록을 살펴보고 있습니다. 잠시만 기다려 주세요.'],
    waiting_for_data: ['경기 기록을 기다리고 있어요', '경기 결과가 연결되면 AI 요약이 이곳에 표시됩니다.'],
    not_configured: ['AI 요약 준비 중', 'AI 요약 서비스 연결을 준비하고 있습니다. 연결이 완료되면 경기 해설이 표시됩니다.'],
    data_error: ['경기 기록을 확인할 수 없어요', '경기 기록을 불러온 뒤 AI 요약을 확인할 수 있습니다.'],
    sign_in_required: ['ChatGPT 로그인이 필요해요', '위의 로그인 버튼으로 구독 사용을 연결해 주세요.'],
    plan_permission_required: ['구독 사용 승인이 필요해요', 'ChatGPT 로그인 화면에서 dol.gg의 구독 사용을 허용해 주세요.'],
    usage_limit: ['ChatGPT 사용 한도를 확인해 주세요', result.message || 'ChatGPT 설정에서 구독 및 앱별 사용 한도를 관리할 수 있습니다.'],
    error: ['AI 요약을 불러오지 못했어요', result.message || '잠시 후 다시 시도해 주세요.'],
  };
  const [stateTitle, stateDescription] = states[state] || states.error;

  return <section className="ai-match-summary" aria-label={scope === 'series' ? 'AI 경기 총평 내용' : 'AI 세트 요약 내용'} aria-busy={state === 'loading' || state === 'loading_data'}>
    <p className="ai-summary-description">{description}</p>
    <ChatGptConnection />
    {ready ? <>
      <div className="ai-summary-lead"><span>한줄 {scope === 'series' ? '총평' : '요약'}</span><h4>{result.report.headline}</h4><p>{result.report.overview}</p></div>
      <section className="ai-summary-points" aria-label="AI 핵심 포인트"><h4>핵심 포인트</h4><ol>{result.report.keyPoints.map((point, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{point.title}</strong><p>{point.detail}</p></div></li>)}</ol></section>
      <section className="ai-team-assessments" aria-label="AI 양 팀 평가"><h4>양 팀 평가</h4><div>{result.report.teamAssessments.map((item) => <article key={item.team}><h5>{item.team}</h5><p>{item.assessment}</p></article>)}</div></section>
      {result.source?.timelineAvailable && <p className="ai-summary-limitation">수집된 {result.source.timelineSets}개 세트의 시간대별 기록을 반영했습니다. 위치·경험치·유충·바론 스틸은 확인되지 않아 분석에서 제외합니다.</p>}
      {!result.source?.timelineAvailable && <p className="ai-summary-limitation">시간대별 경기 흐름이 연결되면 구체적인 승부처도 함께 분석합니다.</p>}
      <footer className="ai-summary-footer"><span>수집된 {result.source?.sets || 0}세트 · {result.source?.players ? '경기 및 선수 기록' : '경기 기록'} 기반{result.billing === 'chatgpt_plan' ? ' · ChatGPT 구독 사용' : ''}</span><span>{new Date(result.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 생성</span></footer>
    </> : <>
      <div className={`ai-summary-state${state.startsWith('loading') ? ' is-loading' : ''}`} role="status"><span className="ai-state-icon" aria-hidden="true">✦</span><strong>{stateTitle}</strong><p>{stateDescription}</p>{state === 'error' && <button type="button" onClick={result.retry}>AI 요약 다시 불러오기</button>}{state === 'usage_limit' && <a className="chatgpt-usage-link" href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">사용량 관리 ↗</a>}{state === 'sign_in_required' && <button type="button" onClick={() => auth.signIn()}>ChatGPT 다시 연결</button>}</div>
      <div className="ai-summary-outline" aria-label="AI 요약 구성"><div><span>01</span><strong>한줄 {scope === 'series' ? '총평' : '요약'}</strong><p>{scope === 'series' ? '전체 경기를 짧고 쉽게' : '이 세트의 결과를 쉽게'}</p></div><div><span>02</span><strong>핵심 포인트</strong><p>결과 · 밴픽 · 선수 기록</p></div><div><span>03</span><strong>양 팀 평가</strong><p>기록으로 살펴보는 경기력</p></div></div>
    </>}
    <p className="ai-summary-disclaimer">AI 요약은 수집된 기록을 바탕으로 작성되며 실제 경기 내용과 차이가 있을 수 있습니다.</p>
  </section>;
}
