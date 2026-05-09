/* =========================================================
   WOOO — Création de partie
   ---------------------------------------------------------
   Page UNIQUE :
   - Pseudo (mise à jour live du titre des thèmes)
   - Avatar
   - Liste des 7 thèmes affichée dès le chargement (3 cochés au hasard)
   - Possibilité d'ajouter un thème custom (overlay)
   - Un seul bouton final "C'est parti avec X thèmes !"
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo create.js] version 4 chargée ✅');

  const $ = (id) => document.getElementById(id);

  // ÉLÉMENTS
  const btnBack         = $('btn-back');
  const pseudoInput     = $('pseudo-input');
  const avatarPicker    = $('avatar-picker');
  const themesTitle     = $('themes-title');
  const themesList      = $('themes-list');
  const btnAddTheme     = $('btn-add-theme');
  const btnLaunch       = $('btn-launch');
  const themeCount      = $('theme-count');

  // OVERLAY thème custom
  const customOverlay   = $('custom-overlay');
  const customInput     = $('custom-theme-input');
  const customHint      = $('custom-theme-hint');
  const btnAddCustom    = $('btn-add-custom');
  const btnBackCustom   = $('btn-back-custom');


  // ======= CATALOGUE DE THÈMES =======
  const THEME_CATALOG = [
    'Ta préférée all-time',
    'De l\'adolescence',
    'Pour s\'ambiancer',
    'Qui te fait saigner des oreilles',
    'Que tu n\'assumes pas',
    'Qui te fait pleurer',
    'Pour partir en vacances',
  ];


  // ======= ÉTAT =======
  let selectedAvatar = 1;
  // Thèmes : 3 du catalogue cochés au hasard, les autres décochés
  // Possibilité d'ajouter des thèmes custom (en tête de liste)
  let themes = [];


  // ======= UTILITAIRE : tirage aléatoire =======
  function pickRandomIndices(max, n) {
    const all = Array.from({ length: max }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, n);
  }


  // ======= INIT THÈMES =======
  function initThemes() {
    const indicesAleatoires = pickRandomIndices(THEME_CATALOG.length, 3);
    themes = THEME_CATALOG.map((name, i) => ({
      name,
      custom: false,
      checked: indicesAleatoires.includes(i),
    }));
    console.log('[Wooo] thèmes initialisés :', themes);
  }


  // ======= RENDU AVATARS =======
  function renderAvatars() {
    const colors = (Wooo.config && Wooo.config.PLAYER_COLORS) || [];
    avatarPicker.innerHTML = Array.from({ length: 8 }, (_, i) => {
      const num = i + 1;
      const bg = colors[i % colors.length];
      return `
        <li class="avatar-grid__item ${num === selectedAvatar ? 'is-selected' : ''}"
            data-avatar="${num}"
            style="background: ${bg}">
          <img src="assets/avatar${num}.png" alt="Avatar ${num}" />
        </li>
      `;
    }).join('');
  }

  avatarPicker.addEventListener('click', (e) => {
    const item = e.target.closest('.avatar-grid__item');
    if (!item) return;
    selectedAvatar = parseInt(item.dataset.avatar, 10);
    avatarPicker.querySelectorAll('.avatar-grid__item').forEach(el => {
      el.classList.toggle('is-selected', parseInt(el.dataset.avatar, 10) === selectedAvatar);
    });
  });


  // ======= RENDU THÈMES =======
  function renderThemes() {
    console.log('[Wooo] renderThemes — nombre :', themes.length);
    themesList.innerHTML = themes.map((t, idx) => `
      <li>
        <button type="button" class="themed-check ${t.checked ? 'is-checked' : ''}" data-idx="${idx}">
          <span class="themed-check__label">${escapeHtml(t.name)}</span>
          <span class="themed-check__box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          </span>
        </button>
      </li>
    `).join('');
    updateLaunchButton();
  }

  themesList.addEventListener('click', (e) => {
    const btn = e.target.closest('.themed-check');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const willCheck = !themes[idx].checked;
    // Limite à 6 cochés
    if (willCheck) {
      const checkedCount = themes.filter(t => t.checked).length;
      if (checkedCount >= 6) {
        btn.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
          { duration: 200 }
        );
        return;
      }
    }
    themes[idx].checked = willCheck;
    btn.classList.toggle('is-checked', willCheck);
    updateLaunchButton();
  });


  // ======= MISE À JOUR DU BOUTON LANCER =======
  function updateLaunchButton() {
    const checked = themes.filter(t => t.checked).length;
    const pseudoOk = pseudoInput.value.trim().length >= 2;
    themeCount.textContent = checked;
    btnLaunch.disabled = !(pseudoOk && checked >= 3 && checked <= 6);
  }


  // ======= MISE À JOUR LIVE DU TITRE DES THÈMES SELON LE PRÉNOM =======
  pseudoInput.addEventListener('input', () => {
    const pseudo = pseudoInput.value.trim();
    if (pseudo.length >= 2) {
      themesTitle.textContent = `OK ${pseudo}, on a choisi quelques thèmes pour toi, change les si tu veux !`;
    } else {
      themesTitle.textContent = `OK, on a choisi quelques thèmes pour toi, change les si tu veux !`;
    }
    updateLaunchButton();
  });


  // ======= OVERLAY THÈME CUSTOM =======
  btnAddTheme.addEventListener('click', () => {
    customInput.value = '';
    customHint.textContent = '0 / 40';
    btnAddCustom.disabled = true;
    customOverlay.hidden = false;
    setTimeout(() => customInput.focus(), 100);
  });

  customInput.addEventListener('input', () => {
    const val = customInput.value.trim();
    customHint.textContent = `${val.length} / 40`;
    btnAddCustom.disabled = (val.length < 2 || val.length > 40);
  });

  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnAddCustom.disabled) {
      e.preventDefault();
      addCustomTheme();
    }
  });

  btnAddCustom.addEventListener('click', addCustomTheme);

  function addCustomTheme() {
    const val = customInput.value.trim();
    if (val.length < 2 || val.length > 40) return;
    // Vérifier qu'on n'est pas à la limite max cochés
    const checkedCount = themes.filter(t => t.checked).length;
    const willCheck = checkedCount < 6;
    themes.unshift({ name: val, custom: true, checked: willCheck });
    renderThemes();
    closeCustomOverlay();
  }

  function closeCustomOverlay() {
    customOverlay.hidden = true;
  }

  btnBackCustom.addEventListener('click', closeCustomOverlay);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !customOverlay.hidden) closeCustomOverlay();
  });


  // ======= LANCEMENT DE LA PARTIE =======
  btnLaunch.addEventListener('click', async () => {
    const pseudo = pseudoInput.value.trim();
    const chosen = themes.filter(t => t.checked).map(t => t.name);

    if (pseudo.length < 2 || chosen.length < 3 || chosen.length > 6) return;

    btnLaunch.disabled = true;
    btnLaunch.textContent = 'Création…';

    try {
      const partie = await Wooo.api.createPartie(chosen, 'musique');
      const joueur = await Wooo.api.addJoueur(partie.id, pseudo, true, selectedAvatar);
      Wooo.session.save({
        partie_id:  partie.id,
        pin_code:   partie.pin_code,
        themes:     partie.themes,
        is_creator: true,
        joueur_id:  joueur.id,
        pseudo:     pseudo,
        avatar:     selectedAvatar,
      });
      window.location.href = 'search.html?theme=0';
    } catch (err) {
      console.error(err);
      btnLaunch.disabled = false;
      btnLaunch.innerHTML = `C'est parti avec <span id="theme-count">${chosen.length}</span> thèmes !`;
      alert('Oups : ' + err.message);
    }
  });


  // ======= RETOUR =======
  btnBack.addEventListener('click', () => {
    window.location.href = 'index.html';
  });


  // ======= UTILITAIRE =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  initThemes();
  renderAvatars();
  renderThemes();

})();
