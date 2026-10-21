import '../styles/match-objectives.css';
import {ObjectiveIcon} from './ObjectiveTimeline';
import {teamOverview, goldComparison, objectiveTotalsForGame} from '../lib/teamOverview';
import {CHAINCC_SOURCE, CHAINCC_LICENSE} from '../lib/dataSources';
import {dragonNames, objectiveLabels} from '../lib/objectiveTimeline';

const amount = value => value === null ? '—' : value.toLocaleString('ko-KR');
const counters = [['grubs', '유충', 'void_grubs'], ['herald', '전령', 'herald'], ['towers', '타워', 'tower'], ['barons', '바론', 'baron'], ['elders', '장로', 'elder']];

function FirstObjective({kind, totals}) {
  return totals.firsts.includes(kind) ? <span className="draft-first-objective" title={objectiveLabels[kind]} aria-label={objectiveLabels[kind]}><ObjectiveIcon kind={kind}/></span> : null;
}

function TeamKda({team, totals, index}) {
  return <div className={`draft-team-kda draft-team-kda-${index}`} aria-label={`${team} 총 KDA ${amount(totals.kills)} / ${amount(totals.deaths)} / ${amount(totals.assists)}`}>
    <span>KDA</span><strong className="draft-kills">{amount(totals.kills)}<FirstObjective kind="first_blood" totals={totals}/></strong><i>/</i><strong>{amount(totals.deaths)}</strong><i>/</i><strong>{amount(totals.assists)}</strong>
  </div>;
}

function DragonStacks({team, totals}) {
  const known = totals.elementalDragons !== null;
  const slots = Array.from({length:Math.max(4, totals.elementalTypes.length)}, (_, index) => totals.elementalTypes[index]);
  return <div className={`draft-dragon-stacks${totals.elementalDragons === 4 ? ' is-complete' : ''}`} aria-label={`${team} 원소 용 스택 ${known ? totals.elementalDragons : '미확인'}`}>
    <div className="draft-dragon-slots">{slots.map((type, index) => <span key={index} className={`draft-dragon-slot${type ? ' is-filled' : ''}`} title={type ? `${index + 1}번째 용: ${dragonNames[type]}` : known ? '미획득' : '기록 미확인'} aria-label={type ? `${index + 1}번째 ${dragonNames[type]} 용` : known ? '미획득 용 스택' : '미확인 용 스택'}>{type ? <ObjectiveIcon kind="dragon" type={type}/> : <span aria-hidden="true">{known ? '−' : '?'}</span>}</span>)}</div>
    <span className="draft-dragon-count">용 스택 <b>{amount(totals.elementalDragons)}</b><span> / 4</span></span>
  </div>;
}

export default function MatchObjectiveSummary({game, players, timeline, sidesConfirmed}) {
  const teams = [game?.team1, game?.team2];
  const totals = teams.map(team => teamOverview(game, team, players, timeline));
  const gold = goldComparison(totals[0].gold, totals[1].gold);
  const leader = gold?.difference > 0 ? 0 : 1;
  const lead = !gold ? '골드 미확인' : gold.difference === 0 ? '양 팀 동일' : `${teams[leader]} +${amount(Math.abs(gold.difference))}`;
  return <section className={`draft-match-stats${sidesConfirmed ? ' has-confirmed-sides' : ''}`} aria-label="양 팀 골드와 오브젝트 비교">
    <div className="draft-combat-row">
      <TeamKda team={teams[0] || '팀 1'} totals={totals[0]} index={0}/>
      <div className="draft-gold-comparison">
        <div className="draft-gold-labels"><strong>{amount(totals[0].gold)} <small>Gold</small></strong><span>글로벌 골드 <b>{lead}</b></span><strong><small>Gold</small> {amount(totals[1].gold)}</strong></div>
        <div className={`draft-gold-bar${gold ? '' : ' is-unknown'}`} role="img" aria-label={gold ? `${teams[0]} ${amount(totals[0].gold)} 골드, ${teams[1]} ${amount(totals[1].gold)} 골드. ${lead}` : '양 팀 골드 기록 미확인'}>{gold && <><span className="draft-gold-left" style={{width:`${gold.leftPercent}%`}}/><span className="draft-gold-right" style={{width:`${100 - gold.leftPercent}%`}}/></>}</div>
      </div>
      <TeamKda team={teams[1] || '팀 2'} totals={totals[1]} index={1}/>
    </div>
    <div className="draft-objective-teams">{totals.map((total, index) => <div key={index} className={`draft-team-objectives draft-team-objectives-${index}`} aria-label={`${teams[index] || `팀 ${index + 1}`} 오브젝트`}>
      <dl className="draft-objective-counts">{counters.map(([key, label, kind]) => <div key={key} className={total[key] === null ? 'is-unknown' : total[key] === 0 ? 'is-zero' : ''} title={`${label}: ${total[key] === null ? '기록 미확인' : total[key]}`}><dt><ObjectiveIcon kind={kind}/><span>{label}</span></dt><dd>{amount(total[key])}</dd>{key === 'towers' && <dd className="draft-first-tower"><FirstObjective kind="first_tower" totals={total}/></dd>}</div>)}</dl>
      <DragonStacks team={teams[index] || `팀 ${index + 1}`} totals={total}/>
    </div>)}</div>
    {objectiveTotalsForGame(game,timeline) && <p className="draft-objective-source">유충·전령: <a href={CHAINCC_SOURCE} target="_blank" rel="noreferrer">ChainCC</a> · <a href={CHAINCC_LICENSE} target="_blank" rel="license noreferrer">CC BY 4.0</a> · 경기 대조·집계 · 최종 수량</p>}
  </section>;
}
