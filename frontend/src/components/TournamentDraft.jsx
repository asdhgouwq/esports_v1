import { Fragment, useState } from 'react';
import { draftSequence, PICK_TURNS, teamDraft } from '../lib/draft';
import '../styles/tournament-draft.css';

const SAMPLE_GAME = {
  game_id: 'draft-layout-example', team1: 'BLUE TEAM', team2: 'RED TEAM',
  team1_picks: 'Lee Sin,Jayce,Cassiopeia,Zeri,Yuumi', team2_picks: 'Ashe,Seraphine,Jarvan IV,Thresh,Akali',
  team1_bans: 'Nocturne,Olaf,Ezreal,Zed,Graves', team2_bans: 'Evelynn,Nautilus,Vi,Gnar,Jhin',
};
const SAMPLE_PLAYERS = [1, 2].flatMap((side) => SAMPLE_GAME[`team${side}_picks`].split(',').map((champion, index) => ({
  game_id: SAMPLE_GAME.game_id, team: SAMPLE_GAME[`team${side}`], champion,
  role: (side === 1 ? ['Jungle', 'Top', 'Mid', 'Bot', 'Support'] : ['Bot', 'Mid', 'Jungle', 'Support', 'Top'])[index], name: '예시 선수',
})));
const SAMPLE_ORDER = {
  state: 'ready', gameId: SAMPLE_GAME.game_id, format: 'tournament', firstPickSide: 'blue',
  ...Object.fromEntries([['blue', 1], ['red', 2]].map(([side, index]) => [side, {
    team: SAMPLE_GAME[`team${index}`], picks: SAMPLE_GAME[`team${index}_picks`].split(','), bans: SAMPLE_GAME[`team${index}_bans`].split(','),
  }])),
};

function Portrait({ champion, version, ban = false }) {
  const [failed, setFailed] = useState(false);
  const src = champion?.id && version ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.id}.png` : null;
  return <span className={`draft-portrait${ban ? ' draft-portrait-ban' : ''}${!champion ? ' is-empty' : ''}`}>
    {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="draft-portrait-placeholder" aria-hidden="true">{champion ? champion.name.slice(0, 1) : '—'}</span>}
  </span>;
}

function SequenceRow({ team, kind, side, version, ordered, firstPick, hasRecords }) {
  const picks = kind === 'pick';
  const entries = picks ? team.picks : team.bans.map((champion) => ({ champion }));
  const breaks = picks ? side === 'blue' ? [1, 3] : [2, 4] : [3];
  const grouped = ordered || !hasRecords;
  const teamName = team.team || (side === 'blue' ? '블루 팀' : '레드 팀');
  return <div className="draft-sequence-row">
    <div className="draft-row-label">{picks ? 'Picks' : 'Bans'}{picks && firstPick && <span className="draft-first-pick" aria-label="선픽">1st</span>}</div>
    <ol className={`draft-sequence-list draft-${kind}-sequence${grouped ? ' is-grouped' : ''}`} data-side={side} aria-label={`${teamName} ${picks ? '픽' : '밴'}${ordered ? ' 선택 순서' : ' 목록 · 순서 미확인'}`}>
      {entries.map((entry, index) => {
        const champion = entry.champion;
        const turn = ordered && picks ? PICK_TURNS[side][index] : null;
        const detail = [champion?.name || '기록 없음', turn ? `전체 ${turn}번째 픽` : ordered ? `팀의 ${index + 1}번째 밴` : '순서 미확인', entry.role, entry.player].filter(Boolean).join(' · ');
        return <Fragment key={index}>
          {grouped && breaks.includes(index) && <li className="draft-sequence-separator" role="presentation"><span aria-hidden="true">|</span></li>}
          <li className="draft-champion-slot" title={detail} aria-label={detail}>
            <span className="draft-champion-frame"><Portrait key={`${champion?.id || 'empty'}-${version}`} champion={champion} version={version} ban={!picks} />{turn && champion && <span className={`draft-turn${turn === 1 ? ' is-first' : ''}`} aria-hidden="true">{turn}</span>}</span>
            <span className="draft-champion-name">{champion?.name || '미확인'}</span>
          </li>
        </Fragment>;
      })}
    </ol>
  </div>;
}

function TeamSequence({ team, side, ordered, firstPick, version, hasRecords }) {
  return <div className={`draft-team-sequence draft-${side}`}>
    <header className="draft-team-header"><span className="draft-side-label"><i />{side === 'blue' ? 'BLUE SIDE' : 'RED SIDE'}</span><strong>{team.team || (side === 'blue' ? '블루 팀' : '레드 팀')}</strong><small>{ordered ? '선택 순서' : '순서 미확인'}</small></header>
    <div className="draft-team-rows"><SequenceRow team={team} side={side} kind="ban" version={version} ordered={ordered} firstPick={false} hasRecords={hasRecords} /><SequenceRow team={team} side={side} kind="pick" version={version} ordered={ordered} firstPick={firstPick} hasRecords={hasRecords} /></div>
  </div>;
}

export default function TournamentDraft({ game, draft, players = [], version, champions = {}, setNumber, preview = false, loading = false }) {
  const [example, setExample] = useState(false);
  const showExample = preview && !game && example;
  const sequence = draftSequence(showExample ? SAMPLE_GAME : game, showExample ? SAMPLE_ORDER : draft);
  const source = sequence.game;
  const sourcePlayers = showExample ? SAMPLE_PLAYERS : players;
  const blue = teamDraft(source, 1, sourcePlayers, champions, { preserveOrder: true });
  const red = teamDraft(source, 2, sourcePlayers, champions, { preserveOrder: true });
  const hasRecords = [...blue.picks, ...red.picks].some((pick) => pick.champion) || [...blue.bans, ...red.bans].some(Boolean);

  return <section className="tournament-draft" aria-labelledby={`draft-title-${setNumber}`} aria-busy={loading}>
    <header className="draft-heading"><div><span className="draft-eyebrow">TOURNAMENT DRAFT</span><h3 id={`draft-title-${setNumber}`}>밴픽 순서 한눈에 보기</h3><p>누가 먼저 골랐는지, 어떤 챔피언을 금지했는지.</p></div>
      <div className="draft-heading-actions"><span className="draft-set-badge">{setNumber}세트 · {showExample ? '화면 예시' : sequence.ordered ? '순서 확인됨' : hasRecords ? '순서 미확인' : '기록 대기'}</span>{preview && !game && <button type="button" aria-pressed={showExample} onClick={() => setExample((value) => !value)}>{showExample ? '기록 대기 화면 보기' : '예시 밴픽 보기'} <span aria-hidden="true">↗</span></button>}</div>
    </header>
    {showExample && <p className="draft-example-notice" role="status">화면 예시입니다. 실제 경기·선수 기록이 아닙니다.</p>}
    <div className="draft-sequence-board">
      <TeamSequence team={blue} side="blue" version={version} ordered={sequence.ordered} firstPick={sequence.firstPickSide === 'blue' && Boolean(blue.picks[0].champion)} hasRecords={hasRecords} />
      <TeamSequence team={red} side="red" version={version} ordered={sequence.ordered} firstPick={false} hasRecords={hasRecords} />
    </div>
    <footer className="draft-footnote"><span className="draft-order-legend"><b>1st</b> 선픽 <i>|</i> 단계 구분</span><p>{loading ? '실제 밴픽 선택 순서를 확인하고 있어요.' : sequence.ordered ? '숫자는 양 팀을 합친 픽 순서입니다. 각 팀은 왼쪽부터 읽어주세요.' : hasRecords ? '선택 순서가 확인되지 않아 최종 목록을 표시합니다.' : '밴픽 기록이 연결되면 선택 순서가 표시됩니다.'}</p></footer>
  </section>;
}
