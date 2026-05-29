// ============================================================
//  SDS.LV — kopīgs JavaScript visām lapām
// ============================================================
(function () {
  // Mobilā izvēlne (hamburgers)
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('is-open');
      toggle.classList.toggle('is-active');
    });
    // Aizvērt mobilo izvēlni pēc klikšķa uz parastas saites
    nav.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.classList.remove('is-active');
      })
    );
  }

  // Dropdown ("Datori" / "Pakalpojumi") — klikšķis atver/aizver VISĀS ierīcēs
  document.querySelectorAll('.nav__droptoggle').forEach(btn =>
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const drop = btn.parentElement;
      const wasOpen = drop.classList.contains('is-open');
      // aizver visas pārējās
      document.querySelectorAll('.nav__drop').forEach(d => d.classList.remove('is-open'));
      if (!wasOpen) drop.classList.add('is-open');
    })
  );

  // Aizvērt dropdown, klikšķinot ārpus tā
  document.addEventListener('click', e => {
    if (!e.target.closest('.nav__drop')) {
      document.querySelectorAll('.nav__drop').forEach(d => d.classList.remove('is-open'));
    }
  });

  // Header ēna ritinot
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('is-scrolled', window.scrollY > 10);
    });
  }
})();
