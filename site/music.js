(() => {
  const music = document.querySelector('#background-music');
  const controls = document.querySelectorAll('.music-toggle');
  if (!music || !controls.length) return;

  const preferenceKey = 'lingji-background-music';
  const positionKey = 'lingji-background-music-position';
  let shouldPlay = sessionStorage.getItem(preferenceKey) !== 'paused';
  const savedPosition = Number(sessionStorage.getItem(positionKey));

  const updateControls = () => {
    const playing = !music.paused;
    controls.forEach((control) => {
      control.setAttribute('aria-pressed', String(playing));
      control.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
      control.title = playing ? '暂停背景音乐' : '播放背景音乐';
      control.textContent = playing ? '♫' : '♩';
    });
  };

  const restorePosition = () => {
    if (Number.isFinite(savedPosition) && savedPosition > 0 && savedPosition < music.duration) music.currentTime = savedPosition;
  };

  const playMusic = async () => {
    shouldPlay = true;
    sessionStorage.setItem(preferenceKey, 'playing');
    try {
      await music.play();
    } catch {
      // Browsers can require a user gesture before allowing audible autoplay.
    }
    updateControls();
  };

  music.volume = 0.45;
  if (music.readyState >= 1) restorePosition();
  else music.addEventListener('loadedmetadata', restorePosition, { once: true });
  if (shouldPlay) void playMusic();
  document.addEventListener('pointerdown', () => { if (shouldPlay) void playMusic(); }, { once: true, passive: true });
  document.addEventListener('keydown', () => { if (shouldPlay) void playMusic(); }, { once: true });
  music.addEventListener('play', updateControls);
  music.addEventListener('pause', updateControls);

  controls.forEach((control) => control.addEventListener('click', () => {
    if (music.paused) void playMusic();
    else {
      shouldPlay = false;
      sessionStorage.setItem(preferenceKey, 'paused');
      music.pause();
    }
  }));

  window.addEventListener('pagehide', () => {
    if (shouldPlay) sessionStorage.setItem(positionKey, String(music.currentTime));
  });
  updateControls();
})();
