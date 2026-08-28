import {
  chooseGrid,
  sampleArtwork,
} from './js/puzzle.js';

import { createDom } from './js/dom.js';
import { createI18n } from './js/i18n.js';
import { createState } from './js/state.js';
import { createStorage } from './js/storage.js';
import { createRenderer } from './js/renderer.js';
import { createGameController } from './js/game.js';
import { createTrayController } from './js/tray.js';

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
  const trayState = state.trayState;
  const runtime = {
    ...dom,
    state,
    storage,
    stats,
    get soundOn() { return soundOn; },
    get gridOn() { return gridOn; },
    get language() { return language; },
    get selectedData() { return selectedData; },
    set selectedData(value) { selectedData = value; },
    get image() { return image; },
    set image(value) { image = value; },
    get game() { return game; },
    set game(value) { game = value; },
    get raf() { return raf; },
    set raf(value) { raf = value; },
    get timerInterval() { return timerInterval; },
    set timerInterval(value) { timerInterval = value; },
    get saveTimer() { return saveTimer; },
    set saveTimer(value) { saveTimer = value; },
    get camera() { return camera; },
    get pointers() { return pointers; },
    get gesture() { return gesture; },
    set gesture(value) { gesture = value; },
    get drag() { return drag; },
    set drag(value) { drag = value; },
    get currentView() { return currentView; },
    get trayState() { return state.trayState; },
    get dockMomentum() { return state.dockMomentum; },
    get tr() { return tr; },
    get loadImage() { return loadImage; },
    get showView() { return showView; },
    get openModal() { return openModal; },
    get toast() { return toast; },
    get fitBoard() { return fitBoard; },
    get requestRender() { return requestRender; },
  };
  const renderer = createRenderer(runtime);
  const {
    drawHero,
    drawDockPiece,
    resize,
    screenToWorld,
    requestRender,
    render,
    fitBoard,
    fitAll,
    zoomAt,
    hitPiece,
  } = renderer;
  runtime.drawDockPiece = drawDockPiece;
  const gameController = createGameController(runtime);
  Object.assign(runtime, gameController);
  const {
    createGame,
    restoreGame,
    serialGame,
    groupMembers,
    connectedCount,
    updateHUD,
    startClock,
    stopClock,
    queueSave,
    bringGroupFront,
    trySnap,
    afterSnap,
    playClick,
    finishGame,
    shuffle,
    formatTime,
  } = gameController;
  const trayController = createTrayController(runtime);
  Object.assign(runtime, trayController);
  const {
    buildDock,
    refreshDockCount,
    releaseFromTray,
    returnGroupToTray,
    returnAllLoose,
    dockTopY,
    setDockDroppable,
    snapPreviewPos,
    abortCarry,
    abortPeel,
    attachTrayGesture,
  } = trayController;
  const languageService = createI18n(runtime);
  const tr = languageService.tr;
  const applyLanguage = next => {
    languageService.applyLanguage(next);
    language = state.language;
    updateHUD();
    buildDock();
  };

  function showView(name){currentView=name;if(name!=='game'){if(trayState.mode==='carry')abortCarry();else if(trayState.mode==='peel')abortPeel()}els.home.classList.toggle('active',name==='home');els.game.classList.toggle('active',name==='game');$$('.game-only').forEach(e=>e.classList.toggle('hidden',name!=='game'));if(name==='game'){resize();startClock()}else stopClock()}
  function openModal(el,on=true){el.classList.toggle('open',on);el.setAttribute('aria-hidden',String(!on))}
  function toast(msg){const t=els.toast;t.textContent=tr(msg);t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),2200)}
  function updateHome(){ $('#statSolved').textContent=stats.solved||0; $('#statTime').textContent=stats.seconds<3600?`${Math.round(stats.seconds/60)}m`:`${(stats.seconds/3600).toFixed(1)}h`; storage.getCurrent().then(v=>$('#continueBtn').classList.toggle('hidden',!v)); }
  function updateSettings(){ state.soundOn=soundOn;state.gridOn=gridOn;state.language=language;$('#menuSound').checked=soundOn;$('#menuGrid').checked=gridOn;$('#languageSelect').value=language;$('#soundBtn').classList.toggle('muted',!soundOn);storage.saveSettings({sound:soundOn,grid:gridOn,language});if(game){game.showGrid=gridOn;requestRender()}}

  function loadSelected(data,aspect){selectedData=data;els.imagePreview.src=data;els.drop.classList.add('has-image');els.start.disabled=false;if(aspect)updateDifficultyCounts(aspect);else loadImage(data).then(im=>updateDifficultyCounts(im.width/im.height))}
  function readFile(file){if(!file)return;if(file.size>25*1024*1024){toast('That image is larger than 25 MB');return}const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const max=1800,scale=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);loadSelected(c.toDataURL('image/jpeg',.9),im.width/im.height)};im.src=r.result};r.readAsDataURL(file)}
  function loadImage(data){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=data})}
  function updateDifficultyCounts(aspect){$$('#difficultyOptions label').forEach(label=>{const input=label.querySelector('input'),target=+input.value,[cols,rows]=chooseGrid(target,aspect),actual=cols*rows;label.querySelector('b').textContent=actual;label.title=`${cols} × ${rows} (${actual} ${tr('pieces')})`})}
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
