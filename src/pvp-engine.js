export const PVP_FLAVOURS = ['strawberry', 'vanilla', 'mint', 'blueberry', 'mango'];
export function pvpConfig(input = {}) {
  return { range: ['1-10','11-20','1-20'].includes(input.range) ? input.range : '11-20',
    patience: [10,20,30,60].includes(Number(input.patience)) ? Number(input.patience) : null,
    minutes: [1,2,3,4,5].includes(Number(input.minutes)) ? Number(input.minutes) : null };
}
export class PvpMatch {
  constructor(players, config, { now = () => Date.now(), random = Math.random } = {}) {
    this.now = now; this.random = random; this.config = pvpConfig(config); this.phase = 'playing'; this.paused = false;
    const [low, high] = this.config.range.split('-').map(Number);
    this.orders = Array.from({length: high-low+1}, (_, i) => low+i);
    for (let i=this.orders.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [this.orders[i],this.orders[j]]=[this.orders[j],this.orders[i]]; }
    this.remainingMs = this.config.minutes ? this.config.minutes*60000 : null;
    this.players = players.map(p => ({ id:p.id, name:p.name, score:0, missed:0, resolved:0, index:0, scoops:[], phase:'serving', remainingMs:this.config.patience ? this.config.patience*1000:null, feedbackMs:0, outcome:null, reaction:'neutral', effect:null }));
    this.last = now();
  }
  tick() {
    const current=this.now(); const delta=Math.max(0,current-this.last); this.last=current;
    if(this.phase!=='playing'||this.paused) return;
    const elapsedRound=this.remainingMs===null?delta:Math.min(delta,this.remainingMs);
    if(this.remainingMs!==null) this.remainingMs=Math.max(0,this.remainingMs-delta);
    for(const p of this.players) {
      let elapsed=elapsedRound;
      // Process delayed ticks through feedback and subsequent deadlines without granting extra time.
      while(elapsed>0 && p.phase!=='done') {
        if(p.phase==='feedback') {
          const step=Math.min(elapsed,p.feedbackMs); p.feedbackMs-=step; elapsed-=step;
          if(!p.feedbackMs) { p.index++; p.scoops=[]; p.outcome=null; p.reaction='neutral';p.effect=null; p.phase=p.index>=this.orders.length?'done':'serving';p.remainingMs=this.config.patience?this.config.patience*1000:null; }
        } else if(p.remainingMs!==null) {
          const step=Math.min(elapsed,p.remainingMs);p.remainingMs-=step;elapsed-=step;
          if(!p.remainingMs) this.resolve(p,'timeout');
        } else break;
      }
    }
    if(this.remainingMs===0||this.players.every(p=>p.phase==='done')) this.finish();
  }
  resolve(p,outcome) {
    p.phase='feedback';p.feedbackMs=4000;p.outcome=outcome;p.resolved++;
    if(outcome==='correct') {p.score++;p.reaction='happy';p.effect=this.random()<.5?'hearts':'sparkles';}
    else {p.missed++;p.reaction=outcome==='timeout'?'sad':this.random()<.5?'sad':'angry';p.effect='frown';}
  }
  action(id, action, orderIndex) {
    this.tick(); const p=this.players.find(p=>p.id===id);
    if(this.phase!=='playing'||this.paused||!p||p.phase!=='serving'||p.index!==orderIndex) return false;
    if(action==='add'&&p.scoops.length<25) p.scoops.push(PVP_FLAVOURS[p.scoops.length%5]);
    else if(action==='remove'&&p.scoops.length) p.scoops.pop();
    else if(action==='serve') this.resolve(p,p.scoops.length===this.orders[p.index]?'correct':p.scoops.length<this.orders[p.index]?'low':'high');
    else return false;
    return true;
  }
  setPaused(paused) {this.tick();this.paused=paused;this.last=this.now();}
  finish() {this.phase='results';}
  snapshot() {
    return {phase:this.phase,paused:this.paused,config:this.config,remainingMs:this.remainingMs,total:this.orders.length,
      players:this.players.map(p=>({...p,scoops:[...p.scoops],target:this.orders[p.index]??null}))};
  }
}
