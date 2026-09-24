import { STATIC_ONLY } from './deployment.js';
import { dissolveNavigate, isNavigating } from './navigation.js';
import { PvpMatch } from './pvp-engine.js';
import { words, timeLabel, patienceLabel } from './words.js';
import { bowlMarkup, scoopMarkup } from './bowl.js';
import { characters, characterMarkup } from './characters.js';
import { servingOpacity } from './play-layout.js';
const escape = text => String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message = {correct:'Thank you',low:'Too few scoops!',high:'Too many scoops!',timeout:'Time’s up!'};
const button=(action,label,extra='')=>`<button class="shop-button" data-pvp="${action}" ${extra}>${label}</button>`;
const order=p=>`I want ${words(p.target)} ${p.target===1?'scoop':'scoops'}, please.`;
let clientPromise;
function loadClient() {
  if(!clientPromise) clientPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='/socket.io/socket.io.js';script.onload=()=>resolve(window.io);script.onerror=()=>{clientPromise=null;script.remove();reject(Error('Multiplayer server unavailable. Start this game with npm run dev or npm start.'));};document.head.append(script);
  });
  return clientPromise;
}
export function initPvp({settings}) {
  const root=document.createElement('section');root.className='pvp-page';root.hidden=true;document.querySelector('.landing').append(root);
  const confirm=document.createElement('dialog');confirm.className='exit-dialog glass';confirm.setAttribute('aria-labelledby','pvp-exit-title');
  confirm.innerHTML=`<h2 id="pvp-exit-title">Exit game?</h2><p></p><div class="exit-actions">${button('cancel','Cancel')}${button('confirm','Exit game')}</div>`;document.body.append(confirm);
  let local=null,state=null,socket=null,credentials=null,sequence=0,layoutKey='',pending=false,active=false,error='',notice='',intent=null,roomName='',joinCode='',networkURLs=[],lastMusic='',screen='setup';
  try { if(!STATIC_ONLY) credentials=JSON.parse(sessionStorage.getItem('scoops-pvp')||'null'); }catch{}
  const save=()=>{try{if(credentials)sessionStorage.setItem('scoops-pvp',JSON.stringify(credentials));else sessionStorage.removeItem('scoops-pvp');}catch{}};
  let routeGeneration=0;
  const landscape=matchMedia('(orientation: landscape)');
  const isHost=()=>!!local||state?.host;
  const getMatch=()=>local?.snapshot()||state?.match;
  const config=()=>({range:root.querySelector('[name="range"]')?.value||'11-20',patience:Number(root.querySelector('[name="patience"]')?.value)||null,minutes:Number(root.querySelector('[name="minutes"]')?.value)||null});
  function pauseLocal(){local?.setPaused(document.hidden||!landscape.matches||confirm.open);}
  function fit(){const playing=screen==='match';root.classList.toggle('pvp-playing',playing);document.body.classList.toggle('pvp-active',playing);const compact=innerHeight<500&&landscape.matches;root.classList.toggle('pvp-compact',compact);root.style.setProperty('--pvp-scale',Math.max(.1,Math.min((innerWidth-16)/1120,(innerHeight-16)/(compact?500:680))));}
  function announce(text){error=text;const el=root.querySelector('.pvp-error');if(el)el.textContent=text;}
  async function request(payload) {
    if(!socket?.connected)throw Error('Connection lost. Waiting to reconnect…');
    const connection=socket;
    return new Promise((resolve,reject)=>connection.timeout(5000).emit('pvp:request',payload,(timeout,result)=>{
      if(connection!==socket||!active)return reject(Error('Room connection cancelled.'));
      if(timeout)return reject(Error('No reply yet. Check your connection and try again.'));
      if(!result?.ok)return reject(Error(result?.error||'Unable to complete that action.'));
      if(result.credentials){credentials=result.credentials;save();sequence=result.sequence||0;}
      resolve(result);
    }));
  }
  async function connect() {
    if(socket?.connected)return;
    if(socket)throw Error('Reconnecting to the server. Please wait.');
    const generation=routeGeneration;
    const io=await loadClient();
    if(!active||generation!==routeGeneration)throw Error('Room connection cancelled.');
    const connection=socket=io({autoConnect:false,reconnection:true});
    socket.on('connect',async()=>{
      if(connection!==socket||!active)return;
      notice='';
      if(credentials)try{await request({type:'resume',...credentials});}catch(e){credentials=null;save();state=null;screen='setup';layoutKey='';announce(e.message);render();}
      render();
    });
    socket.on('disconnect',()=>{notice='Connection lost. Reconnecting… The room waits for up to one minute.';render();});
    socket.on('connect_error',()=>{notice='Cannot reach the host. Check that both devices use the same network.';render();});
    socket.on('pvp:state',next=>{if(connection!==socket||!active)return;state=next;screen=next.match?'match':'lobby';error='';render();});
    socket.on('pvp:closed',reason=>{if(connection!==socket||!active)return;credentials=null;save();state=null;screen='setup';layoutKey='';notice=reason;render();});
    socket.connect();
    if(!socket.connected)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{connection.off('connect',ready);reject(Error('Cannot reach the multiplayer server. Check the connection.'));},6000);function ready(){clearTimeout(timer);resolve();}connection.once('connect',ready);});
  }
  function setup() {
    root.innerHTML=`<header class="pvp-heading">${button('back','‹ Back to modes')}<h1>Friends & scoops</h1></header><p class="pvp-intro">One mark for each correct order. Every player gets the same shuffled orders.</p>
    <div class="pvp-settings glass"><label>Numbers<select name="range">${[['11-20','Eleven through twenty'],['1-10','One through ten'],['1-20','One through twenty']].map(([value,label])=>`<option value="${value}" ${settings.range===value?'selected':''}>${label}</option>`).join('')}</select></label><label>Customer patience<select name="patience">${[0,10,20,30,60].map(n=>`<option value="${n}" ${n===(settings.pvpWaitSeconds||0)?'selected':''}>${patienceLabel(n)}</option>`).join('')}</select></label><label>Round time<select name="minutes">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${n===(settings.roundMinutes||0)?'selected':''}>${n?`${words(n)} ${n===1?'minute':'minutes'}`:'Off · finish all orders'}</option>`).join('')}</select></label></div>
    <div class="pvp-choices ${STATIC_ONLY?'static-layout':''}"><section class="pvp-choice glass"><span class="pvp-icon" aria-hidden="true">♡ ♡</span><h2>Same screen</h2><p>Two bowls, two players, one device.</p><label>Player one<input name="one" maxlength="24" value="Player one" autocomplete="off"></label><label>Player two<input name="two" maxlength="24" value="Player two" autocomplete="off"></label>${button('local','Play together')}</section>
    <section class="pvp-choice glass" ${STATIC_ONLY?'hidden':''}><span class="pvp-icon" aria-hidden="true">✦</span><h2>Host a room</h2><p>Invite friends with a short code.</p><label>Your name<input name="host-name" maxlength="24" value="${escape(roomName)}" placeholder="Host" autocomplete="off"></label><label>Host screen<select name="host-role"><option value="play">I will play too</option><option value="display">Leaderboard only</option></select></label>${button('create','Create room')}</section>
    <section class="pvp-choice glass" ${STATIC_ONLY?'hidden':''}><span class="pvp-icon" aria-hidden="true">↗</span><h2>Join friends</h2><p>Open the host’s web address on this device.</p><label>Your name<input name="join-name" maxlength="24" placeholder="Your nickname" autocomplete="off"></label><label>Room code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" value="${escape(joinCode)}" placeholder="Six-digit code" autocomplete="off"></label>${button('join','Join room')}</section></div>${STATIC_ONLY?'<p class="pvp-static-note">This web edition supports same-screen play. Online rooms are available in the full server edition.</p>':''}<p class="pvp-error" role="alert"></p><p class="pvp-notice" role="status">${escape(notice)}</p>`;
  }
  function lobby() {
    root.innerHTML=`<header class="pvp-heading">${button('exit','Exit game')}<h1>Room <span class="room-code">${escape(state.code)}</span></h1></header><section class="pvp-lobby glass"><h2>${state.host?'Your friends can join now':'You’re in!'}</h2><p class="join-address"></p><p>${escape(patienceLabel(state.config.patience))} patience · ${state.config.minutes?timeLabel(state.config.minutes*60000):'Finish all orders'}</p><p>One mark per correct answer. Up to eight players.</p><div class="lobby-members"></div>${state.host?button('start','Start match'): '<p>Waiting for the host to start…</p>'}${state.host?button('copy','Copy invitation'):''}<p>Keep this page open. A lost connection pauses the room for up to one minute.</p></section><p class="pvp-error" role="alert"></p><p class="pvp-notice" role="status"></p>`;
  }
  function board(p,index) {
    const prefix=`pvp-${index}-`;
    const bowl=bowlMarkup().replaceAll('bowl-',`${prefix}bowl-`).replace(`class="${prefix}bowl-art"`,'class="bowl-art"');
    return `<section class="pvp-board" data-player="${escape(p.id)}" aria-label="${escape(p.name)}’s counter"><div class="pvp-order"></div><div class="pvp-customer"><div class="pvp-patience" hidden><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18"/><circle class="pvp-ring-fill" cx="22" cy="22" r="18" pathLength="100"/></svg></div><div class="pvp-animal"></div><p class="pvp-reaction" role="status"></p></div><div class="pvp-bowl" role="img" aria-label="Ice cream in a glass bowl">${bowl}</div><div class="pvp-controls">${button('remove','−',`aria-label="Remove a scoop for ${escape(p.name)}"`)}${button('add','+',`aria-label="Add a scoop for ${escape(p.name)}"`)}${button('serve','Here you are!')}</div><p class="pvp-key-help">${local?(index===0?'A add · S remove · D serve':'J add · K remove · L serve'):'Tap to scoop, then serve.'}</p></section>`;
  }
  function matchShell(m) {
    const own=local?m.players:m.players.filter(p=>p.id===state.self);
    root.innerHTML=`<header class="pvp-heading">${button('exit','Exit game')}<h1>${local?'Scoops together':`Room ${escape(state.code)}`}</h1><p class="pvp-clock"></p>${isHost()?button('finish','Finish'):''}</header><div class="pvp-hud"></div><div class="pvp-counters ${own.length===1?'single':''} ${!own.length?'spectator':''}">${own.map((p,i)=>board(p,i)).join('')}${!own.length?'<div class="spectator-message"><span aria-hidden="true">✦</span><h2>Let’s cheer them on!</h2><p>The leaderboard updates as your friends serve.</p></div>':''}</div><p class="pvp-error" role="alert"></p><p class="pvp-notice" role="status"></p><div class="pvp-rotate" hidden><h2>Turn your device sideways</h2><p>${local?'Your game is paused.':'The live room keeps playing while you rotate.'}</p>${button('exit','Exit game')}</div>`;
  }
  function results(m) {
    const highest=Math.max(...m.players.map(p=>p.score));const winners=m.players.filter(p=>p.score===highest);
    root.innerHTML=`<header class="pvp-heading">${button('exit','Exit game')}<h1>Sweet teamwork!</h1></header><section class="pvp-results glass"><span class="pvp-icon" aria-hidden="true">✦</span><h2>${winners.length===m.players.length?'It’s a tie!':`${winners.map(p=>escape(p.name)).join(' & ')} ${winners.length===1?'wins':'win'}!`}</h2><p>Every scoop is a little more practice.</p><div class="pvp-result-list">${[...m.players].sort((a,b)=>b.score-a.score).map(p=>`<article><h3>${escape(p.name)}</h3><strong>${words(p.score)} ${p.score===1?'mark':'marks'}</strong><p>${words(p.missed)} missed · ${words(p.resolved)} of ${words(m.total)} orders</p></article>`).join('')}</div>${isHost()?button('rematch','Play again'):'<p>Waiting for the host to play again.</p>'}</section><p class="pvp-error" role="alert"></p><p class="pvp-notice" role="status"></p>`;
  }
  function render() {
    if(!active||location.hash!=='#pvp')return;
    const m=getMatch();root.classList.toggle('is-spectator',!!state?.match&&!state.self);const phase=m?.phase==='results'?'results':screen;
    const key=`${phase}:${state?.code||''}:${m?.players.map(p=>p.id).join(',')||''}`;
    if(key!==layoutKey){layoutKey=key;if(phase==='setup')setup();else if(phase==='lobby')lobby();else if(phase==='results')results(m);else matchShell(m);}
    root.querySelector('.pvp-error').textContent=error;root.querySelector('.pvp-notice').textContent=notice||state?.pausedReason||'';
    if(phase==='lobby') {
      root.querySelector('.lobby-members').innerHTML=state.members.map(p=>`<div><strong>${escape(p.name)}</strong><span>${p.host&&!p.id?'Leaderboard host':p.host?'Host & player':'Player'} · ${p.connected?'Ready':'Reconnecting'}</span></div>`).join('');
      const address=location.hostname==='localhost'||location.hostname==='127.0.0.1'?networkURLs[0]:`${location.origin}/#pvp`;
      root.querySelector('.join-address').textContent=state.host?`Friends: open ${address||'this computer’s local network address'} and enter ${state.code}.`:`Joined ${state.code}. Settings are chosen by the host.`;
      const start=root.querySelector('[data-pvp="start"]');if(start)start.disabled=pending||state.members.filter(p=>p.id&&p.connected).length<2||state.members.some(p=>!p.connected);
    }
    if(phase==='match') {
      root.querySelector('.pvp-clock').textContent=m.remainingMs===null?'Finish all orders':`${timeLabel(m.remainingMs)} left`;
      const hudPlayers=!local&&!state.self?[...m.players].sort((a,b)=>b.score-a.score):m.players;
      root.querySelector('.pvp-hud').innerHTML=hudPlayers.map((p,i)=>`<article style="--player-colour:${['#ffe0ec','#dcecff','#fff1bd','#e5dcff'][i%4]}"><strong>${escape(p.name)}</strong><span>${words(p.score)} ${p.score===1?'mark':'marks'}</span><progress max="${m.total}" value="${p.resolved}" aria-label="${escape(p.name)}’s progress"></progress><small>${words(p.resolved)} of ${words(m.total)} orders</small></article>`).join('');
      for(const [index,el] of [...root.querySelectorAll('.pvp-board')].entries()) {
        const p=m.players.find(p=>p.id===el.dataset.player);el.querySelector('.pvp-order').textContent=p.target?`“${order(p)}”`:'All orders served!';
        const art=el.querySelector('.pvp-animal');const artKey=`${p.index}:${p.reaction}:${p.effect}`;if(art.dataset.key!==artKey){art.dataset.key=artKey;art.innerHTML=characterMarkup(characters[p.index%characters.length],p.reaction,p.effect);}
        el.querySelector('.pvp-reaction').textContent=message[p.outcome]||'';
        const pile=el.querySelector('.scoop-pile');const pileKey=p.scoops.join(',');if(pile.dataset.key!==pileKey){pile.dataset.key=pileKey;pile.innerHTML=scoopMarkup(p.scoops).replaceAll('url(#bowl-',`url(#pvp-${index}-bowl-`);}
        pile.style.opacity=p.phase==='feedback'?servingOpacity(p.feedbackMs):'1';
        const ring=el.querySelector('.pvp-patience');ring.hidden=p.remainingMs===null||p.phase==='done';
        if(p.remainingMs!==null){ring.style.setProperty('--ring-colour',p.remainingMs<=10000?'#ef6269':p.remainingMs<=m.config.patience*500?'#ffd850':'#7dbe91');ring.classList.toggle('glowing',p.remainingMs<=m.config.patience*500||p.remainingMs<=10000);ring.querySelector('.pvp-ring-fill').style.strokeDasharray=`${p.remainingMs/(m.config.patience*1000)*100} 100`;}
        for(const b of el.querySelectorAll('[data-pvp]'))b.disabled=p.phase!=='serving'||m.paused||!landscape.matches||(!local&&!socket?.connected)||(b.dataset.pvp==='remove'&&!p.scoops.length)||(b.dataset.pvp==='add'&&p.scoops.length>=25);
      }
      root.querySelector('.pvp-rotate').hidden=landscape.matches; root.querySelector('.pvp-counters').inert=!landscape.matches;
    }
    screen=phase;fit();
    const music=phase==='match'||phase==='results'?'game':'menu';if(music!==lastMusic){lastMusic=music;window.dispatchEvent(new CustomEvent(music==='game'?'scoops:game-ready':'scoops:menu-ready'));}
  }
  async function perform(action,playerId) {
    if(['add','remove','serve'].includes(action)) {
      const p=getMatch()?.players.find(p=>p.id===playerId);if(!p)return;
      if(local){local.action(p.id,action,p.index);render();}
      else try{await request({type:'action',action,orderIndex:p.index,sequence:++sequence});}catch(e){announce(e.message);}
      return;
    }
    if(action==='exit'||action==='finish') {intent=action;confirm.querySelector('h2').textContent=action==='finish'?'Finish this match?':'Exit game?';confirm.querySelector('p').textContent=local?'The game is paused while you decide.':action==='finish'?'This ends the match for everyone. The live timer continues until you confirm.':state?.host?'Leaving closes the room for everyone.':'Leaving ends this match. Other players keep their recorded marks.';confirm.querySelector('[data-pvp="confirm"]').textContent=action==='finish'?'Finish match':'Exit game';confirm.showModal();pauseLocal();return;}
    if(pending)return;pending=true;
    try {
      if(action==='back'){await dissolveNavigate('modes');return;}
      if(action==='local'){
        if(credentials)throw Error('Leave your online room before starting a local match.');
        local=new PvpMatch([{id:'left',name:root.querySelector('[name="one"]').value.trim().slice(0,24)||'Player one'},{id:'right',name:root.querySelector('[name="two"]').value.trim().slice(0,24)||'Player two'}],config());screen='match';pauseLocal();render();
      }else if(action==='create'||action==='join'){
        if(STATIC_ONLY)throw Error('Online rooms need the full server edition. Choose same-screen play here.');
        const selected=config();const name=root.querySelector(`[name="${action==='create'?'host':'join'}-name"]`).value.trim();
        const code=root.querySelector('[name="code"]').value.trim();const participate=root.querySelector('[name="host-role"]').value==='play';
        if(action==='join'&&!/^\d{6}$/.test(code))throw Error('Enter the six-digit code from your host.');
        roomName=name;joinCode=code;await connect();
        await request(action==='create'?{type:'create',name:name||'Host',participate,config:selected}:{type:'join',name:name||'Player',code});
      }else if(action==='start')await request({type:'start'});
      else if(action==='rematch'){
        if(local){local=new PvpMatch(local.players.map(p=>({id:p.id,name:p.name})),local.config);screen='match';pauseLocal();layoutKey='';render();}
        else await request({type:'rematch'});
      }else if(action==='copy'){
        const url=(location.hostname==='localhost'||location.hostname==='127.0.0.1'?networkURLs[0]:`${location.origin}/#pvp`)||`${location.origin}/#pvp`;
        try{await navigator.clipboard.writeText(`Join Scoops: ${url} · Room ${state.code}`);notice='Invitation copied.';}catch{notice=`Share ${url} and room ${state.code}.`;}
      }
    }catch(e){announce(e.message);}finally{pending=false;render();}
  }
  root.addEventListener('change', event => {
    const key = {range:'range', patience:'pvpWaitSeconds', minutes:'roundMinutes'}[event.target.name];
    if (!key) return;
    settings[key] = key === 'range' ? event.target.value : Number(event.target.value) || null;
    window.dispatchEvent(new CustomEvent('scoops:settingschange', { detail: { ...settings } }));
  });
  root.addEventListener('click',event=>{const b=event.target.closest('[data-pvp]');if(b&&!b.disabled)perform(b.dataset.pvp,b.closest('[data-player]')?.dataset.player);});
  confirm.addEventListener('close',()=>{pauseLocal();render();});
  confirm.addEventListener('click',async event=>{
    const action=event.target.closest('[data-pvp]')?.dataset.pvp;if(action==='cancel'){confirm.close();return;}if(action!=='confirm')return;
    try{if(intent==='finish'){if(local)local.finish();else await request({type:'finish'});confirm.close();render();}
      else {if(state&&socket?.connected)await request({type:'leave'});credentials=null;save();socket?.disconnect();socket=null;state=null;local=null;screen='setup';confirm.close();await dissolveNavigate('modes');}}
    catch(e){confirm.close();announce(e.message);}
  });
  const keys={a:['left','add'],s:['left','remove'],d:['left','serve'],j:['right','add'],k:['right','remove'],l:['right','serve']};
  document.addEventListener('keydown',event=>{if(!active||!local||screen!=='match'||confirm.open||!landscape.matches||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,select,textarea'))return;const key=keys[event.key.toLowerCase()];if(key){event.preventDefault();perform(key[1],key[0]);}});
  async function route(){const generation=++routeGeneration;active=location.hash==='#pvp';root.hidden=!active;if(!active){lastMusic='';if(confirm.open)confirm.close();local=null;screen='setup';layoutKey='';socket?.disconnect();socket=null;state=null;fit();return;}
    render();if(STATIC_ONLY)return;try{const response=await fetch('/api/network');networkURLs=(await response.json()).urls||[];if(screen==='lobby')render();}catch{}
    if(!active||generation!==routeGeneration)return;
    if(credentials)try{notice='Rejoining your room…';await connect();}catch(e){announce(e.message);}
  }
  window.addEventListener('scoops:start',event=>{if(event.detail.mode==='pvp'){event.preventDefault();if(!isNavigating())dissolveNavigate('pvp');}});
  window.addEventListener('hashchange',route);window.addEventListener('resize',fit);
  landscape.addEventListener('change',()=>{pauseLocal();render();});document.addEventListener('visibilitychange',()=>{pauseLocal();render();});
  setInterval(()=>{if(active&&local){local.tick();render();}},100);
  route();
}
