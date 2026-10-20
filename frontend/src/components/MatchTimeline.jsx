import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import ObjectiveTimeline from './ObjectiveTimeline';
import {Link} from 'react-router-dom';
import '../styles/match-timeline.css';
const clock=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const amount=n=>Math.abs(n).toLocaleString('ko-KR');
export default function MatchTimeline({gameId}){
 const [result,setResult]=useState(null),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!gameId)return;const controller=new AbortController();api.getMatchTimeline(gameId,controller.signal).then(data=>{if(!controller.signal.aborted)setResult({gameId,data});}).catch(()=>{if(!controller.signal.aborted)setResult({gameId,data:{state:'unavailable'}});});return()=>controller.abort();},[gameId,revision]);
 const data=result && result.gameId===gameId?result.data:null;
 if(!gameId)return null;
 if(data?.state==='ready')return <TimelineBoard key={gameId} data={data}/>;
 return <section className="match-timeline timeline-placeholder" aria-label="경기 타임라인"><span className="eyebrow">MATCH TIMELINE</span><h3>경기 흐름</h3><p role="status">{!data?'시간대별 기록을 확인하고 있습니다.':data.state==='not_recorded'?'아직 타임라인을 연결하지 않은 세트입니다.':'타임라인을 불러오지 못했습니다.'}</p>{data?.state==='unavailable'&&<button onClick={()=>setRevision(x=>x+1)}>다시 불러오기</button>}</section>;
}
function TimelineBoard({data}){
 const [selected,setSelected]=useState(0);
 const samples=data.samples,point=samples[Math.min(selected,samples.length-1)];
 const max=Math.max(1000,...samples.map(s=>Math.abs(s.goldDifference))),scale=Math.ceil(max/1000)*1000;
 const x=s=>48+s/data.coverage.durationSeconds*904,y=v=>120-v/scale*88;
 const path=samples.map((s,i)=>`${i?'L':'M'} ${x(s.seconds).toFixed(2)} ${y(s.goldDifference).toFixed(2)}`).join(' ');
 const leader=point.goldDifference>0?data.blue.team:point.goldDifference<0?data.red.team:null;
 function selectAt(event){const box=event.currentTarget.getBoundingClientRect(),seconds=((event.clientX-box.left)/box.width*1000-48)/904*data.coverage.durationSeconds;let nearest=0;for(let i=1;i<samples.length;i++)if(Math.abs(samples[i].seconds-seconds)<Math.abs(samples[nearest].seconds-seconds))nearest=i;setSelected(nearest);}
 return <section className="match-timeline" aria-labelledby="timeline-title"><header className="timeline-heading"><div><span className="eyebrow">MATCH TIMELINE</span><h3 id="timeline-title">기록으로 보는 경기 흐름</h3><p>골드 격차와 주요 사건을 시간순으로 살펴보세요.</p></div><span className="timeline-verified">실제 경기 데이터</span></header>
 <div className="timeline-chart-card"><div className="timeline-chart-heading"><h4>팀 골드 차이</h4><div><span className="timeline-blue">● {data.blue.team}</span><span className="timeline-red">● {data.red.team}</span></div></div>
 <div className="timeline-selected" aria-live="polite"><time>약 {clock(point.seconds)}</time><strong>{leader?`${leader} +${amount(point.goldDifference)} 골드`:'양 팀 골드 동일'}</strong><span>{data.blue.team} {amount(point.blueGold)} <i>/</i> {data.red.team} {amount(point.redGold)}</span></div>
 <svg className="timeline-gold-chart" viewBox="0 0 1000 260" role="img" aria-label={`${data.blue.team} 대비 ${data.red.team} 골드 격차 그래프. 그래프를 가리키거나 선택해 상세 수치를 확인하세요. 키보드 방향키와 Home, End 키로 시점을 이동할 수 있습니다.`} tabIndex={0} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setSelected(i=>e.key==='Home'?0:e.key==='End'?samples.length-1:Math.max(0,Math.min(samples.length-1,i+(e.key==='ArrowRight'?1:-1))));}}} onPointerMove={selectAt} onClick={selectAt}>
 <defs><linearGradient id="timeline-gold-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#75b6e9"/><stop offset="50%" stopColor="#a6baae"/><stop offset="100%" stopColor="#d3a093"/></linearGradient></defs>
 {[-scale,0,scale].map(v=><g key={v}><line x1="48" x2="952" y1={y(v)} y2={y(v)} stroke={v===0?'#68746d':'#28312f'} strokeDasharray={v===0?'':'4 5'}/><text x="40" y={y(v)+4} textAnchor="end">{v===0?'0':`${v>0?'+':'−'}${Math.abs(v)/1000}k`}</text></g>)}
 {[0,10,20,30].filter(m=>m*60<=data.coverage.durationSeconds).map(m=><text key={m} x={x(m*60)} y="244" textAnchor="middle">{m}:00</text>)}
 <path d={path} fill="none" stroke="url(#timeline-gold-gradient)" strokeWidth="3"/><line x1={x(point.seconds)} x2={x(point.seconds)} y1="25" y2="215" stroke="#aaba95" strokeDasharray="4 5"/><circle cx={x(point.seconds)} cy={y(point.goldDifference)} r="5" fill="#d4e88c"/>
 </svg>
 <p className="timeline-time-note">{data.coverage.timeLabel} 골드는 약 10초 간격으로 표시합니다.</p></div>
 <ObjectiveTimeline data={data} onSelect={seconds=>{const i=samples.findIndex(s=>s.seconds>=seconds);setSelected(i<0?samples.length-1:i);}}/>
 <footer className="timeline-source">출처: LoL Esports LiveStats · 정규화·골드 격차 계산·누적 기록의 변화를 표시 · {new Date(data.source.fetchedAt).toLocaleDateString('ko-KR')} 저장 · {data.coverage.rawFrames.toLocaleString()}개 프레임 대조<br/>위치·경험치·유충·스틸 여부는 제공되지 않습니다. <a href={data.source.url} target="_blank" rel="noreferrer">원본 경기 ↗</a> · <Link to="/data-sources">데이터 출처·이용 안내 ↗</Link></footer>
 </section>;
}
