import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleStatus, scheduleTime, selectSchedules } from './worlds.js';
test('schedule times cross midnight into KST and unknown times are not invented',()=>{
  const row = { datetime_utc:'2026-10-15T18:00:00Z', has_time:true };
  assert.match(scheduleTime(row).date,/10월 16일/); assert.equal(scheduleTime(row).time,'03:00');
  assert.equal(scheduleTime({...row,has_time:false}).time,'시간 미정');
  assert.equal(scheduleTime({datetime_utc:'invalid'}).date,'일정 미정');
});
test('pending outcomes, cancellation and completed fixtures filter independently',()=>{
  const rows=[{team1:'Cloud9',winner:'Cloud9'},{team1:'TBD',winner:null},{team1:'Cloud9',winner:'Cloud9',is_nullified:true}];
  assert.equal(selectSchedules(rows,'completed').length,1);assert.equal(selectSchedules(rows,'scheduled').length,1);assert.equal(selectSchedules(rows,'all','cloud9').length,2);assert.equal(scheduleStatus(rows[2]),'cancelled');
});
