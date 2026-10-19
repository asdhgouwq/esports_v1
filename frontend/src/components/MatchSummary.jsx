import { useMemo, useState } from 'react';
import { buildMatchSummary, matchReviewKey } from '../lib/matchSummary';
import { formatGameLength } from '../lib/utils';
import '../styles/match-summary.css';
import AiMatchSummary from './AiMatchSummary';

export default function MatchSummary({ games, match, gameId, loading, error, onSelectSet }) {
  const summary = useMemo(() => buildMatchSummary(games), [games]);
  const ready = !loading && !error;
  const hasResults = ready && summary.confirmed > 0;
  const storageKey = matchReviewKey(match, gameId);

  return <div className="series-summary">
    <p className="match-section-description">전체 결과부터 세트별 흐름, 경기 총평까지. 오늘의 맞대결을 한곳에서 돌아보세요.</p>

    <section className="series-result" aria-labelledby="series-result-title">
      <div className="series-section-heading"><h3 id="series-result-title">시리즈 결과</h3><span>{loading ? '기록 불러오는 중' : error ? '기록 조회 실패' : hasResults ? `${summary.confirmed}세트 결과 확인` : '기록 대기'}</span></div>
      <div className="series-summary-score">
        <strong>{summary.teams[0] || '팀 정보 대기'}</strong>
        <span aria-label={hasResults ? `${summary.score[0]} 대 ${summary.score[1]}` : '스코어 미확인'}>{hasResults ? summary.score[0] : '—'}<i>:</i>{hasResults ? summary.score[1] : '—'}</span>
        <strong>{summary.teams[1] || '팀 정보 대기'}</strong>
      </div>
      <p className="series-result-note">수집된 세트 기록 기준 · 최종 결과는 전체 기록 확인 후 확정됩니다.</p>
      <dl className="series-summary-metrics">
        <div><dt>결과 확인</dt><dd>{ready ? summary.confirmed : '—'}<small> / {ready ? summary.sets.length : '—'}세트</small></dd></div>
        <div><dt>누적 경기 시간</dt><dd>{ready && summary.timed ? formatGameLength(summary.totalMinutes) : '—'}</dd><small>시간이 확인된 {ready ? summary.timed : '—'}세트 합계</small></div>
        <div><dt>평균 세트 시간</dt><dd>{ready && summary.timed ? formatGameLength(summary.averageMinutes) : '—'}</dd><small>세트별 플레이 시간 기준</small></div>
      </dl>
    </section>

    <div className="series-summary-columns">
      <div className="series-summary-main">
        <AiMatchSummary gameId={match?.game_id || gameId} available={summary.confirmed > 0} loading={loading} dataError={error} />
        <details className="series-personal-note"><summary>내 메모 <span>직접 남기는 경기 감상</span></summary><MatchReview key={storageKey} storageKey={storageKey} /></details>
      </div>

      <section className="series-flow" aria-labelledby="series-flow-title">
        <div className="series-section-heading"><h3 id="series-flow-title">세트별 경기 흐름</h3><span>{ready ? `${summary.sets.length}세트` : '—'}</span></div>
        <p className="series-flow-description">각 세트를 눌러 상세 기록을 확인하세요.</p>
        {ready && summary.sets.length > 0 ? <ol>{summary.sets.map((set) => <li key={set.gameId}>
          <button type="button" onClick={() => onSelectSet(set.index)} aria-label={`${set.index + 1}세트 상세 기록 보기`}>
            <span className="series-set-number">{String(set.index + 1).padStart(2, '0')}</span>
            <span className="series-set-result"><strong>{set.winner ? `${set.winner} 승리` : '결과 미확인'}</strong><small>{set.duration ? formatGameLength(set.duration) : '시간 미기록'}{set.winner && ` · 누적 ${set.score[0]} : ${set.score[1]}`}</small></span>
            <span className="series-set-arrow" aria-hidden="true">↗</span>
          </button>
        </li>)}</ol> : <div className="series-flow-empty"><span aria-hidden="true">—</span><strong>{loading ? '기록 불러오는 중' : error ? '기록을 불러오지 못했습니다.' : '아직 연결된 세트가 없습니다.'}</strong><p>세트 결과와 경기 시간이<br />연결되면 이곳에 표시됩니다.</p></div>}
        <p className="series-flow-note">세트 번호는 원본 기록 기준이며, 번호가 없는 기존 기록은 경기 시간순입니다.</p>
      </section>
    </div>
  </div>;
}

function readReview(storageKey) {
  try {
    return { text: window.localStorage.getItem(storageKey)?.slice(0, 4000) || '', error: '' };
  } catch {
    return { text: '', error: '이 브라우저에서는 저장된 총평을 불러올 수 없습니다.' };
  }
}

function MatchReview({ storageKey }) {
  const [initial] = useState(() => readReview(storageKey));
  const [text, setText] = useState(initial.text);
  const [savedText, setSavedText] = useState(initial.text);
  const [message, setMessage] = useState(initial.error);
  const [saveError, setSaveError] = useState(Boolean(initial.error));
  const changed = text !== savedText;

  function saveReview(event) {
    event.preventDefault();
    try {
      window.localStorage.setItem(storageKey, text);
      setSavedText(text);
      setSaveError(false);
      setMessage('메모를 이 브라우저에 저장했습니다.');
    } catch {
      setSaveError(true);
      setMessage('저장하지 못했습니다. 작성한 내용을 복사해 보관하고 브라우저 저장 설정을 확인해 주세요.');
    }
  }

  return <section className="series-review" aria-labelledby="series-review-title">
    <div className="series-section-heading"><div><span className="eyebrow">MY MATCH NOTES</span><h3 id="series-review-title">나의 경기 메모</h3></div><span className="series-review-badge">개인 메모</span></div>
    <p className="series-review-description">AI 요약과 함께 기억해 두고 싶은 장면이나 나의 감상을 남겨보세요.</p>
    <div className="series-review-topics" aria-label="총평 작성 주제"><span>전체 흐름</span><span>승부를 가른 장면</span><span>양 팀 평가</span></div>
    <form onSubmit={saveReview}>
      <label className="sr-only" htmlFor="series-review-text">개인 경기 메모 작성</label>
      <textarea id="series-review-text" value={text} maxLength={4000} rows={7} aria-describedby="series-review-help" placeholder={'오늘 경기는 어떤 경기였나요?\n인상적인 운영, 결정적인 한타, 팀별 강점과 아쉬웠던 점을 남겨보세요.'} onChange={(event) => { setText(event.target.value); setMessage(''); }} />
      <div className="series-review-actions"><span>{changed ? '저장하지 않은 변경사항' : savedText ? '저장된 메모' : '메모를 작성해 보세요.'}<small>{text.length.toLocaleString('ko-KR')} / 4,000</small></span><button type="submit" disabled={!changed}>메모 저장</button></div>
      <p className="series-review-help" id="series-review-help">현재 브라우저에만 저장됩니다. 다른 사람이나 다른 기기에는 공유되지 않습니다.</p>
      <p className={`series-review-message${saveError ? ' is-error' : ''}`} role="status">{message}</p>
    </form>
  </section>;
}
