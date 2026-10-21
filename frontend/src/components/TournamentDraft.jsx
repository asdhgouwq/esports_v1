import { useState } from 'react';
import TeamIdentity from './TeamIdentity';
import MatchObjectiveSummary from './MatchObjectiveSummary';
import {formatGameLength} from '../lib/utils';
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
  state: 'ready', gameId: SAMPLE_GAME.game_id, format: 'tournament', sidesConfirmed: true, firstPickTeam: 'RED TEAM',
  selections: {side: 'BLUE TEAM', pick: 'RED TEAM'},
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

function SequenceRow({ team, kind, side, pickOrder, version, ordered, hasRecords }) {
  const picks = kind === 'pick';
  const entries = picks ? team.picks : team.bans.map((champion) => ({ champion }));
  const breaks = picks ? pickOrder === 'first' ? [1, 3] : pickOrder === 'second' ? [2, 3, 4] : [] : [3];
  const grouped = ordered || !hasRecords;
  const teamName = team.team || '팀 정보 대기';
  return <div className="draft-sequence-row">
    <div className="draft-row-label">{picks ? 'Picks' : 'Bans'}</div>
    <ol className={`draft-sequence-list draft-${kind}-sequence${grouped ? ' is-grouped' : ''}`} data-side={side} aria-label={`${teamName} ${picks ? '픽' : '밴'}${ordered ? ' 선택 순서' : ' 목록 · 순서 미확인'}`}>
      {entries.map((entry, index) => {
        const champion = entry.champion;
        const turn = ordered && picks ? PICK_TURNS[pickOrder]?.[index] : null;
        const detail = [champion?.name || '기록 없음', turn ? `전체 ${turn}번째 픽` : ordered ? `팀의 ${index + 1}번째 밴` : '순서 미확인', entry.role, entry.player].filter(Boolean).join(' · ');
        return <li key={index} className="draft-champion-slot" title={detail} aria-label={detail}>
            {grouped && breaks.includes(index) && <span className="draft-sequence-separator" aria-hidden="true">|</span>}
            <span className="draft-champion-frame"><Portrait key={`${champion?.id || 'empty'}-${version}`} champion={champion} version={version} ban={!picks} />{picks && pickOrder === 'first' && index === 0 && champion && <span className="draft-turn is-first" aria-hidden="true">1st</span>}</span>
            <span className="draft-champion-name">{champion?.name || '미확인'}</span>
          </li>;
      })}
    </ol>
  </div>;
}

function TeamHeader({team, side, pickOrder, game}) {
  return <header className={`draft-team-header draft-${side || 'unknown'}`}><strong><TeamIdentity name={team.team}/></strong>{game?.win_team && [game.team1, game.team2].includes(game.win_team) && <b className={`draft-result${game.win_team === team.team ? ' is-winner' : ''}`}>{game.win_team === team.team ? 'WIN' : 'LOSS'}</b>}<small>{side === 'blue' ? '블루' : side === 'red' ? '레드' : '진영 미확인'} · {pickOrder === 'first' ? '선픽' : pickOrder === 'second' ? '후픽' : '순서 미확인'}</small></header>;
}

function TeamSequence({team, side, ordered, pickOrder, version, hasRecords}) {
  return <div className={`draft-team-sequence draft-${side || 'unknown'}`}>
    <strong className="draft-mobile-team-name">{team.team}</strong>
    <div className="draft-team-rows"><SequenceRow team={team} side={side} pickOrder={pickOrder} kind="ban" version={version} ordered={ordered} hasRecords={hasRecords}/><SequenceRow team={team} side={side} pickOrder={pickOrder} kind="pick" version={version} ordered={ordered} hasRecords={hasRecords}/></div>
  </div>;
}

export default function TournamentDraft({ game, draft, timeline, players = [], version, champions = {}, setNumber, preview = false, loading = false }) {
  const [example, setExample] = useState(false);
  const showExample = preview && !game && example;
  const sequence = draftSequence(showExample ? SAMPLE_GAME : game, showExample ? SAMPLE_ORDER : draft);
  const source = sequence.game;
  const sourcePlayers = showExample ? SAMPLE_PLAYERS : players;
  const teams = [1, 2].map(index => teamDraft(source, index, sourcePlayers, champions, { preserveOrder: true }));
  const teamProps = teams.map((team, index) => ({team, side:sequence.sidesConfirmed ? (index === 0 ? 'blue' : 'red') : null, pickOrder:sequence.firstPickTeam ? (sequence.firstPickTeam === team.team ? 'first' : 'second') : null}));
  const hasRecords = teams.some(team => team.picks.some(pick => pick.champion) || team.bans.some(Boolean));
  const sideChoice = sequence.sidesConfirmed && sequence.selections.side ? (source.team1 === sequence.selections.side ? '블루' : '레드') : null;
  const pickChoice = sequence.selections.pick ? (sequence.firstPickTeam === sequence.selections.pick ? '선픽' : '후픽') : null;

  return <section className="tournament-draft" aria-labelledby={`draft-title-${setNumber}`} aria-busy={loading}>
    <header className="draft-heading"><div><h3 id={`draft-title-${setNumber}`}>{setNumber}세트 · 결과와 밴픽</h3><span className="draft-patch">패치 {game?.patch || '—'}</span></div>
      <div className="draft-duration"><span>경기 시간</span><strong>{formatGameLength(game?.gamelength_number)}</strong></div>
      <div className="draft-heading-actions">
        <dl className="draft-selections" aria-label="진영과 픽 순서 선택 팀"><div><dt>진영 선택</dt><dd>{sequence.selections.side || '미확인'}{sideChoice && <b>{sideChoice}</b>}</dd></div><div><dt>픽 순서 선택</dt><dd>{sequence.selections.pick || '미확인'}{pickChoice && <b>{pickChoice}</b>}</dd></div></dl>
        {preview && !game && <button type="button" aria-pressed={showExample} onClick={() => setExample(value => !value)}>{showExample ? '기록 대기 화면 보기' : '예시 밴픽 보기'}</button>}</div>
    </header>
    {showExample && <p className="draft-example-notice" role="status">화면 예시입니다. 실제 경기·선수 기록이 아닙니다.</p>}
    <div className="draft-team-headings">{teamProps.map((props, index) => <TeamHeader key={index} {...props} game={source}/>)}</div>
    <MatchObjectiveSummary game={source} players={sourcePlayers} timeline={showExample ? null : timeline} sidesConfirmed={sequence.sidesConfirmed}/>
    <div className="draft-sequence-board">
      {teamProps.map((props, index) => <TeamSequence key={index} {...props} version={version} ordered={sequence.ordered} hasRecords={hasRecords}/>)}
    </div>
    <footer className="draft-footnote"><span className="draft-order-legend"><b>1st</b> 선픽 <i>|</i> 단계 구분</span><p>{loading ? '실제 밴픽 선택 순서를 확인하고 있어요.' : sequence.ordered ? '— 미확인' : hasRecords ? '선택 순서가 확인되지 않아 최종 목록을 표시합니다.' : '밴픽 기록이 연결되면 선택 순서가 표시됩니다.'}</p></footer>
  </section>;
}
