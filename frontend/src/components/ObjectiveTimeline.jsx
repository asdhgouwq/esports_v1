import {objectiveLabels, objectiveTimeline} from '../lib/objectiveTimeline';
const dragonNames={chemtech:'화학공학',hextech:'마법공학',cloud:'바람',infernal:'화염',mountain:'대지',ocean:'바다',elder:'장로'};
const dragonColors={chemtech:'#b6cf70',hextech:'#83c7e3',cloud:'#d6dfdc',infernal:'#f0915c',mountain:'#d5b48a',ocean:'#75c6b4',elder:'#e0d3f2'};
const clock=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
function ObjectiveIcon({kind,type}) {
 return <svg viewBox="0 0 40 40" aria-hidden="true" className={`objective-icon objective-${kind}`} style={kind==='dragon'?{color:dragonColors[type]||'#b6cf70'}:undefined} fill="currentColor" stroke="#101512" strokeWidth="1.7" strokeLinejoin="round">
 {kind==='dragon'&&<><path d="M9 30 4 21l9 2-2-12 8 6 8-11 1 12 8-3-3 12-9 8-11-1 6-7-9-5 1 8Z"/><path d="m21 20 6 1-4 4" fill="none"/></>}
 {kind==='void_grubs'&&<><path d="M9 31C0 23 8 10 15 16c2-11 17-8 17 2 9 7 3 18-5 16-8 5-15 3-18-3Z"/><path d="m14 23 4 3m7-4-3 4" fill="none" strokeWidth="3"/></>}
 {(kind==='baron'||kind==='herald')&&<><path d="m9 17-3-12 10 9h8L34 5l-3 12c8 14-2 21-11 19S1 30 9 17Z"/><path d="m11 23 9-5 9 5-9 7Z" fill="#101512"/><path d="M20 20v7" stroke="currentColor" strokeWidth="3"/></>}
 {kind==='first_blood'&&<><path d="m11 32-4-4L29 4l7 1-1 7Z"/><path d="m7 20 13 13-4 4L3 24Z"/><path d="m8 29-6 7 3 3 7-6Z"/></>}
 {kind==='first_tower'&&<><path d="M9 35v-6h4V16H8V6h7v5h4V6h7v5h4V6h4v10h-6v13h4v6Z"/><path d="M19 29v-8h4v8" fill="#101512"/></>}
 {(kind==='first_blood'||kind==='first_tower')&&<><circle cx="30" cy="30" r="9" fill="#e6dcc3"/><text x="30" y="33.5" textAnchor="middle" fill="#1c231d" stroke="none" fontSize="10" fontWeight="800">1st</text></>}
 </svg>;
}
export default function ObjectiveTimeline({data,onSelect}) {
 const events=objectiveTimeline(data);
 const missing=[['void_grubs','유충'],['herald','전령']].filter(([kind])=>data.coverage[kind==='void_grubs'?'voidGrubs':'herald']!==true&&!events.some(e=>e.kind===kind));
 return <div className="objective-card"><div className="timeline-event-heading"><h4>주요 이벤트 <small>{events.length}</small></h4><span className="objective-order-note">시간순 · 아이콘을 눌러 골드 확인</span></div>
 <div className="objective-scroll" tabIndex={0} role="region" aria-label="팀별 주요 이벤트 타임라인"><div className="objective-track" style={{minWidth:Math.max(500,events.length*50+62),gridTemplateColumns:`62px repeat(${Math.max(1,events.length)},minmax(40px,1fr))`}}>
 <strong className="objective-team is-blue" style={{gridRow:1,gridColumn:1}}>{data.blue.team}</strong><strong className="objective-team is-red" style={{gridRow:3,gridColumn:1}}>{data.red.team}</strong>
 <div className="objective-axis" style={{gridRow:2,gridColumn:`2 / ${Math.max(1,events.length)+2}`}} aria-hidden="true"/>
 {events.map((e,i)=>{const blue=e.team===data.blue.team;const type=e.types?.[0];const name=`${objectiveLabels[e.kind]}${type?` · ${dragonNames[type]||type}`:''}${e.count>1?` ${e.count}회`:''}`;return <button key={`${e.id}-${e.kind}`} className={`objective-marker ${blue?'is-blue':'is-red'}`} style={{gridRow:blue?1:3,gridColumn:i+2}} aria-label={`${e.team} ${name}, 약 ${clock(e.seconds)}`} title={`${e.team} · ${name} · 약 ${clock(e.seconds)}`} onClick={()=>onSelect(e.seconds)}><ObjectiveIcon kind={e.kind} type={type}/><time>{clock(e.seconds)}</time><span className="objective-stem" aria-hidden="true"/></button>;})}
 </div></div>
 {!events.length&&<p className="timeline-time-note">확인된 주요 이벤트가 없습니다.</p>}
 <div className="objective-legend">{Object.entries(objectiveLabels).map(([kind,label])=><span key={kind}><ObjectiveIcon kind={kind}/>{label}</span>)}</div>
 {missing.length>0&&<p className="objective-missing">{missing.map(([,label])=>label).join(' · ')}: 현재 원본 피드에서 기록 미제공</p>}
 </div>;
}
