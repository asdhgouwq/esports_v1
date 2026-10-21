import {useEffect,useState} from 'react';
import {api} from '../lib/api';
const pollingDelay = {queued:5000,collecting:5000,retrying:5000,waiting_for_source:30000,waiting_for_players:30000};
export function useMatchTimeline(gameId){
 const [result,setResult]=useState(null),[revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!gameId)return;
  const controller=new AbortController();
  let timer;
  async function poll(){
   try{
    const data=await api.getMatchTimeline(gameId,controller.signal);
    if(controller.signal.aborted)return;
    setResult({gameId,revision,data});
    const delay=data.state==='retrying'&&Date.parse(data.retryAt)>Date.now()?30000:pollingDelay[data.state] || (data.objectiveTotals?.state==='pending'?60000:0);
    if(delay)timer=setTimeout(poll,delay);
   }catch{
    if(!controller.signal.aborted)setResult({gameId,revision,data:{state:'unavailable'}});
   }
  }
  queueMicrotask(()=>{if(!controller.signal.aborted)void poll();});
  return()=>{controller.abort();clearTimeout(timer);};
 },[gameId,revision]);
 const data=gameId&&result?.gameId===gameId&&result.revision===revision?result.data:null;
 return {data, collecting:Boolean(pollingDelay[data?.state]), retry:()=>setRevision(value=>value+1)};
}
