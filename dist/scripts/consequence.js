(function () {
  'use strict';

  const slides = Array.from(document.querySelectorAll('.slide'));
  if (!slides.length) return;

  // Ustaw tło z dist/img automatycznie wg ID (slajd1 -> Slajd1.png)
  slides.forEach(slide => {
    const num = (slide.id || '').match(/\d+$/)?.[0];
    if (num) {
      const png = `../../dist/img/Slajd${num}.png`;
      slide.style.setProperty('--slide-bg', `url('${png}')`);
    }
  });

  // Upewnij się, że treść ma „szklany” wrapper (bez podwójnego owijania)
  slides.forEach(slide => {
    if (!slide.querySelector('.slide-content')) {
      const box = document.createElement('div');
      box.className = 'slide-content';
      while (slide.firstChild) box.appendChild(slide.firstChild);
      slide.appendChild(box);
    }
  });

  // Przyciski nawigacji – utwórz, jeśli nie istnieją w HTML
  let nextBtn = document.getElementById('next_btn');
  let prevBtn = document.getElementById('prev_btn');
  if (!nextBtn || !prevBtn) {
    const nav = document.createElement('div');
    nav.id = 'navigation_buttons';
    prevBtn = document.createElement('button');
    nextBtn = document.createElement('button');
    prevBtn.id = 'prev_btn';
    nextBtn.id = 'next_btn';
    prevBtn.setAttribute('aria-label', 'Poprzedni slajd');
    nextBtn.setAttribute('aria-label', 'Następny slajd');
    prevBtn.textContent = '◀';
    nextBtn.textContent = '▶';
    nav.append(prevBtn, nextBtn);
    document.body.appendChild(nav);
  }

  let index = 0;

  function focusHeading(slideEl) {
    const heading = slideEl.querySelector('h1, h2, h3, [tabindex]');
    if (heading) heading.setAttribute('tabindex', '-1'), heading.focus();
  }

  function updateUI() {
    slides.forEach((s, i) => {
      const active = i === index;
      s.classList.toggle('active', active);
      s.setAttribute('aria-hidden', String(!active));
    });
    // Stan przycisków (brak zapętlenia)
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= slides.length - 1;

    // Dla dostępności – przenieś fokus do nagłówka aktywnego slajdu
    focusHeading(slides[index]);
  }

  function show(i) {
    if (i < 0 || i >= slides.length) return;
    index = i;
    updateUI();
  }

  function next() { show(index + 1); }
  function prev() { show(index - 1); }

  // Zdarzenia
  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);

  // Klawiatura: strzałki
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  // Start – pokaż pierwszy slajd
  show(0);
})();