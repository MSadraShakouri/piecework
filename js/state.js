export const supportedLanguages = Object.freeze(['en', 'fa', 'ar', 'zh-CN']);

export function detectLanguage(settings = {}, browserLanguage = globalThis.navigator?.language || 'en') {
  const normalized = browserLanguage.toLowerCase();
  const detected = /^(fa)/.test(normalized)
    ? 'fa'
    : /^(ar)/.test(normalized)
      ? 'ar'
      : /^(zh)/.test(normalized)
        ? 'zh-CN'
        : 'en';
  const preferred = settings.language || detected;
  return supportedLanguages.includes(preferred) ? preferred : 'en';
}

export function createState({ settings = {}, stats = {}, browserLanguage } = {}) {
  return {
    soundOn: settings.sound !== false,
    gridOn: settings.grid === true,
    language: detectLanguage(settings, browserLanguage),
    selectedData: null,
    image: null,
    game: null,
    raf: 0,
    timerInterval: null,
    saveTimer: null,
    camera: { x: 0, y: 0, scale: 1 },
    pointers: new Map(),
    gesture: null,
    drag: null,
    currentView: 'home',
    stats,
    trayState: {
      mode: 'idle',
      pointerId: -1,
      btn: null,
      piece: null,
      start: { x: 0, y: 0 },
      last: { x: 0, y: 0 },
      samples: [],
      vx: 0,
      vy: 0,
      pull: 0,
      lift: 0,
      rubber: 0,
      suppressClick: false,
      ghost: null,
      ghostX: 0,
      ghostY: 0,
      ghostK0: 1,
      slotCx: 0,
      slotCy: 0,
      carry: null,
      settleFx: null,
    },
    dockMomentum: { raf: 0 },
  };
}
