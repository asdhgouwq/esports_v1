const express=require('express');
const {TimelineError}=require('../services/matchTimeline');
function createMatchTimelineRouter(service){
 const router=express.Router();
 router.get('/matches/:gameId/timeline',async(req,res)=>{
  try{res.set('Cache-Control','no-store').json(await service.getTimeline(req.params.gameId));}
  catch(error){const known=error instanceof TimelineError;res.status(known?error.status:500).json({state:'unavailable',code:known?error.code:'TIMELINE_UNAVAILABLE',error:known?error.message:'타임라인을 불러오지 못했습니다.'});}
 });return router;
}
module.exports={createMatchTimelineRouter};
