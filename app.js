import {
  chooseGrid,
  createGameState,
  makePath,
  makeTrayOrder,
  neighbors,
  sampleArtwork,
  serializeGame,
} from './js/puzzle.js';

import { createDom } from './js/dom.js';
import { createI18n } from './js/i18n.js';
import { createState } from './js/state.js';
import { createStorage } from './js/storage.js';

(() => {
  'use strict';
  const dom = createDom();
  const storage = createStorage();
  const state = createState({ settings: storage.loadSettings(), stats: storage.loadStats() });
  const { $, $$, els, ctx, hctx } = dom;
  let soundOn = state.soundOn;
  let gridOn = state.gridOn;
  let language = state.language;
  let selectedData = null, image = null, game = null, raf = 0, timerInterval = null, saveTimer = null;
  let camera = { x: 0, y: 0, scale: 1 }, pointers = new Map(), gesture = null, drag = null, currentView = 'home';
  const stats = state.stats;
  const runtime = { ...dom, state, storage };
  const languageService = createI18n(runtime);
  const tr = languageService.tr;
  const applyLanguage = next => {
    languageService.applyLanguage(next);
    language = state.language;
    updateHUD();
    buildDock();
  };

  function drawHero(){
    const c=els.hero,w=c.width,h=c.height,g=hctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#d1a37f');g.addColorStop(.45,'#7b9989');g.addColorStop(1,'#29474b');hctx.fillStyle=g;hctx.fillRect(0,0,w,h);
    hctx.fillStyle='#ecddc3';hctx.beginPath();hctx.arc(w*.22,h*.23,83,0,7);hctx.fill();hctx.fillStyle='#223c3e';hctx.beginPath();hctx.moveTo(0,h*.76);hctx.quadraticCurveTo(w*.22,h*.36,w*.47,h*.78);hctx.quadraticCurveTo(w*.72,h*.28,w,h*.72);hctx.lineTo(w,h);hctx.lineTo(0,h);hctx.fill();
    hctx.strokeStyle='rgba(255,255,255,.28)';hctx.lineWidth=2;for(let i=1;i<5;i++){hctx.beginPath();hctx.moveTo(i*w/5,0);hctx.lineTo(i*w/5,h);hctx.stroke()}for(let i=1;i<4;i++){hctx.beginPath();hctx.moveTo(0,i*h/4);hctx.lineTo(w,i*h/4);hctx.stroke()}
  }

  function showView(name){currentView=name;if(name!=='game'){if(trayState.mode==='carry')abortCarry();else if(trayState.mode==='peel')abortPeel()}els.home.classList.toggle('active',name==='home');els.game.classList.toggle('active',name==='game');$$('.game-only').forEach(e=>e.classList.toggle('hidden',name!=='game'));if(name==='game'){resize();startClock()}else stopClock()}
  function openModal(el,on=true){el.classList.toggle('open',on);el.setAttribute('aria-hidden',String(!on))}
  function toast(msg){const t=els.toast;t.textContent=tr(msg);t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),2200)}
  function formatTime(s){s=Math.max(0,Math.floor(s));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
  function updateHome(){ $('#statSolved').textContent=stats.solved||0; $('#statTime').textContent=stats.seconds<3600?`${Math.round(stats.seconds/60)}m`:`${(stats.seconds/3600).toFixed(1)}h`; storage.getCurrent().then(v=>$('#continueBtn').classList.toggle('hidden',!v)); }
  function updateSettings(){ state.soundOn=soundOn;state.gridOn=gridOn;state.language=language;$('#menuSound').checked=soundOn;$('#menuGrid').checked=gridOn;$('#languageSelect').value=language;$('#soundBtn').classList.toggle('muted',!soundOn);storage.saveSettings({sound:soundOn,grid:gridOn,language});if(game){game.showGrid=gridOn;requestRender()}}

  function loadSelected(data,aspect){selectedData=data;els.imagePreview.src=data;els.drop.classList.add('has-image');els.start.disabled=false;if(aspect)updateDifficultyCounts(aspect);else loadImage(data).then(im=>updateDifficultyCounts(im.width/im.height))}
  function readFile(file){if(!file)return;if(file.size>25*1024*1024){toast('That image is larger than 25 MB');return}const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const max=1800,scale=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);loadSelected(c.toDataURL('image/jpeg',.9),im.width/im.height)};im.src=r.result};r.readAsDataURL(file)}
  function loadImage(data){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=data})}
  function updateDifficultyCounts(aspect){$$('#difficultyOptions label').forEach(label=>{const input=label.querySelector('input'),target=+input.value,[cols,rows]=chooseGrid(target,aspect),actual=cols*rows;label.querySelector('b').textContent=actual;label.title=`${cols} × ${rows} (${actual} ${tr('pieces')})`})}
  async function createGame(data,target){
    image=await loadImage(data);
    game=createGameState({
      imageData:data,
      imageWidth:image.width,
      imageHeight:image.height,
      target,
      showGrid:gridOn,
    });
    showView('game');buildDock();fitBoard();updateHUD();queueSave();toast('Choose a piece from the tray to begin');
  }
  async function restoreGame(saved){image=await loadImage(saved.imageData);game=saved;game.showGrid=gridOn;if(!game.trayOrder)game.trayOrder=makeTrayOrder(game.pieces);game.pieces.forEach(p=>{p.path=makePath(p);if(p.inTray===undefined)p.inTray=false});game.lastTick=Date.now();showView('game');buildDock();fitBoard();updateHUD();toast('Welcome back');}
  function serialGame(){return serializeGame(game)}

  function groupMembers(gid){return game.pieces.filter(p=>p.gid===gid)}
  function connectedCount(){const groups=new Set(game.pieces.map(p=>p.gid));return game.count-groups.size}
  function buildDock(){
    if(!game)return;const dock=$('#dockPieces');dock.innerHTML='';const loose=game.trayOrder.map(id=>game.pieces[id]).filter(p=>p.inTray);
    $('#dockCount').textContent=`${loose.length} ${tr('LEFT')}`;
    const hint=$('#dockHint');if(hint)hint.textContent=tr('Release to return to tray');
    if(!loose.length){dock.innerHTML=`<span class="dock-empty">${tr('All pieces are on the board')}</span>`;return}
    loose.forEach(p=>{const b=document.createElement('button'),c=document.createElement('canvas');b.className='dock-piece';b.title=`Place piece ${p.id+1}`;b.setAttribute('aria-label',`Put piece ${p.id+1} on the board`);drawDockPiece(p,c);b.appendChild(c);b.onclick=()=>{if(trayState.suppressClick){trayState.suppressClick=false;return}b.classList.add('removing');setTimeout(()=>releaseFromTray(p),100)};dock.appendChild(b);attachTrayGesture(b,p)})
  }
  function refreshDockCount(){if(!game)return;const loose=game.pieces.filter(p=>p.inTray).length;$('#dockCount').textContent=`${loose} ${tr('LEFT')}`}
  function drawDockPiece(p,c){const size=72,d=2;c.width=size*d;c.height=size*d;const x=c.getContext('2d');x.scale(d,d);const s=size*.66/Math.max(p.w,p.h),tx=(size-p.w*s)/2,ty=(size-p.h*s)/2;x.translate(tx,ty);x.scale(s,s);x.save();x.clip(p.path);x.drawImage(image,-p.targetX,-p.targetY,game.boardW,game.boardH);x.restore();x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=1.2/s;x.stroke(p.path)}
  function releaseFromTray(p){
    p.inTray=false;const r=els.canvas.getBoundingClientRect(),center=screenToWorld(r.left+r.width/2,r.top+(r.height-112)/2),spread=Math.min(game.boardW,game.boardH)*.28;p.x=center.x-p.w/2+(Math.random()-.5)*spread;p.y=center.y-p.h/2+(Math.random()-.5)*spread;p.gid=p.id;bringGroupFront(p.gid);buildDock();updateHUD();queueSave();requestRender();
  }
  function returnGroupToTray(gid){const members=groupMembers(gid);if(!members.length||gid===-1)return;members.forEach(p=>{p.inTray=true;p.gid=p.id;p.x=p.targetX;p.y=p.targetY});buildDock();updateHUD();queueSave();requestRender();toast(members.length>1?'Piece group returned to tray':'Piece returned to tray')}
  function returnAllLoose(){if(!game)return;game.pieces.filter(p=>!p.inTray&&p.gid!==-1).forEach(p=>{p.inTray=true;p.gid=p.id;p.x=p.targetX;p.y=p.targetY});buildDock();updateHUD();queueSave();requestRender();toast('Loose pieces returned to tray')}

  // ---------- Premium tray ⇄ board gesture engine ----------
  // Press → directional intent lock (horizontal scrolls the strip with custom
  // momentum + rubber-band, vertical lifts the piece) → the piece peels off a
  // resistance curve into a floating ghost → seamless morph onto the board
  // canvas (scale-matched) → velocity tilt, hover-lift, edge auto-pan, live
  // snap preview → choreographed drop or fly-back into the slot.
  const trayState={mode:'idle',pointerId:-1,btn:null,piece:null,start:{x:0,y:0},last:{x:0,y:0},samples:[],vx:0,vy:0,pull:0,lift:0,rubber:0,suppressClick:false,ghost:null,ghostX:0,ghostY:0,ghostK0:1,slotCx:0,slotCy:0,carry:null,settleFx:null};
  const dockMomentum={raf:0};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dockEl=()=>$('#dockPieces');
  const dockTopY=()=>$('#pieceDock').getBoundingClientRect().top;
  function ghostK(p,scale){return scale*Math.max(p.w,p.h)/(72*.66)}
  function setDockDroppable(on){$('#pieceDock').classList.toggle('droppable',!!on)}
  function makeGhost(p){const g=document.createElement('canvas');drawDockPiece(p,g);g.className='tray-ghost';g.style.width='72px';g.style.height='72px';g.style.transformOrigin='0 0';document.body.appendChild(g);return g}
  function placeGhost(g,cx,cy,k){g.style.transform=`translate(${cx-36*k}px,${cy-36*k}px) scale(${k})`}
  function slotCenter(btn){const b=btn.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2,k:b.width/72}}
  function flyGhost(p,from,toFn,onDone,ms=240,reuse){
    const g=reuse||makeGhost(p);const t0=performance.now();placeGhost(g,from.x,from.y,from.k);
    const step=()=>{const t=clamp((performance.now()-t0)/ms,0,1),e=1-Math.pow(1-t,3),to=toFn();
      placeGhost(g,from.x+(to.x-from.x)*e,from.y+(to.y-from.y)*e,from.k+(to.k-from.k)*e);
      g.style.opacity=String(1-.25*e);
      if(t<1)requestAnimationFrame(step);else{g.remove();onDone&&onDone()}};
    requestAnimationFrame(step);
  }
  function animateSlot(btn,dir){ // -1 collapse the gap, +1 spring it back open
    const gap=parseFloat(getComputedStyle(dockEl()).columnGap)||9,EASE='cubic-bezier(.3,.7,.25,1)';
    btn.style.overflow='hidden';
    requestAnimationFrame(()=>{btn.style.transition=`flex-basis .24s ${EASE},width .24s ${EASE},margin-right .24s ${EASE},opacity .18s`;
      btn.style.flexBasis=dir<0?'0px':'';btn.style.width=dir<0?'0px':'';
      btn.style.marginRight=dir<0?`-${gap}px`:'';btn.style.opacity=dir<0?'0':'1'});
    setTimeout(()=>{if(dir>0&&btn.isConnected){['transition','overflow','flexBasis','width','marginRight','opacity'].forEach(s=>btn.style.removeProperty(s))}},270);
  }
  function recoilStrip(){const d=dockEl();if(!d)return;const rtl=getComputedStyle(d).direction==='rtl',imp=clamp(trayState.vx*16,-24,24)*(rtl?-1:1);
    if(Math.abs(imp)<3)return;d.style.transition='transform .05s ease-out';d.style.transform=`translateX(${imp}px)`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{d.style.transition='transform .45s cubic-bezier(.2,.7,.3,1)';d.style.transform='translateX(0)'}))}
  function startDockMomentum(){
    const d=dockEl();if(!d)return;const rtl=getComputedStyle(d).direction==='rtl',sign=rtl?1:-1;
    let v=clamp(trayState.vx,-2.8,2.8);if(Math.abs(v)<.22)return;let last=performance.now();
    const step=()=>{const now=performance.now(),dt=Math.min(48,now-last);last=now;v*=Math.exp(-dt/380);
      if(Math.abs(v)<.02)return;const before=d.scrollLeft;d.scrollLeft+=sign*v*dt;
      if(d.scrollLeft!==before)dockMomentum.raf=requestAnimationFrame(step)};
    dockMomentum.raf=requestAnimationFrame(step);
  }
  function releaseRubber(){const d=dockEl();if(!d||!trayState.rubber)return;const from=trayState.rubber;trayState.rubber=0;const t0=performance.now();
    const step=()=>{const t=clamp((performance.now()-t0)/260,0,1),e=1-Math.pow(1-t,3);
      d.style.transform=`translateX(${(1-e)*44*Math.tanh(from/44)}px)`;if(t<1)requestAnimationFrame(step);else d.style.transform=''};
    requestAnimationFrame(step);
  }
  function beginPeel(){
    const btn=trayState.btn;trayState.mode='peel';btn.classList.remove('pressed');btn.classList.add('peeling');
    const c=slotCenter(btn);
    trayState.slotCx=c.x;trayState.slotCy=c.y;trayState.ghostX=c.x;trayState.ghostY=c.y;trayState.ghostK0=c.k;
    trayState.ghost=makeGhost(trayState.piece);placeGhost(trayState.ghost,c.x,c.y,c.k);
  }
  function detachToCarry(){
    const p=trayState.piece,btn=trayState.btn;
    p.inTray=false;p.gid=p.id;bringGroupFront(p.gid);
    trayState.carry={gid:p.id,px:trayState.last.x,py:trayState.last.y,cx:trayState.ghostX,cy:trayState.ghostY,k0:trayState.ghostK0,k1:ghostK(p,camera.scale),tilt:0,vx:trayState.vx,btn,ghost:trayState.ghost,morphT0:performance.now(),lastT:performance.now(),ready:false,offX:trayState.ghostX-trayState.last.x,offY:trayState.ghostY-trayState.last.y,offT0:performance.now()};
    // position the piece under the ghost immediately — never let a frame draw it at its stale tray coords (the target spot)
    const w0=screenToWorld(trayState.carry.cx,trayState.carry.cy);p.x=w0.x-p.w/2;p.y=w0.y-p.h/2;
    trayState.ghost=null;trayState.suppressClick=true;trayState.mode='carry';
    btn.classList.remove('peeling');animateSlot(btn,-1);
    recoilStrip();refreshDockCount();updateHUD();requestRender();
    requestAnimationFrame(carryLoop);
  }
  function carryLoop(){
    const c=trayState.carry;if(!c||trayState.mode!=='carry')return;
    const now=performance.now(),dt=clamp(now-c.lastT,4,40)/1000;c.lastT=now;
    const p=game.pieces[c.gid],r=els.canvas.getBoundingClientRect(),dockTop=dockTopY();
    const halfH=p.h*camera.scale/2;
    // the residual peel offset decays to zero, settling the piece exactly on the pointer
    const offK=1-Math.pow(1-clamp((now-c.offT0)/130,0,1),3);
    let tx=c.px+c.offX*(1-offK),ty=c.py+c.offY*(1-offK);
    ty=Math.min(ty,dockTop-halfH-4);ty=Math.max(ty,r.top+halfH*.4);tx=clamp(tx,r.left+14,r.right-14);
    const k=1-Math.exp(-dt*20);c.cx+=(tx-c.cx)*k;c.cy+=(ty-c.cy)*k;
    // edge auto-pan while carrying
    const M=44;let pan=0;
    if(c.px<r.left+M)pan=-1+(c.px-r.left)/M;
    else if(c.px>r.right-M)pan=1-(r.right-c.px)/M;
    else if(c.py<r.top+M&&c.px>r.left+r.width*.22&&c.px<r.right-r.width*.22)pan=-(1-(c.py-r.top)/M);
    if(pan)camera.x+=pan*820*dt;
    // tilt leans into pointer velocity, springs back when held
    c.tilt+=(clamp(c.vx*.0012,-.085,.085)-c.tilt)*(1-Math.exp(-dt*9));c.vx*=Math.exp(-dt*4);
    const w=screenToWorld(c.cx,c.cy);p.x=w.x-p.w/2;p.y=w.y-p.h/2;
    c.ready=true;
    const mt=clamp((now-c.morphT0)/150,0,1);
    if(c.ghost){if(mt>=1){c.ghost.remove();c.ghost=null}else placeGhost(c.ghost,c.cx,c.cy,c.k0+(c.k1-c.k0)*(1-Math.pow(1-mt,3)))}
    setDockDroppable(c.py>=dockTop);
    requestRender();
    if(trayState.mode==='carry')requestAnimationFrame(carryLoop);
  }
  function snapPreviewPos(p){
    const cell=Math.min(game.boardW/game.cols,game.boardH/game.rows);
    if(Math.hypot(p.x-p.targetX,p.y-p.targetY)<cell*.36)return{x:p.targetX,y:p.targetY};
    for(const b of game.pieces)if(!b.inTray&&b.gid!==p.gid&&neighbors(p,b)){
      const dx=(b.x-b.targetX)-(p.x-p.targetX),dy=(b.y-b.targetY)-(p.y-p.targetY);
      if(Math.hypot(dx,dy)<cell*.30)return{x:p.x+dx,y:p.y+dy}}
    return null;
  }
  function dropCarried(e){
    const c=trayState.carry;trayState.carry=null;trayState.suppressClick=true;trayState.mode='idle';
    trayState.btn=null;trayState.piece=null;setDockDroppable(false);
    if(c.ghost){c.ghost.remove();c.ghost=null}
    const p=game.pieces[c.gid];
    trayState.settleFx={gid:c.gid,t0:performance.now()};
    if(e.clientY>=dockTopY()){flyBackToTray(p,c);return}
    retireSlot(c.btn);
    if(!trySnap(p.gid)){updateHUD();queueSave()}
    requestRender();
  }
  function retireSlot(btn){
    const gone=()=>{btn.isConnected&&btn.remove();refreshDockCount();if(game&&!game.pieces.some(p=>p.inTray))buildDock()};
    if(btn.style.opacity==='0')gone();else{animateSlot(btn,-1);setTimeout(gone,260)}
  }
  function flyBackToTray(p,c){
    p.inTray=true;p.gid=p.id;p.x=p.targetX;p.y=p.targetY;
    animateSlot(c.btn,1);
    flyGhost(p,{x:c.cx,y:c.cy,k:c.k1},()=>slotCenter(c.btn),()=>{refreshDockCount();queueSave()},230);
    updateHUD();requestRender();
  }
  function cancelPeel(){
    const p=trayState.piece,btn=trayState.btn,g=trayState.ghost;trayState.ghost=null;
    btn.classList.remove('peeling');trayState.suppressClick=true;trayState.mode='idle';
    trayState.btn=null;trayState.piece=null;
    if(g)flyGhost(p,{x:trayState.ghostX,y:trayState.ghostY,k:trayState.ghostK0},()=>slotCenter(btn),()=>{},170,g);
  }
  function abortCarry(){
    const c=trayState.carry;if(!c)return;trayState.carry=null;
    setDockDroppable(false);if(c.ghost)c.ghost.remove();
    const p=game.pieces[c.gid];p.inTray=true;p.gid=p.id;p.x=p.targetX;p.y=p.targetY;
    if(c.btn.isConnected)animateSlot(c.btn,1);
    trayState.suppressClick=true;trayState.mode='idle';trayState.btn=null;trayState.piece=null;
    buildDock();updateHUD();queueSave();requestRender();
  }
  function abortPeel(){trayState.ghost&&trayState.ghost.remove();trayState.ghost=null;trayState.btn&&trayState.btn.classList.remove('peeling');trayState.mode='idle';trayState.btn=null;trayState.piece=null}
  function attachTrayGesture(btn,p){
    const SLOP=7,PEEL_MAX=44,DETACH_LIFT=20;
    btn.addEventListener('pointerdown',e=>{
      if(!game||game.completed||trayState.mode!=='idle'||!p.inTray)return;
      if(e.pointerType==='mouse'&&e.button!==0)return;
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      Object.assign(trayState,{mode:'press',pointerId:e.pointerId,btn,piece:p,start:{x:e.clientX,y:e.clientY},last:{x:e.clientX,y:e.clientY},samples:[{x:e.clientX,y:e.clientY,t:performance.now()}],vx:0,vy:0,pull:0,lift:0,rubber:0});
      btn.classList.add('pressed');
      cancelAnimationFrame(dockMomentum.raf);
    });
    btn.addEventListener('pointermove',e=>{
      if(trayState.mode==='idle'||trayState.pointerId!==e.pointerId)return;
      const now=performance.now();
      trayState.samples.push({x:e.clientX,y:e.clientY,t:now});
      if(trayState.samples.length>6)trayState.samples.shift();
      const s0=trayState.samples[0],sdt=Math.max(1,now-s0.t);
      trayState.vx=(e.clientX-s0.x)/sdt;trayState.vy=(e.clientY-s0.y)/sdt;
      const dx=e.clientX-trayState.last.x,dy=e.clientY-trayState.last.y;
      trayState.last={x:e.clientX,y:e.clientY};
      if(trayState.mode==='press'){
        const ax=e.clientX-trayState.start.x,ay=e.clientY-trayState.start.y;
        if(Math.hypot(ax,ay)<SLOP)return;
        if(Math.abs(ax)>Math.abs(ay)*1.15){trayState.mode='scroll';btn.classList.remove('pressed')}
        else beginPeel();
      }
      if(trayState.mode==='scroll'){
        const ay=e.clientY-trayState.start.y;
        if(ay<-34&&Math.abs(trayState.vy)>Math.abs(trayState.vx)*.8){trayState.start={x:e.clientX,y:e.clientY};beginPeel()}
        else{
          const dock=dockEl(),rtl=getComputedStyle(dock).direction==='rtl';
          const desired=dock.scrollLeft+(rtl?dx:-dx);
          dock.scrollLeft=desired;
          trayState.rubber=clamp(trayState.rubber+(desired-dock.scrollLeft)*.35,-70,70);
          dock.style.transform=`translateX(${44*Math.tanh(trayState.rubber/44)}px)`;
        }
      }
      else if(trayState.mode==='peel'){
        const pull=Math.max(0,trayState.start.y-e.clientY);
        trayState.pull=pull;trayState.lift=PEEL_MAX*(1-Math.exp(-pull/PEEL_MAX));
        trayState.ghostX=trayState.slotCx+(e.clientX-trayState.start.x)*.18;
        trayState.ghostY=trayState.slotCy-trayState.lift;
        if(trayState.ghost)placeGhost(trayState.ghost,trayState.ghostX,trayState.ghostY,trayState.ghostK0*(1+trayState.lift/PEEL_MAX*.14));
        if(trayState.lift>DETACH_LIFT&&e.clientY<dockTopY()-4&&trayState.ghost)detachToCarry();
      }
      else if(trayState.mode==='carry'&&trayState.carry){
        trayState.carry.px=e.clientX;trayState.carry.py=e.clientY;trayState.carry.vx=trayState.vx;
      }
    });
    const finish=e=>{
      if(trayState.mode==='idle'||trayState.pointerId!==e.pointerId)return;
      btn.classList.remove('pressed');
      if(trayState.mode==='press'){trayState.mode='idle';return} // plain tap → click handler releases to board
      trayState.suppressClick=true; // any real gesture eats the trailing click
      if(trayState.mode==='scroll'){releaseRubber();startDockMomentum();trayState.mode='idle';trayState.btn=null;trayState.piece=null;return}
      if(trayState.mode==='peel'){cancelPeel();return}
      if(trayState.mode==='carry')dropCarried(e);
    };
    btn.addEventListener('pointerup',finish);
    btn.addEventListener('pointercancel',e=>{
      if(trayState.pointerId!==e.pointerId)return;
      btn.classList.remove('pressed');
      if(trayState.mode==='carry')abortCarry();
      else if(trayState.mode==='peel')cancelPeel();
      else if(trayState.mode==='scroll')releaseRubber();
      trayState.mode='idle';trayState.btn=null;trayState.piece=null;
    });
    btn.addEventListener('contextmenu',e=>e.preventDefault());
  }
  // ---------------------------------------------------------------
  function updateHUD(){if(!game)return;const correct=game.pieces.filter(p=>!p.inTray&&p.gid===-1).length,pct=Math.round(correct/game.count*100);$('#progressPercent').textContent=pct;$('#pieceProgress').textContent=`${correct} / ${game.count} ${tr('placed')}`;$('#gameTimer').textContent=formatTime(game.seconds);$('#zoomLabel').textContent=`${Math.round(camera.scale*100)}%`}
  function startClock(){stopClock();if(!game||game.completed)return;game.lastTick=Date.now();timerInterval=setInterval(()=>{const now=Date.now();game.seconds+=(now-game.lastTick)/1000;game.lastTick=now;updateHUD();if(Math.floor(game.seconds)%8===0)queueSave()},1000)}
  function stopClock(){clearInterval(timerInterval);timerInterval=null}
  function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>game&&storage.putCurrent(serialGame()),500)}

  function resize(){if(currentView!=='game')return;const r=els.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);els.canvas.width=Math.round(r.width*d);els.canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);render()}
  function screenToWorld(x,y){const r=els.canvas.getBoundingClientRect();return {x:(x-r.left-camera.x)/camera.scale,y:(y-r.top-camera.y)/camera.scale}}
  function requestRender(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;render()})}
  function render(){if(!game||currentView!=='game')return;const r=els.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,r.width,r.height);ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);
    ctx.fillStyle='rgba(241,238,231,.42)';ctx.strokeStyle='rgba(18,19,22,.2)';ctx.lineWidth=1/camera.scale;ctx.fillRect(0,0,game.boardW,game.boardH);ctx.strokeRect(0,0,game.boardW,game.boardH);if(game.showGrid){ctx.strokeStyle='rgba(18,19,22,.13)';ctx.lineWidth=.8/camera.scale;for(const p of game.pieces){ctx.save();ctx.translate(p.targetX,p.targetY);ctx.stroke(p.path);ctx.restore()}}
    for(const id of game.order){const p=game.pieces[id];if(p.inTray)continue;if(trayState.mode==='carry'&&trayState.carry&&p.id===trayState.carry.gid)continue;ctx.save();let pop=1;if(trayState.settleFx&&trayState.settleFx.gid===p.id){const st=(performance.now()-trayState.settleFx.t0)/170;if(st>=1||p.inTray)trayState.settleFx=null;else pop=1+.06*Math.sin(st*Math.PI)}ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.scale(pop,pop);ctx.translate(-(p.x+p.w/2),-(p.y+p.h/2));ctx.translate(p.x,p.y);if(game.shadows){ctx.shadowColor='rgba(18,19,22,.32)';ctx.shadowBlur=8/camera.scale;ctx.shadowOffsetY=4/camera.scale}ctx.save();ctx.clip(p.path);ctx.drawImage(image,-p.targetX,-p.targetY,game.boardW,game.boardH);ctx.restore();ctx.shadowColor='transparent';ctx.strokeStyle='rgba(255,255,255,.58)';ctx.lineWidth=Math.max(.7,1.1/camera.scale);ctx.stroke(p.path);ctx.restore()}
    if(trayState.mode==='carry'&&trayState.carry){const c=trayState.carry,p=game.pieces[c.gid],now=performance.now();
      const sp=c.ready?snapPreviewPos(p):null;
      if(sp){const a=.55+.35*Math.sin(now/175),pu=1.03+.015*Math.sin(now/175),scx=sp.x+p.w/2,scy=sp.y+p.h/2;
        ctx.save();ctx.translate(scx,scy);ctx.scale(pu,pu);ctx.translate(-scx,-scy);ctx.translate(sp.x,sp.y);
        ctx.fillStyle=`rgba(229,88,63,${.18+.1*a})`;ctx.fill(p.path);
        ctx.strokeStyle=`rgba(229,88,63,${a})`;ctx.lineWidth=2.2/camera.scale;ctx.shadowColor='rgba(229,88,63,.85)';ctx.shadowBlur=13/camera.scale;ctx.stroke(p.path);ctx.restore()}
      const e=1-Math.pow(1-clamp((now-c.morphT0)/150,0,1),3);
      ctx.save();ctx.globalAlpha=e*(sp?.86:1);ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.rotate(c.tilt);ctx.translate(-(p.x+p.w/2),-(p.y+p.h/2));ctx.translate(p.x,p.y);
      ctx.shadowColor='rgba(18,19,22,.42)';ctx.shadowBlur=24/camera.scale;ctx.shadowOffsetY=12/camera.scale;
      ctx.save();ctx.clip(p.path);ctx.drawImage(image,-p.targetX,-p.targetY,game.boardW,game.boardH);ctx.restore();
      ctx.shadowColor='transparent';ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=Math.max(.8,1.2/camera.scale);ctx.stroke(p.path);ctx.restore()}
    ctx.restore()
  }
  function fitBoard(){if(!game)return;const r=els.canvas.getBoundingClientRect(),sidePad=Math.max(28,Math.min(80,r.width*.08)),topPad=34,dockSpace=r.width<800?150:165,usableH=Math.max(180,r.height-topPad-dockSpace);camera.scale=Math.min((r.width-sidePad*2)/game.boardW,usableH/game.boardH,1.45);camera.x=(r.width-game.boardW*camera.scale)/2;camera.y=topPad+(usableH-game.boardH*camera.scale)/2;updateHUD();requestRender()}
  function fitAll(){fitBoard()}
  function zoomAt(factor,sx,sy){const r=els.canvas.getBoundingClientRect(),x=sx??r.width/2,y=sy??r.height/2,wx=(x-camera.x)/camera.scale,wy=(y-camera.y)/camera.scale;camera.scale=Math.max(.18,Math.min(3,camera.scale*factor));camera.x=x-wx*camera.scale;camera.y=y-wy*camera.scale;updateHUD();requestRender()}
  function hitPiece(w){for(let i=game.order.length-1;i>=0;i--){const p=game.pieces[game.order[i]];if(p.inTray||p.gid===-1)continue;const lx=w.x-p.x,ly=w.y-p.y;if(lx>-p.w*.25&&lx<p.w*1.25&&ly>-p.h*.25&&ly<p.h*1.25&&ctx.isPointInPath(p.path,lx,ly))return p}return null}
  function bringGroupFront(gid){const ids=game.order.filter(id=>game.pieces[id].gid===gid);game.order=game.order.filter(id=>game.pieces[id].gid!==gid).concat(ids)}
  function trySnap(gid){
    const moving=groupMembers(gid),cell=Math.min(game.boardW/game.cols,game.boardH/game.rows),gridThreshold=cell*.36,offX=moving[0].x-moving[0].targetX,offY=moving[0].y-moving[0].targetY;
    // The board itself is a valid snap target, so a piece never has to wait for a neighbour.
    if(Math.hypot(offX,offY)<gridThreshold){moving.forEach(p=>{p.x=p.targetX;p.y=p.targetY;p.gid=-1});afterSnap();return true}
    const others=game.pieces.filter(p=>!p.inTray&&p.gid!==gid),pieceThreshold=cell*.30;let match=null;
    outer:for(const a of moving)for(const b of others)if(neighbors(a,b)){const ax=a.x-a.targetX,ay=a.y-a.targetY,bx=b.x-b.targetX,by=b.y-b.targetY,dx=bx-ax,dy=by-ay;if(Math.hypot(dx,dy)<pieceThreshold){match={dx,dy,newGid:b.gid};break outer}}
    if(match){moving.forEach(p=>{p.x+=match.dx;p.y+=match.dy;p.gid=match.newGid});afterSnap();return true}return false
  }
  function afterSnap(){playClick();navigator.vibrate?.(20);updateHUD();queueSave();requestRender();if(game.pieces.every(p=>!p.inTray&&p.gid===-1))finishGame()}
  function playClick(){if(!soundOn)return;try{const ac=playClick.ac||(playClick.ac=new (window.AudioContext||window.webkitAudioContext)()),o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(280,ac.currentTime);o.frequency.exponentialRampToValueAtTime(520,ac.currentTime+.06);g.gain.setValueAtTime(.08,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.09);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.1)}catch(e){}}
  function finishGame(){game.completed=true;stopClock();const offX=game.pieces[0].x-game.pieces[0].targetX,offY=game.pieces[0].y-game.pieces[0].targetY;game.pieces.forEach(p=>{p.x=p.targetX+offX;p.y=p.targetY+offY});stats.solved=(stats.solved||0)+1;stats.seconds=(stats.seconds||0)+game.seconds;storage.saveStats(stats);storage.deleteCurrent();setTimeout(()=>{els.completeImage.src=game.imageData;$('#completeTime').textContent=formatTime(game.seconds);$('#completePieces').textContent=game.count;openModal(els.complete,true)},650);requestRender()}
  function shuffle(){if(!game)return;if(trayState.mode==='carry')abortCarry();else if(trayState.mode==='peel')abortPeel();game.pieces.forEach(p=>{p.x=p.targetX;p.y=p.targetY;p.gid=p.id;p.inTray=true});game.trayOrder=makeTrayOrder(game.pieces);game.completed=false;game.seconds=0;game.lastTick=Date.now();buildDock();fitBoard();updateHUD();queueSave();toast('Puzzle reset and tray reshuffled')}

  els.canvas.addEventListener('pointerdown',e=>{if(!game)return;if(trayState.mode==='carry'||trayState.mode==='peel')return;els.canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()],dx=a[1].x-a[0].x,dy=a[1].y-a[0].y;gesture={dist:Math.hypot(dx,dy),scale:camera.scale,cx:(a[0].x+a[1].x)/2,cy:(a[0].y+a[1].y)/2,camX:camera.x,camY:camera.y};drag=null;return}const w=screenToWorld(e.clientX,e.clientY),p=hitPiece(w);if(p){bringGroupFront(p.gid);drag={type:'piece',gid:p.gid,last:w}}else drag={type:'pan',last:{x:e.clientX,y:e.clientY}};requestRender()});
  els.canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2&&gesture){const a=[...pointers.values()],dx=a[1].x-a[0].x,dy=a[1].y-a[0].y,cx=(a[0].x+a[1].x)/2,cy=(a[0].y+a[1].y)/2;camera.scale=Math.max(.18,Math.min(3,gesture.scale*Math.hypot(dx,dy)/gesture.dist));camera.x=gesture.camX+(cx-gesture.cx);camera.y=gesture.camY+(cy-gesture.cy);updateHUD();requestRender();return}if(!drag)return;if(drag.type==='piece'){const w=screenToWorld(e.clientX,e.clientY),dx=w.x-drag.last.x,dy=w.y-drag.last.y;groupMembers(drag.gid).forEach(p=>{p.x+=dx;p.y+=dy});drag.last=w;setDockDroppable(e.clientY>=dockTopY())}else{camera.x+=e.clientX-drag.last.x;camera.y+=e.clientY-drag.last.y;drag.last={x:e.clientX,y:e.clientY}}requestRender()});
  function pointerEnd(e){pointers.delete(e.pointerId);setDockDroppable(false);if(drag?.type==='piece'){const trayTop=dockTopY();if(e.clientY>=trayTop)returnGroupToTray(drag.gid);else trySnap(drag.gid)}drag=null;gesture=null;queueSave();requestRender()}
  els.canvas.addEventListener('pointerup',pointerEnd);els.canvas.addEventListener('pointercancel',pointerEnd);els.canvas.addEventListener('wheel',e=>{e.preventDefault();const r=els.canvas.getBoundingClientRect();zoomAt(e.deltaY<0?1.1:.9,e.clientX-r.left,e.clientY-r.top)},{passive:false});

  $('#newPuzzleBtn').onclick=()=>openModal(els.setup,true);$('#menuNew').onclick=()=>{openModal(els.menu,false);openModal(els.setup,true)};$('#sampleBtn').onclick=()=>loadSelected(sampleArtwork());els.drop.onclick=()=>els.file.click();els.file.onchange=e=>readFile(e.target.files[0]);
  els.drop.addEventListener('dragover',e=>{e.preventDefault();els.drop.style.borderColor='var(--red)'});els.drop.addEventListener('dragleave',()=>els.drop.style.borderColor='');els.drop.addEventListener('drop',e=>{e.preventDefault();els.drop.style.borderColor='';readFile(e.dataTransfer.files[0])});
  els.start.onclick=()=>{const count=+$('input[name=difficulty]:checked').value;openModal(els.setup,false);createGame(selectedData,count).catch(()=>toast('Could not open that image'))};
  $$('[data-close="setup"]').forEach(b=>b.onclick=()=>openModal(els.setup,false));$('#menuBtn').onclick=()=>openModal(els.menu,true);$$('[data-close="menu"]').forEach(b=>b.onclick=()=>openModal(els.menu,false));
  $('#brandBtn').onclick=$('#menuHome').onclick=()=>{openModal(els.menu,false);showView('home');updateHome()};$('#menuResume').onclick=()=>openModal(els.menu,false);$('#menuReturnLoose').onclick=()=>{openModal(els.menu,false);returnAllLoose()};$('#menuRestart').onclick=()=>{openModal(els.menu,false);openModal($('#resetModal'),true)};$('#cancelReset').onclick=()=>openModal($('#resetModal'),false);$$('[data-close="reset"]').forEach(b=>b.onclick=()=>openModal($('#resetModal'),false));$('#confirmReset').onclick=()=>{openModal($('#resetModal'),false);shuffle()};
  $('#continueBtn').onclick=async()=>{const s=await storage.getCurrent();if(s)restoreGame(s);else toast('No saved puzzle found')};$('#previewBtn').onclick=()=>{if(game){els.fullPreview.src=game.imageData;openModal(els.preview,true)}};$('#closePreview').onclick=()=>openModal(els.preview,false);els.preview.onclick=e=>{if(e.target===els.preview)openModal(els.preview,false)};
  $('#zoomInBtn').onclick=()=>zoomAt(1.2);$('#zoomOutBtn').onclick=()=>zoomAt(.82);$('#fitBtn').onclick=fitAll;
  $('#soundBtn').onclick=()=>{soundOn=!soundOn;updateSettings()};$('#menuSound').onchange=e=>{soundOn=e.target.checked;updateSettings()};$('#menuGrid').onchange=e=>{gridOn=e.target.checked;updateSettings()};$('#languageSelect').onchange=e=>{applyLanguage(e.target.value);updateSettings();if(selectedData)loadImage(selectedData).then(im=>updateDifficultyCounts(im.width/im.height))};
  $('#anotherBtn').onclick=()=>{openModal(els.complete,false);selectedData=null;els.drop.classList.remove('has-image');els.start.disabled=true;showView('home');openModal(els.setup,true)};$('#backHomeBtn').onclick=()=>{openModal(els.complete,false);showView('home');updateHome()};
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){if(trayState.mode==='carry')abortCarry();else if(trayState.mode==='peel')abortPeel();queueSave();stopClock()}else if(currentView==='game')startClock()});

  drawHero();applyLanguage(language);updateSettings();updateHome();showView('home');
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
