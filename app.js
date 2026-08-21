(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const els = {
    home: $('#homeView'), game: $('#gameView'), canvas: $('#puzzleCanvas'), hero: $('#heroCanvas'),
    setup: $('#setupModal'), menu: $('#sideMenu'), complete: $('#completeModal'), preview: $('#previewOverlay'),
    file: $('#fileInput'), drop: $('#imageDrop'), imagePreview: $('#imagePreview'), start: $('#startBtn'),
    fullPreview: $('#fullPreview'), completeImage: $('#completeImage'), toast: $('#toast')
  };
  const ctx = els.canvas.getContext('2d');
  const hctx = els.hero.getContext('2d');
  const settings = JSON.parse(localStorage.getItem('piecework.settings') || '{}');
  let soundOn = settings.sound !== false, gridOn = settings.grid === true;
  let selectedData = null, image = null, game = null, raf = 0, timerInterval = null, saveTimer = null;
  let camera = {x:0,y:0,scale:1}, pointers = new Map(), gesture = null, drag = null, currentView = 'home';
  const stats = JSON.parse(localStorage.getItem('piecework.stats') || '{"solved":0,"seconds":0}');

  function secureIndex(max){
    if(max<=1)return 0;const limit=Math.floor(4294967296/max)*max,a=new Uint32Array(1);do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%max
  }
  function secureShuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=secureIndex(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
  function makeTrayOrder(pieces){
    const ids=pieces.map(p=>p.id),near=(a,b)=>Math.abs(a.row-b.row)<=1&&Math.abs(a.col-b.col)<=1;
    let best=null,bestScore=Infinity;
    // Use independent cryptographic shuffles, then reject visually clustered orders.
    for(let attempt=0;attempt<400;attempt++){const order=secureShuffle(ids);let score=0;for(let i=1;i<order.length;i++)if(near(pieces[order[i-1]],pieces[order[i]]))score++;if(score<bestScore){best=order;bestScore=score}if(score===0)return order}
    return best;
  }

  function sampleArtwork(width=1400,height=950){
    const c=document.createElement('canvas'); c.width=width;c.height=height; const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,width,height);g.addColorStop(0,'#d9b18d');g.addColorStop(.42,'#809b8a');g.addColorStop(1,'#304b4d');x.fillStyle=g;x.fillRect(0,0,width,height);
    x.fillStyle='#e9d9bd';x.beginPath();x.arc(width*.23,height*.25,height*.12,0,Math.PI*2);x.fill();
    x.fillStyle='#263c3e';x.beginPath();x.moveTo(0,height*.72);x.quadraticCurveTo(width*.2,height*.42,width*.42,height*.73);x.quadraticCurveTo(width*.64,height*.32,width,height*.7);x.lineTo(width,height);x.lineTo(0,height);x.fill();
    x.fillStyle='#bb684f';x.beginPath();x.moveTo(width*.34,height);x.quadraticCurveTo(width*.53,height*.52,width*.73,height);x.fill();
    x.strokeStyle='rgba(240,225,194,.7)';x.lineWidth=5;for(let i=0;i<7;i++){x.beginPath();x.moveTo(width*(.08+i*.15),height);x.quadraticCurveTo(width*(.15+i*.13),height*.62,width*(.18+i*.14),height*.54);x.stroke()}
    x.fillStyle='rgba(255,255,255,.14)';for(let i=0;i<70;i++){x.beginPath();x.arc(Math.random()*width,Math.random()*height,Math.random()*3+1,0,7);x.fill()}
    return c.toDataURL('image/jpeg',.9);
  }

  function drawHero(){
    const c=els.hero,w=c.width,h=c.height,g=hctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#d1a37f');g.addColorStop(.45,'#7b9989');g.addColorStop(1,'#29474b');hctx.fillStyle=g;hctx.fillRect(0,0,w,h);
    hctx.fillStyle='#ecddc3';hctx.beginPath();hctx.arc(w*.22,h*.23,83,0,7);hctx.fill();hctx.fillStyle='#223c3e';hctx.beginPath();hctx.moveTo(0,h*.76);hctx.quadraticCurveTo(w*.22,h*.36,w*.47,h*.78);hctx.quadraticCurveTo(w*.72,h*.28,w,h*.72);hctx.lineTo(w,h);hctx.lineTo(0,h);hctx.fill();
    hctx.strokeStyle='rgba(255,255,255,.28)';hctx.lineWidth=2;for(let i=1;i<5;i++){hctx.beginPath();hctx.moveTo(i*w/5,0);hctx.lineTo(i*w/5,h);hctx.stroke()}for(let i=1;i<4;i++){hctx.beginPath();hctx.moveTo(0,i*h/4);hctx.lineTo(w,i*h/4);hctx.stroke()}
  }

  function showView(name){currentView=name;els.home.classList.toggle('active',name==='home');els.game.classList.toggle('active',name==='game');$$('.game-only').forEach(e=>e.classList.toggle('hidden',name!=='game'));if(name==='game'){resize();startClock()}else stopClock()}
  function openModal(el,on=true){el.classList.toggle('open',on);el.setAttribute('aria-hidden',String(!on))}
  function toast(msg){const t=els.toast;t.textContent=msg;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),2200)}
  function formatTime(s){s=Math.max(0,Math.floor(s));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
  function updateHome(){ $('#statSolved').textContent=stats.solved||0; $('#statTime').textContent=stats.seconds<3600?`${Math.round(stats.seconds/60)}m`:`${(stats.seconds/3600).toFixed(1)}h`; dbGet('current').then(v=>$('#continueBtn').classList.toggle('hidden',!v)); }
  function updateSettings(){ $('#menuSound').checked=soundOn;$('#menuGrid').checked=gridOn;$('#soundBtn').classList.toggle('muted',!soundOn);localStorage.setItem('piecework.settings',JSON.stringify({sound:soundOn,grid:gridOn}));if(game){game.showGrid=gridOn;requestRender()}}

  function loadSelected(data){selectedData=data;els.imagePreview.src=data;els.drop.classList.add('has-image');els.start.disabled=false}
  function readFile(file){if(!file)return;if(file.size>25*1024*1024){toast('That image is larger than 25 MB');return}const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const max=1800,scale=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);loadSelected(c.toDataURL('image/jpeg',.9))};im.src=r.result};r.readAsDataURL(file)}
  function loadImage(data){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=data})}
  function chooseGrid(count,aspect){let best=[count,1],score=Infinity;for(let r=1;r<=count;r++)if(count%r===0){const c=count/r,s=Math.abs(Math.log((c/r)/aspect));if(s<score){score=s;best=[c,r]}}return best}
  function edgePath(p,x1,y1,x2,y2,nx,ny,sign,size){
    const dx=x2-x1,dy=y2-y1; const at=t=>[x1+dx*t,y1+dy*t]; let a=at(.34),b=at(.42),c=at(.5),d=at(.58),e=at(.66);p.lineTo(a[0],a[1]);
    const amp=size*.2*sign;p.bezierCurveTo(b[0],b[1],b[0]+nx*amp*.15,b[1]+ny*amp*.15,b[0]+nx*amp*.55,b[1]+ny*amp*.55);p.bezierCurveTo(b[0]+nx*amp,b[1]+ny*amp,d[0]+nx*amp,d[1]+ny*amp,d[0]+nx*amp*.55,d[1]+ny*amp*.55);p.bezierCurveTo(d[0]+nx*amp*.15,d[1]+ny*amp*.15,d[0],d[1],e[0],e[1]);p.lineTo(x2,y2)
  }
  function makePath(pc){const w=pc.w,h=pc.h,p=new Path2D();p.moveTo(0,0);edgePath(p,0,0,w,0,0,-1,pc.edges.t,w);edgePath(p,w,0,w,h,1,0,pc.edges.r,h);edgePath(p,w,h,0,h,0,1,pc.edges.b,w);edgePath(p,0,h,0,0,-1,0,pc.edges.l,h);p.closePath();return p}

  async function createGame(data,count,opts={}){
    image=await loadImage(data);const aspect=image.width/image.height,[cols,rows]=chooseGrid(count,aspect),boardW=800,boardH=boardW/aspect,cw=boardW/cols,ch=boardH/rows,pieces=[];let seed=(Date.now()>>>0),rand=()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296);
    const right=Array.from({length:rows},()=>Array(cols).fill(0)),bottom=Array.from({length:rows},()=>Array(cols).fill(0));for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(c<cols-1)right[r][c]=rand()>.5?1:-1;if(r<rows-1)bottom[r][c]=rand()>.5?1:-1}
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const id=r*cols+c;const pc={id,row:r,col:c,w:cw,h:ch,targetX:c*cw,targetY:r*ch,x:c*cw,y:r*ch,gid:id,inTray:true,edges:{t:r? -bottom[r-1][c]:0,r:right[r][c],b:bottom[r][c],l:c? -right[r][c-1]:0}};pc.path=makePath(pc);pieces.push(pc)}
    const trayOrder=makeTrayOrder(pieces);
    game={version:3,imageData:data,count,cols,rows,boardW,boardH,pieces,order:pieces.map(p=>p.id),trayOrder,seconds:0,lastTick:Date.now(),completed:false,shadows:true,showGrid:gridOn};showView('game');buildDock();fitBoard();updateHUD();queueSave();toast('Choose a piece from the tray to begin');
  }
  async function restoreGame(saved){image=await loadImage(saved.imageData);game=saved;game.showGrid=gridOn;if(!game.trayOrder)game.trayOrder=makeTrayOrder(game.pieces);game.pieces.forEach(p=>{p.path=makePath(p);if(p.inTray===undefined)p.inTray=false});game.lastTick=Date.now();showView('game');buildDock();fitBoard();updateHUD();toast('Welcome back');}
  function serialGame(){if(!game)return null;return {...game,lastTick:undefined,pieces:game.pieces.map(({path,...p})=>p)}}

  function neighbors(a,b){return (a.row===b.row&&Math.abs(a.col-b.col)===1)||(a.col===b.col&&Math.abs(a.row-b.row)===1)}
  function groupMembers(gid){return game.pieces.filter(p=>p.gid===gid)}
  function connectedCount(){const groups=new Set(game.pieces.map(p=>p.gid));return game.count-groups.size}
  function buildDock(){
    if(!game)return;const dock=$('#dockPieces');dock.innerHTML='';const loose=game.trayOrder.map(id=>game.pieces[id]).filter(p=>p.inTray);
    $('#dockCount').textContent=`${loose.length} LEFT`;
    if(!loose.length){dock.innerHTML='<span class="dock-empty">All pieces are on the board</span>';return}
    loose.forEach(p=>{const b=document.createElement('button'),c=document.createElement('canvas');b.className='dock-piece';b.title=`Place piece ${p.id+1}`;b.setAttribute('aria-label',`Put piece ${p.id+1} on the board`);drawDockPiece(p,c);b.appendChild(c);b.onclick=()=>{b.classList.add('removing');setTimeout(()=>releaseFromTray(p),100)};dock.appendChild(b)})
  }
  function drawDockPiece(p,c){const size=72,d=2;c.width=size*d;c.height=size*d;const x=c.getContext('2d');x.scale(d,d);const s=size*.66/Math.max(p.w,p.h),tx=(size-p.w*s)/2,ty=(size-p.h*s)/2;x.translate(tx,ty);x.scale(s,s);x.save();x.clip(p.path);x.drawImage(image,-p.targetX,-p.targetY,game.boardW,game.boardH);x.restore();x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=1.2/s;x.stroke(p.path)}
  function releaseFromTray(p){
    p.inTray=false;const r=els.canvas.getBoundingClientRect(),center=screenToWorld(r.left+r.width/2,r.top+(r.height-112)/2),spread=Math.min(game.boardW,game.boardH)*.28;p.x=center.x-p.w/2+(Math.random()-.5)*spread;p.y=center.y-p.h/2+(Math.random()-.5)*spread;p.gid=p.id;bringGroupFront(p.gid);buildDock();updateHUD();queueSave();requestRender();
  }
  function returnGroupToTray(gid){const members=groupMembers(gid);if(!members.length||gid===-1)return;members.forEach(p=>{p.inTray=true;p.gid=p.id;p.x=p.targetX;p.y=p.targetY});buildDock();updateHUD();queueSave();requestRender();toast(members.length>1?'Piece group returned to tray':'Piece returned to tray')}
  function returnAllLoose(){if(!game)return;game.pieces.filter(p=>!p.inTray&&p.gid!==-1).forEach(p=>{p.inTray=true;p.gid=p.id;p.x=p.targetX;p.y=p.targetY});buildDock();updateHUD();queueSave();requestRender();toast('Loose pieces returned to tray')}
  function updateHUD(){if(!game)return;const correct=game.pieces.filter(p=>!p.inTray&&p.gid===-1).length,pct=Math.round(correct/game.count*100);$('#progressPercent').textContent=pct;$('#pieceProgress').textContent=`${correct} / ${game.count} placed`;$('#gameTimer').textContent=formatTime(game.seconds);$('#zoomLabel').textContent=`${Math.round(camera.scale*100)}%`}
  function startClock(){stopClock();if(!game||game.completed)return;game.lastTick=Date.now();timerInterval=setInterval(()=>{const now=Date.now();game.seconds+=(now-game.lastTick)/1000;game.lastTick=now;updateHUD();if(Math.floor(game.seconds)%8===0)queueSave()},1000)}
  function stopClock(){clearInterval(timerInterval);timerInterval=null}
  function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>game&&dbPut('current',serialGame()),500)}

  function resize(){if(currentView!=='game')return;const r=els.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);els.canvas.width=Math.round(r.width*d);els.canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);render()}
  function screenToWorld(x,y){const r=els.canvas.getBoundingClientRect();return {x:(x-r.left-camera.x)/camera.scale,y:(y-r.top-camera.y)/camera.scale}}
  function requestRender(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;render()})}
  function render(){if(!game||currentView!=='game')return;const r=els.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,r.width,r.height);ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);
    ctx.fillStyle='rgba(241,238,231,.42)';ctx.strokeStyle='rgba(18,19,22,.2)';ctx.lineWidth=1/camera.scale;ctx.fillRect(0,0,game.boardW,game.boardH);ctx.strokeRect(0,0,game.boardW,game.boardH);if(game.showGrid){ctx.strokeStyle='rgba(18,19,22,.13)';ctx.lineWidth=.8/camera.scale;for(const p of game.pieces){ctx.save();ctx.translate(p.targetX,p.targetY);ctx.stroke(p.path);ctx.restore()}}
    for(const id of game.order){const p=game.pieces[id];if(p.inTray)continue;ctx.save();ctx.translate(p.x,p.y);if(game.shadows){ctx.shadowColor='rgba(18,19,22,.32)';ctx.shadowBlur=8/camera.scale;ctx.shadowOffsetY=4/camera.scale}ctx.save();ctx.clip(p.path);ctx.drawImage(image,-p.targetX,-p.targetY,game.boardW,game.boardH);ctx.restore();ctx.shadowColor='transparent';ctx.strokeStyle='rgba(255,255,255,.58)';ctx.lineWidth=Math.max(.7,1.1/camera.scale);ctx.stroke(p.path);ctx.restore()}ctx.restore()
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
  function finishGame(){game.completed=true;stopClock();const offX=game.pieces[0].x-game.pieces[0].targetX,offY=game.pieces[0].y-game.pieces[0].targetY;game.pieces.forEach(p=>{p.x=p.targetX+offX;p.y=p.targetY+offY});stats.solved=(stats.solved||0)+1;stats.seconds=(stats.seconds||0)+game.seconds;localStorage.setItem('piecework.stats',JSON.stringify(stats));dbDelete('current');setTimeout(()=>{els.completeImage.src=game.imageData;$('#completeTime').textContent=formatTime(game.seconds);$('#completePieces').textContent=game.count;openModal(els.complete,true)},650);requestRender()}
  function shuffle(){if(!game)return;game.pieces.forEach(p=>{p.x=p.targetX;p.y=p.targetY;p.gid=p.id;p.inTray=true});game.trayOrder=makeTrayOrder(game.pieces);game.completed=false;game.seconds=0;game.lastTick=Date.now();buildDock();fitBoard();updateHUD();queueSave();toast('Puzzle reset and tray reshuffled')}

  els.canvas.addEventListener('pointerdown',e=>{if(!game)return;els.canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()],dx=a[1].x-a[0].x,dy=a[1].y-a[0].y;gesture={dist:Math.hypot(dx,dy),scale:camera.scale,cx:(a[0].x+a[1].x)/2,cy:(a[0].y+a[1].y)/2,camX:camera.x,camY:camera.y};drag=null;return}const w=screenToWorld(e.clientX,e.clientY),p=hitPiece(w);if(p){bringGroupFront(p.gid);drag={type:'piece',gid:p.gid,last:w}}else drag={type:'pan',last:{x:e.clientX,y:e.clientY}};requestRender()});
  els.canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2&&gesture){const a=[...pointers.values()],dx=a[1].x-a[0].x,dy=a[1].y-a[0].y,cx=(a[0].x+a[1].x)/2,cy=(a[0].y+a[1].y)/2;camera.scale=Math.max(.18,Math.min(3,gesture.scale*Math.hypot(dx,dy)/gesture.dist));camera.x=gesture.camX+(cx-gesture.cx);camera.y=gesture.camY+(cy-gesture.cy);updateHUD();requestRender();return}if(!drag)return;if(drag.type==='piece'){const w=screenToWorld(e.clientX,e.clientY),dx=w.x-drag.last.x,dy=w.y-drag.last.y;groupMembers(drag.gid).forEach(p=>{p.x+=dx;p.y+=dy});drag.last=w}else{camera.x+=e.clientX-drag.last.x;camera.y+=e.clientY-drag.last.y;drag.last={x:e.clientX,y:e.clientY}}requestRender()});
  function pointerEnd(e){pointers.delete(e.pointerId);if(drag?.type==='piece'){const trayTop=$('#pieceDock').getBoundingClientRect().top;if(e.clientY>=trayTop)returnGroupToTray(drag.gid);else trySnap(drag.gid)}drag=null;gesture=null;queueSave();requestRender()}
  els.canvas.addEventListener('pointerup',pointerEnd);els.canvas.addEventListener('pointercancel',pointerEnd);els.canvas.addEventListener('wheel',e=>{e.preventDefault();const r=els.canvas.getBoundingClientRect();zoomAt(e.deltaY<0?1.1:.9,e.clientX-r.left,e.clientY-r.top)},{passive:false});

  $('#newPuzzleBtn').onclick=()=>openModal(els.setup,true);$('#menuNew').onclick=()=>{openModal(els.menu,false);openModal(els.setup,true)};$('#sampleBtn').onclick=()=>loadSelected(sampleArtwork());els.drop.onclick=()=>els.file.click();els.file.onchange=e=>readFile(e.target.files[0]);
  els.drop.addEventListener('dragover',e=>{e.preventDefault();els.drop.style.borderColor='var(--red)'});els.drop.addEventListener('dragleave',()=>els.drop.style.borderColor='');els.drop.addEventListener('drop',e=>{e.preventDefault();els.drop.style.borderColor='';readFile(e.dataTransfer.files[0])});
  els.start.onclick=()=>{const count=+$('input[name=difficulty]:checked').value;openModal(els.setup,false);createGame(selectedData,count).catch(()=>toast('Could not open that image'))};
  $$('[data-close="setup"]').forEach(b=>b.onclick=()=>openModal(els.setup,false));$('#menuBtn').onclick=()=>openModal(els.menu,true);$$('[data-close="menu"]').forEach(b=>b.onclick=()=>openModal(els.menu,false));
  $('#brandBtn').onclick=$('#menuHome').onclick=()=>{openModal(els.menu,false);showView('home');updateHome()};$('#menuResume').onclick=()=>openModal(els.menu,false);$('#menuReturnLoose').onclick=()=>{openModal(els.menu,false);returnAllLoose()};$('#menuRestart').onclick=()=>{openModal(els.menu,false);openModal($('#resetModal'),true)};$('#cancelReset').onclick=()=>openModal($('#resetModal'),false);$$('[data-close="reset"]').forEach(b=>b.onclick=()=>openModal($('#resetModal'),false));$('#confirmReset').onclick=()=>{openModal($('#resetModal'),false);shuffle()};
  $('#continueBtn').onclick=async()=>{const s=await dbGet('current');if(s)restoreGame(s);else toast('No saved puzzle found')};$('#previewBtn').onclick=()=>{if(game){els.fullPreview.src=game.imageData;openModal(els.preview,true)}};$('#closePreview').onclick=()=>openModal(els.preview,false);els.preview.onclick=e=>{if(e.target===els.preview)openModal(els.preview,false)};
  $('#zoomInBtn').onclick=()=>zoomAt(1.2);$('#zoomOutBtn').onclick=()=>zoomAt(.82);$('#fitBtn').onclick=fitAll;
  $('#soundBtn').onclick=()=>{soundOn=!soundOn;updateSettings()};$('#menuSound').onchange=e=>{soundOn=e.target.checked;updateSettings()};$('#menuGrid').onchange=e=>{gridOn=e.target.checked;updateSettings()};
  $('#anotherBtn').onclick=()=>{openModal(els.complete,false);selectedData=null;els.drop.classList.remove('has-image');els.start.disabled=true;showView('home');openModal(els.setup,true)};$('#backHomeBtn').onclick=()=>{openModal(els.complete,false);showView('home');updateHome()};
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){queueSave();stopClock()}else if(currentView==='game')startClock()});

  const DB='piecework-db';function withStore(mode,fn){return new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const tx=q.result.transaction('saves',mode),req=fn(tx.objectStore('saves'));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)}})}function dbPut(k,v){return withStore('readwrite',s=>s.put(v,k)).catch(()=>{})}function dbGet(k){return withStore('readonly',s=>s.get(k)).catch(()=>null)}function dbDelete(k){return withStore('readwrite',s=>s.delete(k)).catch(()=>{})}

  drawHero();updateSettings();updateHome();showView('home');
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
