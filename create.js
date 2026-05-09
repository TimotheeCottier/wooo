/* =========================================================
   WOOO — Création de partie
   ---------------------------------------------------------
   Flux :
   1) Étape 1 : pseudo + avatar
   2) Étape 2 : 6 thèmes pré-cochés (modifiables) + bouton "Créer thème personnalisé"
   3) Au clic "Je continue avec X thèmes" :
      - création partie en base (avec produit='musique')
      - inscription du créateur (is_creator=true)
      - sauvegarde session locale + ajout à l'historique
      - redirection vers invite.html (qui affiche le PIN à partager)
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo create.js] version 3 chargée ✅');

  const $ = (id) => document.getElementById(id);

  // ÉLÉMENTS COMMUNS
  const btnBack         = $('btn-back');
  const step1           = $('step-1');
  const step2           = $('step-2');
  const btnStep1Next    = $('btn-step1-continue');
  const btnStep2Next    = $('btn-step2-continue');

  // ÉTAPE 1
  const pseudoInput     = $('pseudo-input');
  const avatarPicker    = $('avatar-picker');

  // ÉTAPE 2
  const themesTitle     = $('themes-title');
  const themesList      = $('themes-list');
  const btnAddTheme     = $('btn-add-theme');
  const themeCount      = $('theme-count');

  // ÉTAPE 3 (création thème custom pleine page)
  const step3           = $('step-3');
  const btnStep3Add     = $('btn-step3-add');
  const customInput     = $('custom-theme-input');
  const customHint      = $('custom-theme-hint');


  // ======= CATALOGUE DE THÈMES =======
  // Liste fixe fournie par le client. 3 sont pré-cochés au hasard à l'arrivée.
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
  // Thèmes choisis : tableau d'objets { name, custom: bool, checked: bool }
  // Au démarrage, on prend les 6 premiers du catalogue cochés
  let themes = [];


  // ======= INIT AVATARS =======
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


  // ======= VALIDATION ÉTAPE 1 =======
  pseudoInput.addEventListener('input', () => {
    const ok = pseudoInput.value.trim().length >= 2;
    btnStep1Next.disabled = !ok;
  });

  pseudoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnStep1Next.disabled) goToStep2();
  });

  btnStep1Next.addEventListener('click', goToStep2);


  // ======= PASSAGE ÉTAPE 1 → 2 =======
  function goToStep2() {
    const pseudo = pseudoInput.value.trim();
    if (pseudo.length < 2) return;

    console.log('[Wooo] goToStep2 — pseudo:', pseudo);

    // Mise à jour du titre :
    if (pseudo) {
      themesTitle.textContent = `OK ${pseudo}, on a choisi quelques thèmes pour toi, change les si tu veux !`;
    } else {
      themesTitle.textContent = `OK, on a choisi quelques thèmes pour toi, change les si tu veux !`;
    }

    // Initialise les thèmes : tous présents, 3 cochés au hasard
    const indicesAleatoires = pickRandomIndices(THEME_CATALOG.length, 3);
    themes = THEME_CATALOG.map((name, i) => ({
      name,
      custom: false,
      checked: indicesAleatoires.includes(i),
    }));

    console.log('[Wooo] themes initialisés :', themes);

    renderThemes();

    step1.hidden = true;
    step2.hidden = false;
    btnStep1Next.hidden = true;
    btnStep2Next.hidden = false;
  }


  /** Tire `n` indices distincts au hasard parmi [0, max[ */
  function pickRandomIndices(max, n) {
    const all = Array.from({ length: max }, (_, i) => i);
    // Mélange Fisher-Yates
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, n);
  }


  // ======= RENDU DES THÈMES =======
  // On affiche TOUS les thèmes (catalogue + customs ajoutés).
  // L'utilisateur peut cocher/décocher librement. Min 3, max 6 cochés.
  function renderThemes() {
    console.log('[Wooo] renderThemes — nombre de thèmes :', themes.length);
    themesList.innerHTML = themes.map((t, idx) => {
      const checkedClass = t.checked ? 'is-checked' : '';
      return `
        <li>
          <button type="button" class="themed-check ${checkedClass}" data-idx="${idx}">
            <span class="themed-check__label">${escapeHtml(t.name)}</span>
            <span class="themed-check__box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
            </span>
          </button>
        </li>
      `;
    }).join('');

    updateThemeCount();
  }

  themesList.addEventListener('click', (e) => {
    const btn = e.target.closest('.themed-check');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    // Toggle simple
    const willCheck = !themes[idx].checked;
    // Si on essaie de cocher mais qu'on a déjà 6 cochés → bloque
    if (willCheck) {
      const checkedCount = themes.filter(t => t.checked).length;
      if (checkedCount >= 6) {
        // Petite animation de refus
        btn.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
          { duration: 200 }
        );
        return;
      }
    }
    themes[idx].checked = willCheck;
    btn.classList.toggle('is-checked', willCheck);
    updateThemeCount();
  });


  function updateThemeCount() {
    const checked = themes.filter(t => t.checked).length;
    themeCount.textContent = checked;
    btnStep2Next.disabled = (checked < 3 || checked > 6);
  }


  // ======= ÉTAPE 3 : création thème custom (overlay fullscreen) =======
  btnAddTheme.addEventListener('click', () => {
    customInput.value = '';
    customHint.textContent = '0 / 40';
    btnStep3Add.disabled = true;

    step3.hidden = false;

    setTimeout(() => customInput.focus(), 100);
  });

  customInput.addEventListener('input', () => {
    const val = customInput.value.trim();
    const len = val.length;
    customHint.textContent = `${len} / 40`;
    btnStep3Add.disabled = (len < 2 || len > 40);
  });

  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnStep3Add.disabled) {
      e.preventDefault();
      addCustomTheme();
    }
  });

  btnStep3Add.addEventListener('click', addCustomTheme);

  function addCustomTheme() {
    const val = customInput.value.trim();
    if (val.length < 2 || val.length > 40) return;
    // On ajoute en tête, coché
    themes.unshift({ name: val, custom: true, checked: true });

    // Ferme l'overlay et rafraîchit la liste
    renderThemes();
    closeCustomOverlay();
  }

  function closeCustomOverlay() {
    step3.hidden = true;
  }

  // Bouton retour de l'overlay
  const btnBackStep3 = $('btn-back-step3');
  if (btnBackStep3) {
    btnBackStep3.addEventListener('click', closeCustomOverlay);
  }

  // ESC pour fermer l'overlay
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !step3.hidden) closeCustomOverlay();
  });


  // ======= VALIDATION FINALE — création de la partie =======
  btnStep2Next.addEventListener('click', async () => {
    const pseudo = pseudoInput.value.trim();
    const chosen = themes.filter(t => t.checked).map(t => t.name);

    if (chosen.length < 3 || chosen.length > 6) return;

    btnStep2Next.disabled = true;
    btnStep2Next.textContent = 'Création…';

    try {
      // 1) Crée la partie en base (avec produit = 'musique')
      const partie = await Wooo.api.createPartie(chosen, 'musique');

      // 2) Inscrit le créateur dans la partie
      const joueur = await Wooo.api.addJoueur(partie.id, pseudo, true, selectedAvatar);

      // 3) Sauvegarde la session locale (qui ajoute à l'historique)
      Wooo.session.save({
        partie_id:  partie.id,
        pin_code:   partie.pin_code,
        themes:     partie.themes,
        is_creator: true,
        joueur_id:  joueur.id,
        pseudo:     pseudo,
        avatar:     selectedAvatar,
      });

      // 4) Redirige vers la page d'invitation (= "Ta partie est créée !")
      window.location.href = 'invite.html';
    } catch (err) {
      console.error(err);
      btnStep2Next.disabled = false;
      btnStep2Next.innerHTML = `Je continue avec <span id="theme-count">${chosen.length}</span> thèmes`;
      alert('Oups : ' + err.message);
    }
  });


  // ======= BOUTON RETOUR =======
  btnBack.addEventListener('click', () => {
    if (!step2.hidden) {
      // Retour étape 1
      step2.hidden = true;
      step1.hidden = false;
      btnStep2Next.hidden = true;
      btnStep1Next.hidden = false;
    } else {
      window.location.href = 'index.html';
    }
  });


  // ======= UTILITAIRE =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  renderAvatars();
})();
