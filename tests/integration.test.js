import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createExperience } from '../src/experience.js';
import { createAppServer } from '../scripts/app-server.mjs';
import { io } from 'socket.io-client';

test('shared scenery switches across solo, PvP and menus, including a late model load', async () => {
  let finishLoad, loads=0;const visible=[];
  const controller=createExperience(async()=>{loads++;await new Promise(resolve=>{finishLoad=resolve;});return {prepareShop:async()=>true,setShopVisible:value=>visible.push(value)};});
  controller.showGame();controller.showMenu();finishLoad();await controller.prepare();assert.equal(visible.at(-1),false);
  controller.showGame();assert.equal(visible.at(-1),true);controller.showMenu();assert.equal(visible.at(-1),false);assert.equal(loads,1);
});

test('standalone production package serves every mode, model, audio, ranges and multiplayer from one server', async t => {
  const {server,pvp}=createAppServer({root:new URL('../dist',import.meta.url).pathname,production:true,port:0});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;const clients=[];
  t.after(async()=>{clients.forEach(c=>c.disconnect());await pvp.close();});
  const page=await fetch(base).then(r=>r.text());assert.match(page,/data-mode="baby"/);assert.match(page,/data-mode="pro"/);assert.match(page,/data-mode="pvp"/);
  for(const file of await readdir('dist/src')) {const r=await fetch(`${base}/src/${file}`);assert.equal(r.status,200,file);}
  for(const asset of ['/assets/models/gelato-shop.glb','/assets/stylish-world.mp3','/assets/coconut-mall.mp3']) {
    const r=await fetch(base+asset,{headers:{Range:'bytes=0-31'}});assert.equal(r.status,206,asset);assert.equal((await r.arrayBuffer()).byteLength,32);
  }
  assert.equal((await fetch(base+'/package.json')).status,404);
  assert.equal((await fetch(base+'/api/network')).status,200);
  assert.equal((await fetch(base+'/socket.io/socket.io.js')).status,200);
  const connect=async()=>{const c=io(base,{transports:['websocket'],forceNew:true});clients.push(c);await new Promise((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});return c;};
  const request=(c,data)=>new Promise(resolve=>c.emit('pvp:request',data,resolve));
  const host=await connect(),guest=await connect();const created=await request(host,{type:'create',name:'Host'});
  assert.equal((await request(guest,{type:'join',name:'Guest',code:created.credentials.code})).ok,true);
  assert.equal((await request(host,{type:'start'})).ok,true);assert.equal(pvp.rooms.get(created.credentials.code).match.players.length,2);
  const pkg=JSON.parse(await readFile('dist/package.json','utf8'));assert.equal(pkg.scripts.start,'node scripts/serve.mjs --bundle');
  for(const entry of ['scripts/serve.mjs','scripts/app-server.mjs','scripts/pvp-server.mjs','src/pvp-engine.js'])assert.ok((await stat(`dist/${entry}`)).isFile());
});
