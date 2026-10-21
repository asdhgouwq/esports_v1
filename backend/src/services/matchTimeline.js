const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { championKey } = require('./playerTeams');
const integer = value => Number.isInteger(value) && value >= 0;
class TimelineError extends Error {
  constructor(code, message) { super(message); this.code = code; this.status = 422; }
}
function normalizeTimeline(windows, { game, players, sourceEventId, sourceGameId, sourceGameNumber = 1, fetchedAt = new Date().toISOString() }) {
  const fail = message => { throw new TimelineError('TIMELINE_INVALID', message); };
  if (!Array.isArray(windows) || !windows.length || !game || !Array.isArray(players) || !Number.isInteger(sourceGameNumber) || sourceGameNumber < 1 || sourceGameNumber > 9 || windows.some(w => !w || String(w.esportsGameId) !== sourceGameId || String(w.esportsMatchId) !== sourceEventId)) fail('타임라인의 경기 식별자가 일치하지 않습니다.');
  const meta = windows[0].gameMetadata;
  const teamFor = side => {
    const roster = meta?.[`${side}TeamMetadata`]?.participantMetadata;
    if (!Array.isArray(roster) || roster.length !== 5 || roster.some(p => !p || !integer(p.participantId) || !p.championId) || new Set(roster.map(p => p.participantId)).size !== 5 || new Set(roster.map(p => championKey(p.championId))).size !== 5) fail('선수 식별 정보가 부족합니다.');
    const candidates = [game.team1, game.team2].filter(team => {
      const rows = players.filter(p => p.game_id === game.game_id && p.team === team);
      return rows.length === 5 && new Set(rows.map(p => championKey(p.champion))).size === 5 && roster.every(p => rows.some(row => championKey(row.champion) === championKey(p.championId)));
    });
    if (candidates.length !== 1) fail('기존 선수·챔피언 기록과 대조하지 못했습니다.');
    return { team: candidates[0], sourceTeamId: meta[`${side}TeamMetadata`].esportsTeamId, participants: roster.map(p => {
      const row = players.find(row => row.team === candidates[0] && row.game_id === game.game_id && championKey(row.champion) === championKey(p.championId));
      return { id:p.participantId, name:row.name, champion:row.champion, role:row.role };
    }) };
  };
  const blue = teamFor('blue'), red = teamFor('red');
  if (blue.team === red.team) fail('양 팀 식별 정보가 중복됩니다.');
  if (new Set([...blue.participants, ...red.participants].map(p => p.id)).size !== 10) fail('선수 식별 정보가 중복됩니다.');
  for (const window of windows) for (const side of ['blue', 'red']) {
    const initial = meta[`${side}TeamMetadata`], current = window.gameMetadata?.[`${side}TeamMetadata`];
    if (!current || current.esportsTeamId !== initial.esportsTeamId || !Array.isArray(current.participantMetadata) || current.participantMetadata.length !== 5 || !initial.participantMetadata.every(p => current.participantMetadata.some(row => row && row.participantId === p.participantId && championKey(row.championId) === championKey(p.championId)))) fail('수집 구간의 선수 식별 정보가 변경되었습니다.');
  }
  if (windows.some(w => !Array.isArray(w.frames) || w.frames.some(f => !f || typeof f !== 'object'))) fail('타임라인 프레임이 잘못되었습니다.');
  const all = [...new Map(windows.flatMap(w => w.frames || []).map(f => [f.rfc460Timestamp, f])).values()].sort((a,b)=>Date.parse(a.rfc460Timestamp)-Date.parse(b.rfc460Timestamp));
  if (all.length < 20 || all.some(f=>!Number.isFinite(Date.parse(f.rfc460Timestamp)))) fail('타임라인 프레임이 부족하거나 잘못되었습니다.');
  const origin = Date.parse(all[0].rfc460Timestamp);
  const end = all.filter(f=>f.gameState==='finished').at(-1);
  if (!end) fail('경기 종료까지 수집되지 않았습니다.');
  for(const frame of all)for(const [side,team] of [['blue',blue],['red',red]]){
    const value=frame[`${side}Team`];
    if(!value || !integer(value.totalGold) || !integer(value.totalKills) || !Array.isArray(value.participants) || value.participants.length!==5 || value.participants.some(p=>!p) || new Set(value.participants.map(p=>p.participantId)).size!==5 || !team.participants.every(p=>value.participants.some(row=>row.participantId===p.id)) || value.participants.some(p=>!['totalGold','kills','deaths','assists','creepScore','level'].every(k=>integer(p[k]))))fail('프레임의 선수 또는 수치가 잘못되었습니다.');
  }
  const frames = all.filter(f=>Date.parse(f.rfc460Timestamp)<=Date.parse(end.rfc460Timestamp) && f.blueTeam?.totalGold >= 2500 && f.redTeam?.totalGold >= 2500);
  if (!frames.length) fail('유효한 골드 기록이 없습니다.');
  const pauseIntervals = [];
  let pauseStart = null;
  for (const frame of all) {
    const at = Date.parse(frame.rfc460Timestamp);
    if (frame.gameState === 'paused' && pauseStart === null) pauseStart = at;
    else if (frame.gameState !== 'paused' && pauseStart !== null) {
      if (!['in_game', 'finished'].includes(frame.gameState)) fail('일시정지 종료 상태를 확인하지 못했습니다.');
      pauseIntervals.push({ startTimestamp: new Date(pauseStart).toISOString(), endTimestamp: frame.rfc460Timestamp, durationSeconds: (at - pauseStart) / 1000 });
      pauseStart = null;
    }
  }
  if (pauseStart !== null) fail('일시정지 이후 경기 재개를 확인하지 못했습니다.');
  const elapsed = frame => {
    const at = Date.parse(frame.rfc460Timestamp);
    const paused = pauseIntervals.reduce((sum, pause) => sum + Math.max(0, Math.min(at, Date.parse(pause.endTimestamp)) - Date.parse(pause.startTimestamp)), 0);
    return (at - origin - paused) / 1000;
  };
  const seconds = frame => Math.round(elapsed(frame));
  const duration = seconds(end), expectedDuration = Math.round(Number(game.gamelength_number)*60);
  // Only explicit paused/resumed intervals are excluded; the remaining feed clock must still match the game.
  if (!Number.isFinite(expectedDuration) || Math.abs(duration-expectedDuration)>15) fail('피드 경과 시간과 경기 시간이 일치하지 않습니다.');
  let largestGap = 0, largestWallGap = 0;
  for (let i=1;i<all.length;i++) {
    largestGap = Math.max(largestGap, elapsed(all[i]) - elapsed(all[i-1]));
    largestWallGap = Math.max(largestWallGap, (Date.parse(all[i].rfc460Timestamp) - Date.parse(all[i-1].rfc460Timestamp)) / 1000);
  }
  if (largestGap>12) fail('수집 구간에 누락이 있습니다.');
  const final = frames.at(-1);
  for (const [side,team] of [['blue',blue],['red',red]]) {
    const rows=players.filter(p=>p.game_id===game.game_id&&p.team===team.team);
    const totals={gold:rows.reduce((s,p)=>s+p.gold,0),kills:rows.reduce((s,p)=>s+p.kills,0)};
    if (final[`${side}Team`].totalKills !== totals.kills || final[`${side}Team`].totalGold!==totals.gold) fail('타임라인 최종 기록이 저장된 선수 기록과 일치하지 않습니다.');
    for (const participant of team.participants) {
      const row = rows.find(p => p.name === participant.name);
      const finalPlayer = final[`${side}Team`].participants.find(p => p.participantId === participant.id);
      for (const [sourceKey, storedKey] of [['totalGold', 'gold'], ['kills', 'kills'], ['deaths', 'deaths'], ['assists', 'assists']]) {
        if (integer(row[storedKey]) && finalPlayer[sourceKey] !== row[storedKey]) fail('타임라인 최종 선수 기록이 저장된 기록과 일치하지 않습니다.');
      }
    }
  }
  const events=[]; const samples=[]; let sampleBucket=-1;
  const participant = id => [...blue.participants,...red.participants].find(p=>p.id===id);
  for(let i=0;i<frames.length;i++) {
    const f=frames[i], prev=frames[i-1], at=seconds(f), bucket=Math.floor(at/10);
    if(bucket!==sampleBucket || i===frames.length-1){ samples.push({seconds:at,timestamp:f.rfc460Timestamp,blueGold:f.blueTeam.totalGold,redGold:f.redTeam.totalGold,goldDifference:f.blueTeam.totalGold-f.redTeam.totalGold,blueKills:f.blueTeam.totalKills,redKills:f.redTeam.totalKills,blueLevels:f.blueTeam.participants.map(p=>p.level),redLevels:f.redTeam.participants.map(p=>p.level)});sampleBucket=bucket; }
    if(!prev)continue;
    for(const [side,other,team] of [['blue','red',blue],['red','blue',red]]) {
      const current=f[`${side}Team`], old=prev[`${side}Team`];
      if(current.totalKills<old.totalKills || current.totalGold<old.totalGold) fail('누적 기록이 감소하는 구간이 있습니다.');
      if(current.totalKills>old.totalKills) {
        const killers=current.participants.filter(p=>p.kills>(old.participants.find(x=>x.participantId===p.participantId)?.kills??p.kills)).map(p=>({...participant(p.participantId),count:p.kills-old.participants.find(x=>x.participantId===p.participantId).kills}));
        const victims=f[`${other}Team`].participants.filter(p=>p.deaths>(prev[`${other}Team`].participants.find(x=>x.participantId===p.participantId)?.deaths??p.deaths)).map(p=>participant(p.participantId));
        // A scoreboard delta can cover multiple kills: never invent a killer-victim pairing or a location.
        events.push({id:`kill-${side}-${f.rfc460Timestamp}`,kind:'kills',team:team.team,seconds:at,fromSeconds:seconds(prev),timestamp:f.rfc460Timestamp,count:current.totalKills-old.totalKills,killers,victims,pairingConfirmed:false});
      }
      const objectives=[['dragons','dragon'],['barons','baron'],['towers','tower'],['inhibitors','inhibitor']];
      for(const [key,kind] of objectives){
        const value=key==='dragons'?current.dragons?.length:current[key], before=key==='dragons'?old.dragons?.length:old[key];
        if(integer(value)&&integer(before)&&value>before)events.push({id:`${kind}-${side}-${f.rfc460Timestamp}`,kind,team:team.team,seconds:at,fromSeconds:seconds(prev),timestamp:f.rfc460Timestamp,count:value-before,...(kind==='dragon'?{types:current.dragons.slice(before)}:{}),stealConfirmed:false});
      }
    }
  }
  const milestones=[5,10,15,20,25,30].map(minute=>{
    const sample=samples.find(s=>s.seconds>=minute*60);if(!sample)return null;
    return {minute,seconds:sample.seconds,blueGold:sample.blueGold,redGold:sample.redGold,goldDifference:sample.goldDifference};
  }).filter(Boolean);
  return {version:1,state:'ready',gameId:game.game_id,source:{name:'LoL Esports public LiveStats feed',gameId:sourceGameId,eventId:sourceEventId,url:`https://lolesports.com/vod/${sourceEventId}/${sourceGameNumber}`,fetchedAt,access:'public_no_key',stableApi:false},blue,red,coverage:{complete:true,rawFrames:all.length,largestGapSeconds:Number(largestGap.toFixed(2)),largestWallGapSeconds:Number(largestWallGap.toFixed(2)),durationSeconds:duration,wallDurationSeconds:Math.round((Date.parse(end.rfc460Timestamp)-origin)/1000),pauseDurationSeconds:Number(pauseIntervals.reduce((sum,pause)=>sum+pause.durationSeconds,0).toFixed(3)),pauseIntervals,recordedGameDurationSeconds:expectedDuration,timeBasis:pauseIntervals.length?'feed_elapsed_pause_adjusted':'feed_elapsed',timeLabel:pauseIntervals.length?'피드 경과 시간 · 확인된 일시정지 제외 · 게임 시계와 수초 차이가 있을 수 있습니다.':'피드 경과 시간 · 게임 시계와 수초 차이가 있을 수 있습니다.',positions:false,experience:false,voidGrubs:false,steals:false},samples,events,milestones};
}
const fileName = gameId => `${createHash('sha256').update(gameId).digest('hex')}.json`;
function createMatchTimelineService({ directory = path.resolve(__dirname,'../../data/timelines') }={}) {
  return { async getTimeline(gameId) {
    if(typeof gameId!=='string'||!gameId.trim()||gameId.length>300) throw new TimelineError('INVALID_GAME','경기 식별자를 확인해 주세요.');
    try {const data=JSON.parse(await fs.readFile(path.join(directory,fileName(gameId)),'utf8'));return data.gameId===gameId&&data.state==='ready'?data:{state:'unavailable',gameId};}
    catch(error){if(error.code==='ENOENT')return {state:'not_recorded',gameId};throw new TimelineError('TIMELINE_UNAVAILABLE','타임라인 파일을 불러오지 못했습니다.');}
  }};
}
module.exports={normalizeTimeline,createMatchTimelineService,fileName,TimelineError};
