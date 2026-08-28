import { createBoardInput } from './js/board-input.js';
import { createDom } from './js/dom.js';
import { createGameController } from './js/game.js';
import { createI18n } from './js/i18n.js';
import { createRenderer } from './js/renderer.js';
import { createState } from './js/state.js';
import { createStorage } from './js/storage.js';
import { createTrayController } from './js/tray.js';
import { createUi } from './js/ui.js';

function startApp() {
  const dom = createDom();
  const storage = createStorage();
  const state = createState({
    settings: storage.loadSettings(),
    stats: storage.loadStats(),
  });
  const app = {
    ...dom,
    state,
    storage,
    version: null,
    stats: state.stats,
    get soundOn() {
      return state.soundOn;
    },
    set soundOn(value) {
      state.soundOn = value;
    },
    get gridOn() {
      return state.gridOn;
    },
    set gridOn(value) {
      state.gridOn = value;
    },
    get language() {
      return state.language;
    },
    set language(value) {
      state.language = value;
    },
    get selectedData() {
      return state.selectedData;
    },
    set selectedData(value) {
      state.selectedData = value;
    },
    get image() {
      return state.image;
    },
    set image(value) {
      state.image = value;
    },
    get game() {
      return state.game;
    },
    set game(value) {
      state.game = value;
    },
    get raf() {
      return state.raf;
    },
    set raf(value) {
      state.raf = value;
    },
    get timerInterval() {
      return state.timerInterval;
    },
    set timerInterval(value) {
      state.timerInterval = value;
    },
    get saveTimer() {
      return state.saveTimer;
    },
    set saveTimer(value) {
      state.saveTimer = value;
    },
    get camera() {
      return state.camera;
    },
    get pointers() {
      return state.pointers;
    },
    get gesture() {
      return state.gesture;
    },
    set gesture(value) {
      state.gesture = value;
    },
    get drag() {
      return state.drag;
    },
    set drag(value) {
      state.drag = value;
    },
    get currentView() {
      return state.currentView;
    },
    set currentView(value) {
      state.currentView = value;
    },
    get trayState() {
      return state.trayState;
    },
    get dockMomentum() {
      return state.dockMomentum;
    },
  };

  Object.assign(app, createRenderer(app));
  Object.assign(app, createGameController(app));
  Object.assign(app, createTrayController(app));

  const languageService = createI18n(app);
  app.tr = languageService.tr;
  app.applyLanguage = next => {
    languageService.applyLanguage(next);
    app.updateHUD();
    app.buildDock();
    app.updateVersionLabel?.();
  };

  const boardInput = createBoardInput(app);
  boardInput.bind();
  Object.assign(app, createUi(app));
  app.init();
}

startApp();
