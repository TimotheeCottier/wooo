/* =========================================================
   WOOO — Rejoindre une partie : étape 2 (pseudo + avatar)
   ---------------------------------------------------------
   - Pseudo (live update du titre)
   - Avatar (8 choix)
   - Récap des thèmes choisis par le créateur (lecture seule)
   - "C'est parti" → addJoueur + redirige vers search.html?theme=0
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo join-identity.js] version 5 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const pseudoInput     = $('pseudo-input');
  const avatarPicker    = $('avatar-picker');
  const themesTitle     = $('themes-title');
  const creatorNameEl   = $('creator-name');
  const themesList      = $('themes-list');
  const btnGo           = $('btn-go');

  const MAX_PLAYERS = 10;

  // ======= LECTURE PIN =======
  const params = new URLSearchParams(window.location.search);
  const pin = params.get('pin');
  if (!pin) {
    window.location.replace('join.html');
    return;
  }

  let foundPartie = null;
  let creatorName = '';
  let selectedAvatar = 1;


  // ======= CHARGEMENT DE LA PARTIE =======
  async function loadPartie() {
    try {
      const partie = await Wooo.api.getPartieByPin(pin);
      if (!partie) {
        window.location.replace('join.html');
        return;
      }

      // Si déjà lancée
      if (partie.status === 'votes' || partie.status === 'terminee') {
        window.location.replace('late.html?pin=' + encodeURIComponent(pin));
        return;
      }

      foundPartie = partie;

      // Récupère le créateur
      const joueurs = await Wooo.api.getJoueurs(partie.id);
      const creator = joueurs.find(j => j.is_creator);
      creatorName = creator ? creator.pseudo : '';
      creatorNameEl.textContent = creatorName ? creatorName : 'le créateur';

      renderThemes(partie.themes || []);
      renderAvatars();
    } catch (err) {
      console.error(err);
      alert('Erreur de chargement.');
    }
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
    updateGoButton();
  }

  avatarPicker.addEventListener('click', (e) => {
    const item = e.target.closest('.avatar-grid__item');
    if (!item) return;
    selectedAvatar = parseInt(item.dataset.avatar, 10);
    avatarPicker.querySelectorAll('.avatar-grid__item').forEach(el => {
      el.classList.toggle('is-selected', parseInt(el.dataset.avatar, 10) === selectedAvatar);
    });
    updateGoButton();
  });


  // ======= RENDU THÈMES (lecture seule) =======
  function renderThemes(themes) {
    themesList.innerHTML = themes.map(t => `
      <li>
        <div class="themed-check is-checked is-readonly">
          <span class="themed-check__label">${escapeHtml(t)}</span>
          <span class="themed-check__box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          </span>
        </div>
      </li>
    `).join('');
  }


  // ======= MISE À JOUR LIVE =======
  pseudoInput.addEventListener('input', updateGoButton);

  function updateGoButton() {
    const pseudoOk = pseudoInput.value.trim().length >= 2;
    btnGo.disabled = !pseudoOk;
  }

  pseudoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnGo.disabled) btnGo.click();
  });


  // ======= LANCEMENT =======
  btnGo.addEventListener('click', async () => {
    const pseudo = pseudoInput.value.trim();
    if (!foundPartie || pseudo.length < 2) return;

    btnGo.disabled = true;
    btnGo.textContent = 'Connexion…';

    try {
      // Re-vérification du statut
      const partie = await Wooo.api.getPartieById(foundPartie.id);
      if (!partie || partie.status === 'votes' || partie.status === 'terminee') {
        window.location.replace('late.html?pin=' + encodeURIComponent(foundPartie.pin_code));
        return;
      }

      // Limite joueurs
      const existants = await Wooo.api.getJoueurs(foundPartie.id);
      if (existants.length >= MAX_PLAYERS) {
        btnGo.disabled = false;
        btnGo.textContent = "C'est parti !";
        alert(`Cette partie est complète (${MAX_PLAYERS} joueurs maximum).`);
        return;
      }

      const joueur = await Wooo.api.addJoueur(foundPartie.id, pseudo, false, selectedAvatar);

      Wooo.session.save({
        partie_id:  foundPartie.id,
        pin_code:   foundPartie.pin_code,
        themes:     foundPartie.themes,
        is_creator: false,
        joueur_id:  joueur.id,
        pseudo:     pseudo,
        avatar:     selectedAvatar,
      });

      window.location.href = 'search.html?theme=0';
    } catch (err) {
      console.error(err);
      btnGo.disabled = false;
      btnGo.textContent = "C'est parti !";
      if (err.message && err.message.includes('déjà pris')) {
        alert('Ce prénom est déjà pris dans cette partie.');
      } else {
        alert(err.message || 'Erreur');
      }
    }
  });


  btnBack.addEventListener('click', () => {
    window.location.href = 'join.html';
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  loadPartie();
  setTimeout(() => pseudoInput.focus(), 100);

})();
