import { Server } from 'socket.io';
import { randomBytes, randomInt } from 'node:crypto';
import { PvpMatch, pvpConfig } from '../src/pvp-engine.js';
const token = () => randomBytes(24).toString('hex');
const cleanName = value => String(value || '').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,24) || 'Player';
export function attachPvp(server, { now=Date.now, roomLimit=100 }={}) {
  const io=new Server(server,{maxHttpBufferSize:8192});
  const rooms=new Map();
  function view(room,member) {
    return {code:room.code,host:member.host,self:member.playerId,config:room.config,phase:room.match?.phase||'lobby',
      members:[...room.members.values()].map(m=>({id:m.playerId,name:m.name,host:m.host,connected:!!m.socketId})),
      match:room.match?.snapshot()||null,pausedReason:room.pausedReason||''};
  }
  function broadcast(room) {for(const m of room.members.values()) if(m.socketId) io.to(m.socketId).emit('pvp:state',view(room,m));}
  function closeRoom(room,reason) {for(const m of room.members.values()) if(m.socketId){const s=io.sockets.sockets.get(m.socketId);s?.emit('pvp:closed',reason);if(s) s.data.membership=null;}rooms.delete(room.code);}
  function reconcile(room) {
    const offline=[...room.members.values()].some(m=>!m.socketId&&(m.host||m.playerId));
    room.pausedReason=offline?'Waiting for a disconnected device to return.':'';
    room.match?.setPaused(offline);
  }
  function leave(socket, explicit=false) {
    const link=socket.data.membership;if(!link)return;
    const room=rooms.get(link.code); const member=room?.members.get(link.token);socket.data.membership=null;
    if(!member||member.socketId!==socket.id)return;
    member.socketId=null;member.disconnectedAt=now();
    if(explicit&&member.host) {closeRoom(room,'The host closed this room.');return;}
    if(explicit&&room.match?.phase==='playing') {room.match.finish();room.pausedReason='A player left. The match has ended.';}
    if(explicit) room.members.delete(link.token);
    else reconcile(room);
    broadcast(room);
  }
  io.on('connection', socket=>{
    let count=0,windowAt=now();
    socket.on('pvp:request',(request,ack)=>{
      if(typeof ack!=='function')return;
      try {
        if(now()-windowAt>1000){count=0;windowAt=now();}
        if(++count>70)throw Error('Please slow down for a moment.');
        if(!request||typeof request!=='object')throw Error('Invalid request.');
        const {type}=request;
        let room=rooms.get(socket.data.membership?.code),member=room?.members.get(socket.data.membership?.token);
        if(type==='create') {
          if(room)throw Error('Leave your current room first.');
          if(rooms.size>=roomLimit)throw Error('The server is full. Please try later.');
          let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));
          const key=token();member={name:cleanName(request.name),host:true,playerId:request.participate===false?null:token(),socketId:socket.id,lastSequence:0};
          room={code,createdAt:now(),config:pvpConfig(request.config),members:new Map([[key,member]]),match:null};rooms.set(code,room);socket.data.membership={code,token:key};
          ack({ok:true,credentials:{code,token:key}});broadcast(room);return;
        }
        if(type==='join'||type==='resume') {
          if(room)throw Error('Leave your current room first.');
          room=rooms.get(String(request.code||'').trim());if(!room)throw Error('Room not found. Check the code with your host.');
          let key=request.token;
          if(type==='resume') {
            member=room.members.get(key);if(!member)throw Error('This room session has expired.');
            if(member.socketId)throw Error('This player is already connected on another page.');
          }else {
            if(room.match)throw Error('This match has already started. Join the next room.');
            if([...room.members.values()].filter(m=>m.playerId).length>=8)throw Error('This room already has eight players.');
            key=token();member={name:cleanName(request.name),host:false,playerId:token(),socketId:null,lastSequence:0};room.members.set(key,member);
          }
          member.socketId=socket.id;member.disconnectedAt=null;socket.data.membership={code:room.code,token:key};reconcile(room);
          ack({ok:true,credentials:{code:room.code,token:key},sequence:member.lastSequence});broadcast(room);return;
        }
        if(!room||!member)throw Error('Join or create a room first.');
        if(type==='leave'){leave(socket,true);ack({ok:true});return;}
        if(type==='start'||type==='rematch') {
          if(!member.host)throw Error('Only the host can start the match.');
          if(room.match?.phase==='playing')throw Error('A match is already running.');
          const players=[...room.members.values()].filter(m=>m.playerId);
          if(players.length<2)throw Error('At least two players are needed.');
          if([...room.members.values()].some(m=>!m.socketId))throw Error('Wait for everyone to reconnect.');
          room.match=new PvpMatch(players.map(m=>({id:m.playerId,name:m.name})),room.config,{now});room.pausedReason='';
        }else if(type==='finish') {if(!member.host)throw Error('Only the host can finish the match.');room.match?.tick();room.match?.finish();}
        else if(type==='action') {
          if(!member.playerId||!room.match)throw Error('You are not playing in this match.');
          if(!Number.isSafeInteger(request.sequence)||request.sequence<=member.lastSequence)throw Error('This action was already received.');
          member.lastSequence=request.sequence;
          room.match.action(member.playerId,request.action,request.orderIndex);
        }else throw Error('Unknown action.');
        ack({ok:true});broadcast(room);
      }catch(error){ack({ok:false,error:error.message});}
    });
    socket.on('disconnect',()=>leave(socket));
  });
  const timer=setInterval(()=>{
    for(const room of rooms.values()) {
      if(now()-room.createdAt>4*60*60*1000) {closeRoom(room,'This room has expired. Create a new room to play again.');continue;}
      const expired=[...room.members.entries()].filter(([,m])=>!m.socketId&&now()-m.disconnectedAt>60000);
      if(expired.some(([,m])=>m.host)){closeRoom(room,'The host disconnected. Please create a new room.');continue;}
      if(expired.length){for(const [key] of expired)room.members.delete(key);room.match?.finish();room.pausedReason='A player disconnected. The match has ended.';}
      room.match?.tick();broadcast(room);
    }
  },100);
  timer.unref();io.on('close',()=>clearInterval(timer));
  return {io,rooms,close:async()=>{clearInterval(timer);await io.close();}};
}
