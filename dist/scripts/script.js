$(function () {
  // Animacja hero – dodaj klasę, gdy sekcja jest w kadrze
  const $hero = $('#welcome_section');
  function revealHero() { $hero.addClass('animate'); }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { revealHero(); io.unobserve(e.target); } });
    }, { threshold: 0.45 });
    io.observe($hero[0]);
  } else {
    revealHero();
  }
});

$(function () {
  const $btn = $('#hamburger');
  const $menu = $('#nav_menu');

  function closeMenu() {
    $btn.removeClass('open').attr('aria-expanded', 'false');
  }

  $btn.on('click', function (e) {
    e.stopPropagation();
    const isOpen = $btn.toggleClass('open').hasClass('open');
    $btn.attr('aria-expanded', String(isOpen));
    if (isOpen) $menu.find('a').first().trigger('focus');
  });

  // Zamknij po kliknięciu linku
  $menu.on('click', 'a', closeMenu);

  // Zamknij po kliknięciu poza obszarem
  $(document).on('click', function (e) {
    if (!$(e.target).closest('#header_right').length) closeMenu();
  });

  // Zamknij po ESC
  $(document).on('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });
});

$(function () {
  // Ustaw zmienną CSS z wysokością headera i aktualizuj przy zmianach
  const header = document.querySelector('header');
  const setHeaderH = () => {
    document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  };
  setHeaderH();

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(setHeaderH);
    ro.observe(header);
  } else {
    $(window).on('resize orientationchange', setHeaderH);
  }
});

$(function () {
  // Stagger reveal kart w „Nasze funkcje”
  const $items = $('#features_section li');
  if ($items.length) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            obs.unobserve(e.target);
          }
        });
      }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
      $items.each((_, el) => io.observe(el));
    } else {
      $items.addClass('visible');
    }
  }
});

$(function () {
  // Interaktywne panele w „Nasze funkcje”
  const $section = $('#features_section');
  const $items = $section.find('ul > li.feature-link');
  const $panels = $section.find('.feature-panel');

  if (!$section.length || !$items.length || !$panels.length) return;

  function showPanel(id) {
    $items.removeClass('is-active').filter(`[data-panel="${id}"]`).addClass('is-active');
    $panels.removeClass('active');
    const $p = $panels.filter('#' + id).addClass('active');
  }

  // Start: pokaż pierwszy
  showPanel($items.first().data('panel'));

  // Hover/focus
  $items.on('mouseenter focusin', function () {
    showPanel($(this).data('panel'));
  });

  // Enter/Space klawiaturą
  $items.on('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showPanel($(this).data('panel'));
    }
    // Strzałki: nawigacja między elementami
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const i = $items.index(this);
      $items.eq(Math.min(i + 1, $items.length - 1)).trigger('focus');
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = $items.index(this);
      $items.eq(Math.max(i - 1, 0)).trigger('focus');
    }
  });
});