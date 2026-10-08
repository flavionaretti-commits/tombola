/* TOMBOLA! – estrazioni casuali senza ripetizioni. Nessuna dipendenza esterna. */
(() => {
  'use strict';
  const STORE = 'tombola-app-v1';
  const $ = (id) => document.getElementById(id);
  const board = $('board');
  const drawButton = $('drawButton');
  const machineButton = $('machineButton');
  const undoButton = $('undoButton');
  const resetButton = $('resetButton');
  const themeButton = $('themeButton');
  const soundButton = $('soundButton');
  const fullscreenButton = $('fullscreenButton');
  const resultBall = $('resultBall');
  const resultNumber = $('resultNumber');
  const resultSubtitle = $('resultSubtitle');
  const announcement = $('screenReaderAnnouncement');
  const scene = $('machineScene');
  const resetDialog = $('resetDialog');
  const helpDialog = $('helpDialog');
  let drawing = false;
  let toastTimer = null;
  let audioContext = null;
  const motionReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const cells = [];

  function restore() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { raw = {}; }
    const unique = new Set();
    const drawn = Array.isArray(raw.drawn) ? raw.drawn.filter(n => {
      if (!Number.isInteger(n) || n < 1 || n > 90 || unique.has(n)) return false;
      unique.add(n); return true;
    }) : [];
    return { drawn, theme: raw.theme === 'day' ? 'day' : 'night', sound: raw.sound !== false };
  }
  const state = restore();
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* app still playable without persistent storage */ }
  }

  for (let n = 1; n <= 90; n++) {
    const el = document.createElement('div');
    el.className = 'number-cell';
    el.textContent = String(n);
    el.setAttribute('role', 'gridcell');
    el.setAttribute('aria-label', `Numero ${n}, da estrarre`);
    el.setAttribute('aria-selected', 'false');
    board.appendChild(el);
    cells.push(el);
  }

  function render({ newest = null, announce = false } = {}) {
    const drawn = new Set(state.drawn);
    const latest = state.drawn.at(-1) ?? null;
    for (let i = 0; i < 90; i++) {
      const n = i + 1;
      const selected = drawn.has(n);
      cells[i].classList.toggle('is-drawn', selected);
      cells[i].classList.toggle('is-latest', n === latest);
      cells[i].setAttribute('aria-selected', String(selected));
      cells[i].setAttribute('aria-label', `Numero ${n}, ${selected ? (n === latest ? 'ultimo estratto' : 'estratto') : 'da estrarre'}`);
      if (newest === n) {
        cells[i].classList.remove('just-drawn');
        void cells[i].offsetWidth;
        cells[i].classList.add('just-drawn');
        setTimeout(() => cells[i].classList.remove('just-drawn'), 850);
      }
    }
    $('drawCount').textContent = String(state.drawn.length);
    resultNumber.textContent = latest === null ? '?' : String(latest);
    resultBall.classList.toggle('has-result', latest !== null);
    resultBall.classList.toggle('finished', state.drawn.length === 90);
    if (state.drawn.length === 90) {
      resultSubtitle.textContent = 'Tutti i numeri estratti!';
    } else if (latest !== null) {
      resultSubtitle.textContent = state.drawn.length === 1 ? 'Il primo della serata!' : 'La fortuna ha scelto…';
    } else {
      resultSubtitle.textContent = 'Pronti a giocare?';
    }
    const history = $('historyNumbers');
    history.replaceChildren();
    if (state.drawn.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'empty-history';
      empty.textContent = 'Nessun numero ancora estratto';
      history.appendChild(empty);
    } else {
      state.drawn.slice(-7).reverse().forEach(n => {
        const chip = document.createElement('span');
        chip.className = 'history-chip';
        chip.textContent = n;
        chip.setAttribute('aria-label', `Estratto ${n}`);
        history.appendChild(chip);
      });
    }
    const ended = state.drawn.length === 90;
    drawButton.disabled = drawing || ended;
    machineButton.disabled = drawing || ended;
    undoButton.disabled = drawing || state.drawn.length === 0;
    resetButton.disabled = drawing || state.drawn.length === 0;
    $('drawButtonLabel').textContent = drawing ? 'L’URNA STA GIRANDO…' : ended ? 'PARTITA COMPLETATA' : 'ESTRAI UN NUMERO';
    $('spinningText').innerHTML = drawing
      ? '<span class="tiny-sparkle">✦</span> LE PALLINE SI MESCOLANO… <span class="tiny-sparkle">✦</span>'
      : ended ? '<span class="tiny-sparkle">✦</span> TUTTI I 90 NUMERI ESTRATTI <span class="tiny-sparkle">✦</span>'
      : '<span class="tiny-sparkle">✦</span> TOCCA L’URNA O PREMI ESTRAI <span class="tiny-sparkle">✦</span>';
    if (announce) announcement.textContent = latest === null ? 'Tabellone azzerato' : `Estratto il numero ${latest}. ${state.drawn.length} numeri su 90.`;
  }

  function setTheme(mode) {
    state.theme = mode;
    document.body.dataset.theme = mode;
    themeButton.querySelector('use').setAttribute('href', mode === 'night' ? '#i-sun' : '#i-moon');
    themeButton.setAttribute('aria-label', mode === 'night' ? 'Passa alla modalità giorno' : 'Passa alla modalità notte');
    persist();
  }
  function setSound(enabled) {
    state.sound = enabled;
    soundButton.querySelector('use').setAttribute('href', enabled ? '#i-volume' : '#i-volume-off');
    soundButton.classList.toggle('is-off', !enabled);
    soundButton.setAttribute('aria-label', enabled ? 'Disattiva suoni' : 'Attiva suoni');
    persist();
  }
  function randomIndex(size) {
    if (globalThis.crypto && typeof crypto.getRandomValues === 'function') {
      const data = new Uint32Array(1);
      const limit = Math.floor(4294967296 / size) * size;
      do { crypto.getRandomValues(data); } while (data[0] >= limit);
      return data[0] % size;
    }
    return Math.floor(Math.random() * size);
  }
  function randomRemainingNumber() {
    const used = new Set(state.drawn);
    const left = [];
    for (let i = 1; i <= 90; i++) if (!used.has(i)) left.push(i);
    return left[randomIndex(left.length)];
  }
  function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  /* Audio synthesizzato con Web Audio: niente file da scaricare, funziona anche offline. */
  function getAudio() {
    if (!state.sound) return null;
    try {
      const Constructor = window.AudioContext || window.webkitAudioContext;
      if (!Constructor) return null;
      if (!audioContext) audioContext = new Constructor();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return audioContext;
    } catch { return null; }
  }
  function tone(freq, start, duration, kind = 'sine', gainAmount = .15) {
    const ac = getAudio();
    if (!ac) return;
    const osc = ac.createOscillator();
    const volume = ac.createGain();
    osc.type = kind;
    osc.frequency.setValueAtTime(freq, start);
    volume.gain.setValueAtTime(.001, start);
    volume.gain.exponentialRampToValueAtTime(gainAmount, start + .012);
    volume.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(volume).connect(ac.destination);
    osc.start(start); osc.stop(start + duration + .03);
  }
  function clack(amount = .14) {
    const ac = getAudio();
    if (!ac) return;
    const now = ac.currentTime;
    tone(210 + Math.random() * 95, now, .072, 'triangle', amount);
    tone(610 + Math.random() * 150, now + .006, .037, 'square', amount * .13);
  }
  function extractionSound() {
    const ac = getAudio(); if (!ac) return;
    const at = ac.currentTime;
    tone(380,at,.24,'triangle',.13);
    tone(575,at+.08,.31,'sine',.19);
    tone(790,at+.17,.46,'sine',.23);
    tone(1185,at+.20,.35,'sine',.09);
  }
  function smallSound(down = true) {
    const ac = getAudio(); if (!ac) return;
    const at = ac.currentTime;
    tone(down ? 530 : 380,at,.13,'sine',.13);
    tone(down ? 360 : 580,at+.09,.19,'sine',.15);
  }
  let rattles = [];
  function startRattle() {
    clack(.23);
    for (let i = 0; i < 13; i++) {
      rattles.push(setTimeout(() => { if (drawing) clack(i % 3 === 0 ? .23 : .13); }, 115 + i * 105));
    }
  }
  function clearRattle() { rattles.forEach(clearTimeout); rattles = []; }

  async function flyBall(n) {
    if (motionReduced || !Element.prototype.animate) return;
    const machine = $('lotteryMachine').getBoundingClientRect();
    const destination = resultBall.getBoundingClientRect();
    const startX = machine.left + machine.width * .46;
    const startY = machine.top + machine.height * .44;
    const endX = destination.left + destination.width * .5;
    const endY = destination.top + destination.height * .5;
    const orb = document.createElement('div');
    orb.className = 'flying-ball';
    orb.textContent = n;
    orb.style.left = `${startX-22.5}px`;
    orb.style.top = `${startY-22.5}px`;
    document.body.appendChild(orb);
    try {
      const animation = orb.animate([
        {transform:'translate(0,0) scale(.32) rotate(-180deg)',opacity:.2,offset:0},
        {transform:`translate(${(endX-startX)*.47}px,${(endY-startY)*.11-72}px) scale(1.3) rotate(105deg)`,opacity:1,offset:.45},
        {transform:`translate(${endX-startX}px,${endY-startY}px) scale(${destination.width/45*.76}) rotate(360deg)`,opacity:1,offset:1}
      ],{duration:560,easing:'cubic-bezier(.25,.8,.35,1)',fill:'forwards'});
      await animation.finished;
    } catch { /* animation interrupted */ }
    orb.remove();
  }
  function resultPop() {
    resultBall.classList.remove('reveal');
    void resultBall.offsetWidth;
    resultBall.classList.add('reveal');
    setTimeout(() => resultBall.classList.remove('reveal'), 700);
  }
  async function draw() {
    if (drawing || state.drawn.length >= 90) return;
    drawing = true;
    getAudio();
    scene.classList.add('is-spinning');
    render();
    startRattle();
    const n = randomRemainingNumber();
    await delay(motionReduced ? 230 : 1500);
    clearRattle();
    scene.classList.remove('is-spinning');
    await flyBall(n);
    state.drawn.push(n);
    persist();
    drawing = false;
    render({newest:n,announce:true});
    resultPop();
    extractionSound();
    if (state.drawn.length === 90) {
      showerConfetti();
      showToast('Tombola completa! Sono usciti tutti i 90 numeri.');
    }
  }
  function undo() {
    if (drawing || state.drawn.length === 0) return;
    const removed = state.drawn.pop();
    persist(); render({announce:true}); smallSound();
    showToast(`Numero ${removed} annullato: torna disponibile.`);
  }
  function reset() {
    if (drawing || state.drawn.length === 0) return;
    state.drawn.length = 0;
    persist(); render({announce:true}); smallSound(false);
    showToast('Nuova partita! Tutti i numeri sono disponibili.');
  }
  function showToast(message) {
    const el = $('toast');
    clearTimeout(toastTimer);
    el.textContent = message;
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 3300);
  }
  function showerConfetti() {
    if (motionReduced) return;
    const layer = $('confettiLayer');
    layer.replaceChildren();
    const colors = ['#f2cb78','#fdf5de','#c7554c','#79ae9d','#db9bc6'];
    for (let i = 0; i < 100; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random()*100}%`;
      piece.style.top = `${-Math.random()*50}px`;
      piece.style.background = colors[i%colors.length];
      piece.style.animationDelay = `${Math.random()*.8}s`;
      piece.style.animationDuration = `${2.8+Math.random()*2.5}s`;
      piece.style.setProperty('--drift',`${(Math.random()-.5)*230}px`);
      piece.style.setProperty('--rot',`${(Math.random()-.5)*1450}deg`);
      layer.appendChild(piece);
    }
    setTimeout(() => layer.replaceChildren(), 5500);
  }

  function openDialog(el) {
    if (typeof el.showModal === 'function') el.showModal();
    else el.setAttribute('open','');
  }
  function closeDialog(el) {
    if (typeof el.close === 'function') el.close();
    else el.removeAttribute('open');
  }
  function isDialogOpen() { return resetDialog.open || helpDialog.open; }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        showToast('Su iPad: Condividi → Aggiungi alla schermata Home per usarla a pieno schermo.');
      }
    } catch {
      showToast('Schermo intero non disponibile in questo browser.');
    }
  }

  drawButton.addEventListener('click',draw);
  machineButton.addEventListener('click',draw);
  undoButton.addEventListener('click',undo);
  resetButton.addEventListener('click',() => { if (!drawing) openDialog(resetDialog); });
  $('cancelReset').addEventListener('click',() => closeDialog(resetDialog));
  $('confirmReset').addEventListener('click',() => { closeDialog(resetDialog); reset(); });
  $('helpButton').addEventListener('click',() => openDialog(helpDialog));
  $('closeHelp').addEventListener('click',() => closeDialog(helpDialog));
  themeButton.addEventListener('click',() => setTheme(state.theme === 'night' ? 'day' : 'night'));
  soundButton.addEventListener('click',() => { setSound(!state.sound); if (state.sound) { getAudio(); smallSound(false); } });
  fullscreenButton.addEventListener('click',toggleFullscreen);
  document.addEventListener('fullscreenchange',() => {
    const on = !!document.fullscreenElement;
    fullscreenButton.querySelector('use').setAttribute('href',on?'#i-minimize':'#i-expand');
    fullscreenButton.setAttribute('aria-label',on?'Esci da schermo intero':'Schermo intero');
  });
  document.addEventListener('keydown',event => {
    const target = event.target;
    if (isDialogOpen() || event.altKey || event.ctrlKey || event.metaKey || /^(input|textarea|select)$/i.test(target?.tagName || '')) return;
    const key = event.key.toLowerCase();
    if (key === 'e' || (key === ' ' && !['BUTTON','A'].includes(target?.tagName))) {
      event.preventDefault(); draw();
    } else if (key === 'z') {
      event.preventDefault(); undo();
    } else if (key === 'f') {
      event.preventDefault(); toggleFullscreen();
    } else if (key === 'm') {
      event.preventDefault(); setSound(!state.sound);
    }
  });

  setTheme(state.theme);
  setSound(state.sound);
  render();
  if ('serviceWorker' in navigator && /^(https?:)$/.test(location.protocol)) {
    window.addEventListener('load',() => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
