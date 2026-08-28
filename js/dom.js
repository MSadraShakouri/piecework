export function createDom(documentRef = globalThis.document) {
  const $ = selector => documentRef.querySelector(selector);
  const $$ = selector => [...documentRef.querySelectorAll(selector)];
  const els = {
    home: $('#homeView'),
    game: $('#gameView'),
    canvas: $('#puzzleCanvas'),
    hero: $('#heroCanvas'),
    setup: $('#setupModal'),
    menu: $('#sideMenu'),
    complete: $('#completeModal'),
    preview: $('#previewOverlay'),
    file: $('#fileInput'),
    drop: $('#imageDrop'),
    imagePreview: $('#imagePreview'),
    start: $('#startBtn'),
    fullPreview: $('#fullPreview'),
    completeImage: $('#completeImage'),
    toast: $('#toast'),
  };

  return {
    document: documentRef,
    $, 
    $$,
    els,
    ctx: els.canvas.getContext('2d'),
    hctx: els.hero.getContext('2d'),
  };
}
