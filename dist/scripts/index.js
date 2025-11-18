// Futurystyczne “prestige” reveal: h1 najpierw, potem reszta z kaskadowym opóźnieniem
(function(){
  document.documentElement.classList.add('js');

  function lockAfterReveal(el){
    if (!el) return;
    const onDone = ()=>{
      el.classList.remove('reveal','in');
      el.classList.add('revealed');
      el.removeEventListener('animationend', onDone);
      el.removeEventListener('transitionend', onDone);
    };
    el.addEventListener('animationend', onDone, {once:true});
    el.addEventListener('transitionend', onDone, {once:true});
  }

  // Dodaj reveal do elementów w sekcjach Rules / Strategies / Games
  ['Rules','Strategies','Games'].forEach(id=>{
    const sec = document.getElementById(id);
    if (!sec) return;
    sec.querySelectorAll('h1, h2, p, ul, li, a').forEach(el=>{
      if (!el.classList.contains('reveal')) el.classList.add('reveal');
      if (el.tagName === 'H1' && !el.classList.contains('heading')) el.classList.add('heading');
    });
  });

  // Sekcje – heading najpierw, potem delikatna kaskada
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if (!entry.isIntersecting) return;
      const section = entry.target;

      // 1) H1 – start natychmiast
      const heading = section.querySelector('h1.heading.reveal');
      if (heading && !heading.classList.contains('in')){
        heading.style.setProperty('--d', '0ms');
        heading.classList.add('in');
        lockAfterReveal(heading);
      }

      // 2) Reszta – zaczyna się dopiero po chwili (elegancka orkiestracja)
      const rest = [...section.querySelectorAll('.reveal')].filter(el => el !== heading);
      const baseDelay = 420;          // ms po rozpoczęciu nagłówka
      const step = 90;                // ms między elementami
      rest.forEach((el, i)=>{
        if (!el.classList.contains('in')){
          el.style.setProperty('--d', `${baseDelay + step*i}ms`);
          requestAnimationFrame(()=> el.classList.add('in'));
          lockAfterReveal(el);
        }
      });

      io.unobserve(section);
    });
  }, {threshold: 0.35});

  document.querySelectorAll('.vp-section').forEach(sec=> io.observe(sec));

  // Slajdy consequence – jak wcześniej (zostają widoczne)
  const slidesWrap = document.querySelector('#consequence .slides-wrap');
  if (slidesWrap){
    slidesWrap.querySelectorAll('.slide').forEach(slide=>{
      const els = slide.querySelectorAll('h1, h2, p, ul, li, button, a');
      els.forEach(el=>{
        el.classList.add('reveal');
        if (el.tagName === 'H1') el.classList.add('heading');
      });
    });
  }

  // Przyciski nawigacji – jak wcześniej
  const nav = document.getElementById('navigation_buttons');
  if (nav){
    const ro = new ResizeObserver(()=>{
      nav.style.bottom = window.innerHeight < 560 ? '10px' : '20px';
    });
    ro.observe(document.body);
  }

  // Wolniejsze, dostojne przewijanie (zachowujemy Twoją logikę, dopieszczamy easing/czas)
  const sections = Array.from(document.querySelectorAll('.vp-section'));
  if (sections.length) {
    let animating = false;
    let currentIndex = 0;

    const getOffsets = () => sections.map(s => Math.round(window.scrollY + s.getBoundingClientRect().top));
    let offsets = getOffsets();

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const easeLux = t => (t<.5) ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; // zbliżony do var(--lux-ease)
    function toggleSnap(on){
      document.documentElement.style.scrollSnapType = on ? 'y mandatory' : 'none';
      document.body.style.scrollSnapType = on ? 'y mandatory' : 'none';
    }
    function nearestIndex(y=window.scrollY){
      let idx = 0, best = Infinity;
      for (let i=0;i<offsets.length;i++){
        const d = Math.abs(offsets[i] - y);
        if (d < best){ best = d; idx = i; } // FIX: nawiasy w if
      }
      return idx;
    }
    function animateTo(targetY, duration=1600){ // 1600 ms – bardziej dostojnie
      if (animating) return;
      animating = true;
      toggleSnap(false);
      const startY = window.scrollY;
      const delta = targetY - startY;
      const t0 = performance.now();
      function step(t){
        const p = Math.max(0, Math.min(1, (t - t0) / duration));
        const e = easeLux(p);
        window.scrollTo(0, Math.round(startY + delta * e));
        if (p < 1){
          requestAnimationFrame(step);
        } else {
          toggleSnap(true);
          animating = false;
          currentIndex = nearestIndex();
        }
      }
      requestAnimationFrame(step);
    }
    function go(dir){
      if (animating) return;
      offsets = getOffsets();
      currentIndex = nearestIndex();
      const next = clamp(currentIndex + dir, 0, sections.length - 1);
      if (next !== currentIndex) animateTo(offsets[next], 1600);
    }
    window.addEventListener('wheel', (e)=>{
      if (animating) { e.preventDefault(); return; }
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      go(e.deltaY > 0 ? 1 : -1);
    }, {passive:false});
    window.addEventListener('keydown', (e)=>{
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
      if (['PageDown','ArrowDown',' '].includes(e.key)){ e.preventDefault(); go(1); }
      else if (['PageUp','ArrowUp'].includes(e.key)){ e.preventDefault(); go(-1); }
    });
    window.addEventListener('resize', ()=>{
      offsets = getOffsets();
      currentIndex = nearestIndex();
    });
    currentIndex = nearestIndex();

    // === SCROLL DO SEKCJI Z PRZYCISKÓW LANDING ===
    function scrollToSection(id){
      const target = document.getElementById(id);
      if (!target) return;
      const y = window.scrollY + target.getBoundingClientRect().top;
      // jeśli mamy naszą custom animację – użyj jej
      animateTo(y, 1600);
    }

    const btnConsequence = document.getElementById('consequence-button');
    if (btnConsequence){
      btnConsequence.addEventListener('click', ()=> scrollToSection('consequence'));
    }
    const btnRules = document.getElementById('Landing-Rules');
    if (btnRules){
      btnRules.addEventListener('click', ()=> scrollToSection('Rules'));
    }
    const btnStrategies = document.getElementById('Landing-Strategies');
    if (btnStrategies){
      btnStrategies.addEventListener('click', ()=> scrollToSection('Strategies'));
    }
    const btnGames = document.getElementById('Landing-Games');
    if (btnGames){
      btnGames.addEventListener('click', ()=> scrollToSection('Games'));
    }
  }
})();