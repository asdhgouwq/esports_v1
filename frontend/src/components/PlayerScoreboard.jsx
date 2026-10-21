import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import TeamIdentity from './TeamIdentity';
import EquipmentTooltip from './EquipmentTooltip';
import {championDetails} from '../lib/draft';
import {damageTeamRoster,playerDamageRanking,playerDamageSegments} from '../lib/playerDamage';
import {findRune,findSpell,findItem,findRoleQuest,findJunglePet,matchingLoadout} from '../lib/playerLoadout';
import '../styles/player-scoreboard.css';
const iconRoot='https://ddragon.leagueoflegends.com/cdn/';
const stat=value=>value===null||value===undefined||value===''?'—':Number(value).toLocaleString('ko-KR');
function Asset({src,label,kind='',empty=false,tooltipId,tooltipType}){
 const [failed,setFailed]=useState(false);
 const Tag=tooltipId?'button':'span';
 return <Tag className={`score-asset ${kind}${tooltipId?' score-tooltip-trigger':''}${!src||failed?' is-placeholder':''}`} type={tooltipId?'button':undefined} data-tooltip-id={tooltipId} data-tooltip-type={tooltipType} title={tooltipId?undefined:label} role={tooltipId?undefined:'img'} aria-label={label}>{src&&!failed?<img src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<span aria-hidden="true">{empty?'·':'?'}</span>}</Tag>;
}
function RuneSpells({row,equipment,version}){
 const rune=findRune(row.keystone||row.primaryTree,equipment.runes),secondary=findRune(row.secondaryTree,equipment.runes);
 return <><div className="score-spells">{Array.from({length:2},(_,i)=>{const value=row.spells?.[i],spell=findSpell(value,equipment.spells);return <Asset key={`${i}-${value}-${version}`} tooltipId={spell?.id} tooltipType="spell" src={spell?`${iconRoot}${version}/img/spell/${spell.image.full}`:null} label={`스펠 ${i+1}: ${equipment.localizedSpells?.[spell?.id]?.name||spell?.name||value||'미확인'}`}/>;})}</div>
 <div className="score-runes"><Asset key={rune?.icon||row.keystone||'primary'} tooltipId={rune?.id} tooltipType="rune" src={rune?.icon?`${iconRoot}img/${rune.icon}`:null} kind="score-rune-primary" label={`주룬: ${equipment.localizedRunes?.[rune?.id]?.name||rune?.name||row.keystone||row.primaryTree||'미확인'}`}/><Asset key={secondary?.icon||row.secondaryTree||'secondary'} tooltipId={secondary?.id} tooltipType="rune" src={secondary?.icon?`${iconRoot}img/${secondary.icon}`:null} kind="score-rune-secondary" label={`부룬: ${equipment.localizedRunes?.[secondary?.id]?.name||secondary?.name||row.secondaryTree||'미확인'}`}/></div></>;
}
function Items({row,role,verified,equipment,version}){
 const jungle=role==='Jungle',trinket=findItem(row.trinket,equipment.items),quest=jungle?findJunglePet(row.junglePet,equipment.items):findRoleQuest(row.roleBoundItem,equipment.items);
 const name=item=>equipment.localizedItems?.[item?.id]?.name||item?.name;
 return <div className="score-items">{Array.from({length:6},(_,i)=>{const value=row.items?.[i],item=findItem(value,equipment.items);return <Asset key={`${i}-${value}-${version}`} tooltipId={item?.id} tooltipType="item" src={item?`${iconRoot}${version}/img/item/${item.image.full}`:null} empty={verified&&!value} label={`아이템 ${i+1}: ${name(item)||value||(verified?'빈 슬롯':'미확인')}`}/>;})}
 <Asset key={`${row.trinket}-${version}`} tooltipId={trinket?.id} tooltipType="item" src={trinket?`${iconRoot}${version}/img/item/${trinket.image.full}`:null} kind="score-trinket" empty={verified&&!row.trinket} label={`장신구: ${name(trinket)||row.trinket||(verified?'빈 슬롯':'미확인')}`}/>
 <Asset key={`quest-${row.junglePet||row.roleBoundItem}-${version}`} tooltipId={quest?.id} tooltipType="item" src={quest?`${iconRoot}${version}/img/item/${quest.image.full}`:null} kind="score-role-quest" empty={!jungle&&verified&&!row.roleBoundItem} label={jungle?`정글펫: ${quest?`${quest.colorLabel} · ${name(quest)}`:'색상 미확인'}`:`포지션 퀘스트 슬롯: ${name(quest)||row.roleBoundItem||(verified?'기록 없음':'미확인')}`}/>
 </div>;
}
function Player({player,damage,maximum,data,version,champions,equipment}){
 const champion=championDetails(player.champion,champions),loadout=matchingLoadout(data,player);
 const row=loadout||{keystone:player.keystone,primaryTree:player.primary_tree,secondaryTree:player.secondary_tree,spells:[player.spell1,player.spell2],items:Array.from({length:6},(_,i)=>player[`item${i}`]),trinket:player.trinket,roleBoundItem:player.role_bound_item};
 const split=damage&&playerDamageSegments(damage),top=damage?.rank===1&&maximum>0;
 return <tr><td><div className="score-identity"><Asset key={`${champion?.id}-${version}`} src={champion?`${iconRoot}${version}/img/champion/${champion.id}.png`:null} kind="score-champion" label={champion?.name||'챔피언 미확인'}/><RuneSpells row={row} equipment={equipment} version={version}/><div className="score-player-name"><strong title={player.name}>{player.name.split(' (')[0]}</strong></div></div></td>
 <td className="score-kda"><span>{stat(player.kills)}</span><i>/</i><span>{stat(player.deaths)}</span><i>/</i><span>{stat(player.assists)}</span></td>
 <td className={`score-damage${top?' is-top-damage':''}`}><strong>{damage?stat(damage.damage):'—'}</strong><div className="score-damage-track" role="img" aria-label={damage?`${player.name} 챔피언 대상 피해량 ${stat(damage.damage)}${split?`, 15분 이전 ${stat(split.before)}, 이후 ${stat(split.after)}`:''}`:'피해량 미기록'}><span className="score-damage-fill" style={{width:`${damage&&maximum>0?damage.damage/maximum*100:0}%`}}>{split?<><span className="score-damage-before" style={{width:`${damage.damage>0?split.before/damage.damage*100:0}%`}}/><span className="score-damage-after" style={{width:`${damage.damage>0?split.after/damage.damage*100:0}%`}}/></>:<span className="score-damage-total"/>}</span></div></td>
 <td className="score-cs">{stat(player.cs)}</td><td className="score-gold">{stat(player.gold)}</td><td><Items row={row} role={player.role} verified={Boolean(loadout)} equipment={equipment} version={version}/></td></tr>;
}
export default function PlayerScoreboard({game,players,version,champions,equipment={runes:[],spells:{},items:{}}}){
 const [result,setResult]=useState(null),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();api.getPlayerLoadouts(game.game_id,controller.signal).then(data=>{if(!controller.signal.aborted)setResult({gameId:game.game_id,data});}).catch(()=>{if(!controller.signal.aborted)setResult({gameId:game.game_id,data:{state:'unavailable'}});});return()=>controller.abort();},[game.game_id,revision]);
 const data=result?.gameId===game.game_id?result.data:null;
 const roster=players.filter(player=>player.game_id===game.game_id),unknown=roster.filter(player=>![game.team1,game.team2].includes(player.team));
 const ranking=playerDamageRanking(roster,game.game_id),damageByName=new Map(ranking.players.map(player=>[player.name,player])),maximum=ranking.players[0]?.damage||0;
 const teams=[game.team1,game.team2].map(team=>({team,rows:damageTeamRoster(roster,team)}));
 if(unknown.length)teams.push({team:'팀 정보 미확인',rows:unknown});
 return <section className="player-scoreboard" aria-label="선수별 KDA·피해량·CS·골드와 룬·스펠·아이템·포지션 퀘스트"><EquipmentTooltip equipment={equipment} version={version}><div className="score-teams">{teams.map(({team,rows},index)=><div className={`score-team score-team-${index}`} key={team}><header><strong><TeamIdentity name={team} /></strong>{game.win_team===team&&<span>VICTORY</span>}</header><div className="score-table-scroll" tabIndex={0} role="region" aria-label={`${team} 선수 기록 표`}><table><caption className="sr-only">{team} · 챔피언, 선수, 주룬, 부룬, 스펠, KDA, 피해량 그래프, CS, 골드, 최종 아이템과 포지션 퀘스트</caption><colgroup><col className="score-col-player"/><col className="score-col-kda"/><col className="score-col-damage"/><col className="score-col-cs"/><col className="score-col-gold"/><col className="score-col-items"/></colgroup><thead><tr><th scope="col">챔피언 · 선수</th><th scope="col">KDA</th><th scope="col">피해량</th><th scope="col">CS</th><th scope="col">골드</th><th scope="col">아이템 · 장신구 · 퀘스트</th></tr></thead><tbody>{rows.map(player=><Player key={player.id||player.name} player={player} damage={damageByName.get(player.name)} maximum={maximum} data={data} version={version} champions={champions} equipment={equipment}/>)}{!rows.length&&<tr><td colSpan="6" className="score-empty">선수 기록이 없습니다.</td></tr>}</tbody></table></div></div>)}</div></EquipmentTooltip>
 <div className="score-note" role="status">{!data?'룬·스펠·최종 아이템·퀘스트를 확인하고 있습니다.':data.state==='ready'?'아이템은 최종 6칸, 장신구, 포지션 퀘스트 슬롯 순서입니다. 주룬은 핵심 룬, 부룬은 보조 계열을 표시합니다.':'추가 장비 기록을 불러오지 못해 확인된 기록만 표시합니다.'}{data?.state==='unavailable'&&<button onClick={()=>{setResult(null);setRevision(n=>n+1);}}>다시 불러오기</button>}<span>피해량은 챔피언 대상 총 피해량이며 양 팀에 같은 눈금을 적용합니다. 빈 칸은 ·, 미확인 항목은 ?로 표시합니다. 아이템·룬·스펠에 마우스를 올리거나 탭하면 이름과 효과를 볼 수 있습니다.</span></div>
 </section>;
}
