(() => {
  const hero = document.querySelector('.hero');
  const loader = document.querySelector('.loader-stage');
  const terrain = document.querySelector('.philosophy');
  const header = document.querySelector('.header');
  const progressBar = document.querySelector('.reading-progress');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 800px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const activeScenes = new Set();
  const pointer = { x: 0, y: 0 };
  const drift = { x: 0, y: 0 };
  let frame = 0;
  let previousTime;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const css = (element, values) => {
    for (const [property, value] of Object.entries(values)) {
      element.style.setProperty(property, value);
    }
  };

  function renderHero(bounds, strength, delta) {
    const progress = clamp(-bounds.top / bounds.height, 0, 1);
    const ease = 1 - Math.exp(-delta / 85);
    drift.x += (pointer.x - drift.x) * ease;
    drift.y += (pointer.y - drift.y) * ease;

    css(hero, {
      '--lens-x': `${drift.x * -26 * strength}px`,
      '--lens-y': `${(progress * 248 - drift.y * 20) * strength}px`,
      '--lens-scale': 1 + progress * .12 * strength,
      '--overlay-x': `${drift.x * 35 * strength}px`,
      '--overlay-y': `${(progress * 96 + drift.y * 28) * strength}px`,
      '--overlay-angle': `${(progress * 22 + drift.x * 5) * strength}deg`,
      '--hero-copy-y': `${progress * -54 * strength}px`,
      '--cue-y': `${progress * 18}px`
    });
  }

  function renderLoader(bounds, height, strength) {
    const progress = clamp((height - bounds.top) / (height * .68), 0, 1);
    const remaining = (1 - progress) ** 2 * strength;

    css(loader, {
      '--loader-y': `${remaining * 45}px`,
      '--loader-angle': `${remaining * 14}deg`,
      '--loader-scale': 1 - remaining * .09
    });
  }

  function renderTerrain(bounds, height, strength) {
    const progress = clamp((height - bounds.top) / (bounds.height + height), 0, 1);

    css(terrain, {
      '--terrain-y': `${(progress - .5) * 260 * strength}px`,
      '--terrain-scale': 1 + progress * .09 * strength,
      '--terrain-copy-y': `${(.5 - progress) * 75 * strength}px`
    });
  }

  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }

  function render(time) {
    frame = 0;
    const height = window.innerHeight;
    const maxScroll = document.documentElement.scrollHeight - height;
    const position = Math.max(0, window.scrollY);
    const delta = clamp(time - (previousTime ?? time - 16), 1, 50);
    previousTime = time;

    // Measure every visible scene before writing styles for this frame.
    const bounds = new Map();
    if (!reducedMotion.matches) {
      for (const scene of activeScenes) bounds.set(scene, scene.getBoundingClientRect());
    }

    header.classList.toggle('is-scrolled', position > 110);
    progressBar.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, position / maxScroll) : 0})`;
    const strength = compact.matches ? .36 : 1;

    if (bounds.has(hero)) {
      renderHero(bounds.get(hero), strength, delta);
      if (Math.abs(pointer.x - drift.x) + Math.abs(pointer.y - drift.y) > .002) schedule();
    }
    if (bounds.has(loader)) renderLoader(bounds.get(loader), height, strength);
    if (bounds.has(terrain)) renderTerrain(bounds.get(terrain), height, strength);
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const scene = entry.target;
      scene.classList.toggle('media-in-view', entry.isIntersecting);
      if (entry.isIntersecting) activeScenes.add(scene);
      else activeScenes.delete(scene);
    }
    schedule();
  });

  function resetPointer() {
    pointer.x = 0;
    pointer.y = 0;
    schedule();
  }

  function updateMotionPreference() {
    observer.disconnect();
    activeScenes.clear();
    for (const scene of [hero, loader, terrain]) {
      scene.classList.remove('media-in-view');
      if (!reducedMotion.matches) observer.observe(scene);
    }
    resetPointer();
  }

  hero.addEventListener('pointermove', event => {
    if (reducedMotion.matches || !finePointer.matches || event.pointerType !== 'mouse') return;
    pointer.x = clamp(event.clientX / innerWidth * 2 - 1, -1, 1);
    pointer.y = clamp(event.clientY / innerHeight * 2 - 1, -1, 1);
    schedule();
  });
  hero.addEventListener('pointerleave', resetPointer);
  window.addEventListener('blur', resetPointer);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  reducedMotion.addEventListener('change', updateMotionPreference);

  // Details, font swaps and lazy images can change the reading progress at rest.
  new ResizeObserver(schedule).observe(document.body);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = undefined;
      drift.x = 0;
      drift.y = 0;
    }
    resetPointer();
  });

  if (!reducedMotion.matches && scrollY < 30) hero.classList.add('hero-intro');
  updateMotionPreference();
})();
