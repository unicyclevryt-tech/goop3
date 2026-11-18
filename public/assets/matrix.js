/* Goop Matrix background. Generated on load so index.html stays compact. */
(() => {
  'use strict';
  const rain = document.getElementById('goopBinaryRain');
  if (!rain) return;

  // Fixed seed: the streams don't jump to different positions on reload.
  let seed = 0x6A09E667;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const count = 56;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const column = document.createElement('span');
    column.className = 'goop-rain-column';
    const duration = 17 + random() * 6;
    const delay = -random() * duration;
    column.style.setProperty('--x', `${((i + .45 + (random() - .5) * .6) / count * 100).toFixed(3)}%`);
    column.style.setProperty('--duration2', `${duration.toFixed(2)}s`);
    column.style.setProperty('--lag2', `${delay.toFixed(2)}s`);
    column.style.setProperty('--bright', (0.35 + random() * .5).toFixed(2));
    // Compatibility with the original styling rules.
    column.style.setProperty('--duration', `${duration.toFixed(2)}s`);
    column.style.setProperty('--lag', `${delay.toFixed(2)}s`);
    const digits = [];
    for (let j = 0; j < 95; j++) digits.push(random() > .5 ? '1' : '0');
    column.textContent = digits.join('\n');
    fragment.appendChild(column);
  }
  rain.replaceChildren(fragment);

  const toggle = document.getElementById('matrixMotion');
  if (toggle) toggle.checked = true;
  const apply = () => {
    const enabled = !toggle || toggle.checked;
    document.body.classList.toggle('goop-motion-off', !enabled);
    for (const column of rain.children) {
      column.style.animationPlayState = enabled ? 'running' : 'paused';
    }
  };
  toggle?.addEventListener('change', apply);
  apply();
})();
