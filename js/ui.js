import { chooseGrid, sampleArtwork } from './puzzle.js';

export function createUi(app) {
  function showView(name) {
    app.currentView = name;
    if (name !== 'game') {
      if (app.trayState.mode === 'carry') app.abortCarry();
      else if (app.trayState.mode === 'peel') app.abortPeel();
    }
    app.els.home.classList.toggle('active', name === 'home');
    app.els.game.classList.toggle('active', name === 'game');
    app.$$('.game-only').forEach(element => {
      element.classList.toggle('hidden', name !== 'game');
    });
    if (name === 'game') {
      app.resize();
      app.startClock();
    } else {
      app.stopClock();
    }
  }

  function openModal(element, on = true) {
    element.classList.toggle('open', on);
    element.setAttribute('aria-hidden', String(!on));
  }

  function toast(message) {
    const element = app.els.toast;
    element.textContent = app.tr(message);
    element.classList.add('show');
    clearTimeout(element._timeout);
    element._timeout = setTimeout(() => element.classList.remove('show'), 2200);
  }

  function updateHome() {
    const { stats } = app;
    app.$('#statSolved').textContent = stats.solved || 0;
    app.$('#statTime').textContent = stats.seconds < 3600
      ? `${Math.round(stats.seconds / 60)}m`
      : `${(stats.seconds / 3600).toFixed(1)}h`;
    app.storage.getCurrent().then(value => {
      app.$('#continueBtn').classList.toggle('hidden', !value);
    });
  }

  function updateSettings() {
    app.$('#menuSound').checked = app.soundOn;
    app.$('#menuGrid').checked = app.gridOn;
    app.$('#languageSelect').value = app.language;
    app.$('#soundBtn').classList.toggle('muted', !app.soundOn);
    app.storage.saveSettings({
      sound: app.soundOn,
      grid: app.gridOn,
      language: app.language,
    });
    if (app.game) {
      app.game.showGrid = app.gridOn;
      app.requestRender();
    }
  }

  function loadSelected(data, aspect) {
    app.selectedData = data;
    app.els.imagePreview.src = data;
    app.els.drop.classList.add('has-image');
    app.els.start.disabled = false;
    if (aspect) updateDifficultyCounts(aspect);
    else app.loadImage(data).then(image => updateDifficultyCounts(image.width / image.height));
  }

  function readFile(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast('That image is larger than 25 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const max = 1800;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = app.document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        loadSelected(canvas.toDataURL('image/jpeg', 0.9), image.width / image.height);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function loadImage(data) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = data;
    });
  }

  function updateDifficultyCounts(aspect) {
    app.$$('#difficultyOptions label').forEach(label => {
      const input = label.querySelector('input');
      const target = +input.value;
      const [columns, rows] = chooseGrid(target, aspect);
      const actual = columns * rows;
      label.querySelector('b').textContent = actual;
      label.title = `${columns} × ${rows} (${actual} ${app.tr('pieces')})`;
    });
  }

  function bindEvents() {
    app.$('#newPuzzleBtn').onclick = () => openModal(app.els.setup, true);
    app.$('#menuNew').onclick = () => {
      openModal(app.els.menu, false);
      openModal(app.els.setup, true);
    };
    app.$('#sampleBtn').onclick = () => loadSelected(sampleArtwork());
    app.els.drop.onclick = () => app.els.file.click();
    app.els.file.onchange = event => readFile(event.target.files[0]);
    app.els.drop.addEventListener('dragover', event => {
      event.preventDefault();
      app.els.drop.style.borderColor = 'var(--red)';
    });
    app.els.drop.addEventListener('dragleave', () => {
      app.els.drop.style.borderColor = '';
    });
    app.els.drop.addEventListener('drop', event => {
      event.preventDefault();
      app.els.drop.style.borderColor = '';
      readFile(event.dataTransfer.files[0]);
    });
    app.els.start.onclick = () => {
      const count = +app.$('input[name=difficulty]:checked').value;
      openModal(app.els.setup, false);
      app.createGame(app.selectedData, count).catch(() => toast('Could not open that image'));
    };

    app.$$('[data-close="setup"]').forEach(button => {
      button.onclick = () => openModal(app.els.setup, false);
    });
    app.$('#menuBtn').onclick = () => openModal(app.els.menu, true);
    app.$$('[data-close="menu"]').forEach(button => {
      button.onclick = () => openModal(app.els.menu, false);
    });
    const goHome = () => {
      openModal(app.els.menu, false);
      showView('home');
      updateHome();
    };
    app.$('#brandBtn').onclick = goHome;
    app.$('#menuHome').onclick = goHome;
    app.$('#menuResume').onclick = () => openModal(app.els.menu, false);
    app.$('#menuReturnLoose').onclick = () => {
      openModal(app.els.menu, false);
      app.returnAllLoose();
    };
    app.$('#menuRestart').onclick = () => {
      openModal(app.els.menu, false);
      openModal(app.$('#resetModal'), true);
    };
    app.$('#cancelReset').onclick = () => openModal(app.$('#resetModal'), false);
    app.$$('[data-close="reset"]').forEach(button => {
      button.onclick = () => openModal(app.$('#resetModal'), false);
    });
    app.$('#confirmReset').onclick = () => {
      openModal(app.$('#resetModal'), false);
      app.shuffle();
    };

    app.$('#continueBtn').onclick = async () => {
      const saved = await app.storage.getCurrent();
      if (saved) await app.restoreGame(saved);
      else toast('No saved puzzle found');
    };
    app.$('#previewBtn').onclick = () => {
      if (!app.game) return;
      app.els.fullPreview.src = app.game.imageData;
      openModal(app.els.preview, true);
    };
    app.$('#closePreview').onclick = () => openModal(app.els.preview, false);
    app.els.preview.onclick = event => {
      if (event.target === app.els.preview) openModal(app.els.preview, false);
    };
    app.$('#zoomInBtn').onclick = () => app.zoomAt(1.2);
    app.$('#zoomOutBtn').onclick = () => app.zoomAt(0.82);
    app.$('#fitBtn').onclick = () => app.fitAll();
    app.$('#soundBtn').onclick = () => {
      app.soundOn = !app.soundOn;
      updateSettings();
    };
    app.$('#menuSound').onchange = event => {
      app.soundOn = event.target.checked;
      updateSettings();
    };
    app.$('#menuGrid').onchange = event => {
      app.gridOn = event.target.checked;
      updateSettings();
    };
    app.$('#languageSelect').onchange = event => {
      app.applyLanguage(event.target.value);
      updateSettings();
      if (app.selectedData) {
        app.loadImage(app.selectedData)
          .then(image => updateDifficultyCounts(image.width / image.height));
      }
    };
    app.$('#anotherBtn').onclick = () => {
      openModal(app.els.complete, false);
      app.selectedData = null;
      app.els.drop.classList.remove('has-image');
      app.els.start.disabled = true;
      showView('home');
      openModal(app.els.setup, true);
    };
    app.$('#backHomeBtn').onclick = () => {
      openModal(app.els.complete, false);
      showView('home');
      updateHome();
    };

    globalThis.addEventListener('resize', app.resize);
    app.document.addEventListener('visibilitychange', () => {
      if (app.document.hidden) {
        if (app.trayState.mode === 'carry') app.abortCarry();
        else if (app.trayState.mode === 'peel') app.abortPeel();
        app.queueSave();
        app.stopClock();
      } else if (app.currentView === 'game') {
        app.startClock();
      }
    });
  }

  function init() {
    app.drawHero();
    app.applyLanguage(app.language);
    updateSettings();
    updateHome();
    showView('home');
    if ('serviceWorker' in globalThis.navigator) {
      globalThis.addEventListener('load', () => {
        globalThis.navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
    bindEvents();
  }

  return {
    showView,
    openModal,
    toast,
    updateHome,
    updateSettings,
    loadSelected,
    readFile,
    loadImage,
    updateDifficultyCounts,
    bindEvents,
    init,
  };
}
