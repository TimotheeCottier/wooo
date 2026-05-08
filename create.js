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
  const themesNameWrap  = $('themes-name-wrap');
  const themesList      = $('themes-list');
  const btnAddTheme     = $('btn-add-theme');
  const themeCount      = $('theme-count');

  // ÉTAPE 3 (création thème custom pleine page)
  const step3           = $('step-3');
  const btnStep3Add     = $('btn-step3-add');
  const customInput     = $('custom-theme-input');
  const customHint      = $('custom-theme-hint');


  // ======= CATALOGUE DE THÈMES (pré-cochés ou disponibles) =======
  // Les 6 premiers seront pré-cochés au démarrage de l'étape 2.
  const THEME_CATALOG = [
    'Ta préférée all-time',
    'De l\'adolescence',
    'Pour s\'ambiancer',
    'Qui te fait saigner des oreilles',
    'Que tu n\'assumes pas',
    'Qui te fait pleurer',
    'Pour partir en vacances',
    'D\'un dimanche pluvieux',
    'D\'un mariage parfait',
    'Pour danser sur la table',
    'D\'un ex',
    'Pour pleurer en cuisinant',
    'Du voyage de tes rêves',
    'Que ton père écoute en boucle',
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

    // Mise à jour du titre :
    // - Si pseudo : "OK [Tim], on a choisi..."
    // - Sinon : "OK, on a choisi..."
    if (pseudo) {
      themesNameWrap.textContent = ' ' + pseudo;
    } else {
      themesNameWrap.textContent = '';
    }

    // Initialise les thèmes cochés (6 premiers)
    themes = THEME_CATALOG.map((name, i) => ({
      name,
      custom: false,
      checked: i < 6,
    }));

    renderThemes();

    step1.hidden = true;
    step2.hidden = false;
    btnStep1Next.hidden = true;
    btnStep2Next.hidden = false;
  }


  // ======= RENDU DES THÈMES =======
  // On n'affiche QUE les thèmes cochés. Décocher un thème le retire de la liste.
  // Pour en ajouter d'autres, le joueur clique sur "Créer un thème personnalisé".
  function renderThemes() {
    const visible = themes.filter(t => t.checked);
    themesList.innerHTML = visible.map(t => {
      const idx = themes.indexOf(t);
      return `
        <li>
          <button type="button" class="themed-check is-checked" data-idx="${idx}">
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
    // Décocher = retirer de la liste
    themes[idx].checked = false;
    renderThemes();
  });


  function updateThemeCount() {
    const checked = themes.filter(t => t.checked).length;
    themeCount.textContent = checked;
    btnStep2Next.disabled = (checked < 3 || checked > 6);
  }


  // ======= ÉTAPE 3 : création thème custom pleine page =======
  btnAddTheme.addEventListener('click', () => {
    customInput.value = '';
    customHint.textContent = '0 / 40';
    btnStep3Add.disabled = true;

    step2.hidden = true;
    step3.hidden = false;
    btnStep2Next.hidden = true;
    btnStep3Add.hidden = false;

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

    // Retour à l'étape 2 avec rendu mis à jour
    renderThemes();
    step3.hidden = true;
    step2.hidden = false;
    btnStep3Add.hidden = true;
    btnStep2Next.hidden = false;
  }


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
    if (!step3.hidden) {
      // Étape 3 → retour étape 2 (sans ajouter le thème)
      step3.hidden = true;
      step2.hidden = false;
      btnStep3Add.hidden = true;
      btnStep2Next.hidden = false;
    } else if (!step2.hidden) {
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
