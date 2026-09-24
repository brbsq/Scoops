import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as client } from 'socket.io-client';
import { PvpMatch, pvpConfig } from '../src/pvp-engine.js';
import { attachPvp } from '../scripts/pvp-server.mjs';
const players=[{id:'a',name:'Alice'},{id:'b',name:'Bob'}];
function fixture(config={}) {let time=0;const match=new PvpMatch(players,config,{now:()=>time,random:()=>.25});return {match,advance(ms){time+=ms;match.tick();}};}
function serve(match,id,count){const p=match.players.find(p=>p.id===id);for(let i=0;i<count;i++)match.action(id,'add',p.index);match.action(id,'serve',p.index);}
test('PvP gives both players the same full shuffled sequence and independent bowls',()=>{
  for(const range of ['1-10','11-20','1-20']){const {match}=fixture({range});const [lo,hi]=range.split('-').map(Number);assert.deepEqual([...match.orders].sort((a,b)=>a-b),Array.from({length:hi-lo+1},(_,i)=>lo+i));assert.equal(match.snapshot().players[0].target,match.snapshot().players[1].target);match.action('a','add',0);assert.equal(match.players[1].scoops.length,0);}
});
test('correct, empty, low, high and capped bowls score once and react immediately',()=>{
  for(const [offset,result] of [[0,'correct'],[-1,'low'],[1,'high']]){const {match,advance}=fixture();serve(match,'a',match.orders[0]+offset);assert.equal(match.players[0].outcome,result);assert.equal(match.players[0].score,result==='correct'?1:0);assert.equal(match.action('a','serve',0),false);advance(4000);assert.equal(match.players[0].index,1);assert.equal(match.action('a','serve',0),false);}
  const {match}=fixture();serve(match,'a',0);assert.equal(match.players[0].outcome,'low');for(let i=0;i<40;i++)match.action('b','add',0);assert.equal(match.players[1].scoops.length,25);match.action('b','remove',0);assert.equal(match.players[1].scoops.length,24);
});
test('PvP patience is independent, pauses with local play, and beats deadline submissions',()=>{
  for(const patience of [10,20,30,60]){const {match,advance}=fixture({patience});advance(1000);serve(match,'a',match.orders[0]);advance(4000);assert.equal(match.players[0].remainingMs,patience*1000);assert.equal(match.players[1].remainingMs,patience*1000-5000);match.setPaused(true);advance(99999);assert.equal(match.players[1].remainingMs,patience*1000-5000);match.setPaused(false);advance(patience*1000-5000);assert.equal(match.players[1].outcome,'timeout');assert.equal(match.players[1].reaction,'sad');assert.equal(match.action('b','serve',0),false);}
});
test('round limits, completing all orders, finish and configuration validation',()=>{
  const {match,advance}=fixture({minutes:1});advance(60000);assert.equal(match.phase,'results');assert.equal(match.action('a','serve',0),false);
  const f=fixture({range:'1-10'});for(let i=0;i<10;i++){for(const id of ['a','b'])serve(f.match,id,f.match.orders[i]);f.advance(4000);}assert.equal(f.match.phase,'results');assert.equal(f.match.players[0].score,10);
  assert.deepEqual(pvpConfig({range:'bad',patience:120,minutes:99}),{range:'11-20',patience:null,minutes:null});
});
async function harness(t){
  const server=http.createServer();const service=attachPvp(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const clients=[];t.after(async()=>{clients.forEach(s=>s.disconnect());await service.close();});
  async function connect(){const s=client(`http://127.0.0.1:${server.address().port}`,{transports:['websocket'],forceNew:true});clients.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
  const req=(s,data)=>new Promise((resolve,reject)=>s.timeout(2000).emit('pvp:request',data,(error,result)=>error?reject(error):resolve(result)));
  return {...service,connect,req};
}
test('online host/player flow: permissions, isolated rooms, duplicate protection, reconnect, results, rematch',async t=>{
  const h=await harness(t);const host=await h.connect(),guest=await h.connect(),outsider=await h.connect();
  const created=await h.req(host,{type:'create',name:'Host',config:{patience:30}});assert.equal(created.ok,true);
  const code=created.credentials.code;assert.match(code,/^\d{6}$/);
  assert.equal((await h.req(host,{type:'start'})).ok,false);
  const joined=await h.req(guest,{type:'join',code,name:'Friend'});assert.equal(joined.ok,true);
  assert.equal((await h.req(guest,{type:'start'})).ok,false);
  assert.equal((await h.req(host,{type:'start'})).ok,true);
  assert.equal((await h.req(outsider,{type:'join',code,name:'Late'})).ok,false);
  assert.equal((await h.req(outsider,{type:'action',action:'add',sequence:1,orderIndex:0})).ok,false);
  const room=h.rooms.get(code);const gp=room.match.players[1];
  await h.req(guest,{type:'action',action:'add',orderIndex:0,sequence:1,playerId:room.match.players[0].id});
  assert.equal(gp.scoops.length,1);assert.equal(room.match.players[0].scoops.length,0);
  assert.equal((await h.req(guest,{type:'action',action:'add',orderIndex:0,sequence:1})).ok,false);
  guest.disconnect();await new Promise(resolve=>setTimeout(resolve,30));assert.equal(room.match.paused,true);
  const returned=await h.connect();const resumed=await h.req(returned,{type:'resume',...joined.credentials});assert.equal(resumed.ok,true);assert.equal(resumed.sequence,1);assert.equal(room.match.paused,false);assert.equal(gp.scoops.length,1);
  assert.equal((await h.req(returned,{type:'finish'})).ok,false);await h.req(host,{type:'finish'});assert.equal(room.match.phase,'results');await h.req(host,{type:'rematch'});assert.equal(room.match.phase,'playing');assert.equal(room.match.players[1].scoops.length,0);
  await h.req(host,{type:'leave'});assert.equal(h.rooms.has(code),false);
});
test('leaderboard-only host supports multiple players without a bowl; invalid resume cannot take over',async t=>{
  const h=await harness(t);const host=await h.connect();const created=await h.req(host,{type:'create',participate:false});const code=created.credentials.code;
  for(let i=0;i<3;i++){const s=await h.connect();assert.equal((await h.req(s,{type:'join',code,name:`Player ${i}`})).ok,true);}
  const intruder=await h.connect();assert.equal((await h.req(intruder,{type:'resume',code,token:'wrong'})).ok,false);
  await h.req(host,{type:'start'});const room=h.rooms.get(code);assert.equal(room.match.players.length,3);assert.equal((await h.req(host,{type:'action',action:'serve',orderIndex:0,sequence:1})).ok,false);
});
test('a delayed server tick produces the same timeouts as frequent ticks before the round ends',()=>{
  const a=fixture({minutes:1,patience:10}),b=fixture({minutes:1,patience:10});
  a.advance(70000);for(let i=0;i<700;i++)b.advance(100);
  assert.deepEqual(a.match.snapshot(),b.match.snapshot());
});
