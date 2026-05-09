/* =========================================================
   WOOO — Rejoindre une partie
   ---------------------------------------------------------
   Étape 1 : code PIN (avec aperçu thèmes)
   Étape 2 : pseudo + avatar
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const stepPin         = $('step-pin');
  const stepIdentity    = $('step-identity');
  const pinInput        = $('pin-input');
  const pinError        = $('pin-error');
  const preview         = $('join-preview');
  const previewThemes   = $('join-preview-themes');
  const pseudoInput     = $('pseudo-input');
  const pseudoError     = $('pseudo-error');
  const avatarPicker    = $('avatar-picker');
  const btnValidatePin  = $('btn-validate-pin');
  const btnGo           = $('btn-go');

  const MAX_PLAYERS = 10;

  let foundPartie = null;
  let selectedAvatar = 1;


  // ======= AUTO-FILL DU PIN DEPUIS L'URL =======
  const params = new URLSearchParams(window.location.search);
  if (params.get('pin')) {
    const pin = params.get('pin').trim();
    if (/^\d{6}$/.test(pin)) {
      pinInput.value = pin;
      validatePinInput();
    }
  }


  // ======= ÉTAPE 1 : valider le PIN =======
  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
    validatePinInput();
  });

  function validatePinInput() {
    const val = pinInput.value.trim();
    btnValidatePin.disabled = !/^\d{6}$/.test(val);
    pinError.hidden = true;
    preview.hidden = true;
  }

  btnValidatePin.addEventListener('click', async () => {
    const pin = pinInput.value.trim();
    btnValidatePin.disabled = true;
    btnValidatePin.textContent = 'Recherche…';

    try {
      const partie = await Wooo.api.getPartieByPin(pin);
      btnValidatePin.textContent = 'Valider';

      if (!partie) {
        pinError.textContent = 'Aucune partie ne correspond à ce code.';
        pinError.hidden = false;
        btnValidatePin.disabled = false;
        return;
      }

      // Si déjà lancée
      if (partie.status === 'votes' || partie.status === 'terminee') {
        const session = Wooo.session.get();
        if (session && session.partie_id === partie.id) {
          // Joueur déjà membre → redirige
          if (partie.status === 'votes') {
            window.location.href = 'guess.html?theme=0';
          } else {
            window.location.href = 'classement.html';
          }
          return;
        }
        window.location.href = 'late.html?pin=' + encodeURIComponent(pin);
        return;
      }

      // Affiche les thèmes en preview puis passe à étape 2
      foundPartie = partie;
      previewThemes.innerHTML = (partie.themes || []).map(t => `<li>${escapeHtml(t)}</li>`).join('');
      preview.hidden = false;
      // Direct passage à étape 2 après 600ms
      setTimeout(() => goToStepIdentity(), 600);
    } catch (err) {
      console.error(err);
      btnValidatePin.textContent = 'Valider';
      btnValidatePin.disabled = false;
      pinError.textContent = 'Erreur de connexion.';
      pinError.hidden = false;
    }
  });


  // ======= ÉTAPE 2 : identity =======
  function goToStepIdentity() {
    stepPin.hidden = true;
    stepIdentity.hidden = false;
    btnValidatePin.hidden = true;
    btnGo.hidden = false;
    renderAvatars();
    setTimeout(() => pseudoInput.focus(), 100);
  }

  function renderAvatars() {
    const colors = (Wooo.config && Wooo.config.PLAYER_COLORS) || [];
    avatarPicker.innerHTML = Array.from({ length: 8 }, (_, i) => {
      const num = i + 1;
      const bg = colors[i % colors.length];
      return `
        <li class="avatar-grid__item ${num === selectedAvatar ? 'is-selected' : ''}"
            data-avatar="${num}"
            style="background: ${bg}">
          <img src="assets/avatar${num}.png" alt="" />
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

  pseudoInput.addEventListener('input', () => {
    btnGo.disabled = pseudoInput.value.trim().length < 2;
    pseudoError.hidden = true;
  });

  pseudoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnGo.disabled) btnGo.click();
  });

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
        pseudoError.textContent = `Cette partie est complète (${MAX_PLAYERS} joueurs maximum).`;
        pseudoError.hidden = false;
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
        pseudoError.textContent = 'Ce prénom est déjà pris dans cette partie.';
      } else {
        pseudoError.textContent = err.message || 'Erreur';
      }
      pseudoError.hidden = false;
    }
  });


  btnBack.addEventListener('click', () => {
    if (!stepIdentity.hidden) {
      stepIdentity.hidden = true;
      stepPin.hidden = false;
      btnGo.hidden = true;
      btnValidatePin.hidden = false;
    } else {
      window.location.href = 'index.html';
    }
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  setTimeout(() => pinInput.focus(), 100);

})();
