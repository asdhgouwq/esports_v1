const express=require('express');
function createPlayerLoadoutRouter(service){
 const router=express.Router();
 router.get('/matches/:gameId/loadouts',async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{res.json(await service.getLoadouts(req.params.gameId));}
  catch{res.status(503).json({state:'unavailable',message:'룬·스펠·아이템 기록을 불러오지 못했습니다.'});}
 });return router;
}
module.exports={createPlayerLoadoutRouter};
