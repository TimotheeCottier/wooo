/* =========================================================
   WOOO MUSIQUE — Page "Rejoindre une partie" (avec Supabase)
   ---------------------------------------------------------
   - Pré-remplit le code PIN si présent dans l'URL (?pin=123456)
   - À chaque saisie complète du PIN, on cherche la partie en base
   - Si trouvée : on affiche les thèmes
   - Au "C'est parti !" : on inscrit le joueur dans la base et
     on redirige vers la 1re manche
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pinInput     = $('pin-input');
  const pseudoInput  = $('pseudo-input');
  const avatarPicker = $('avatar-picker');
  const btnGo        = $('btn-go');
  const recap        = $('join-recap');
  const recapList    = $('join-recap-list');
  const errorEl      = $('join-error');

  const NB_AVATARS = 8;
  let selectedAvatar = 1 + Math.floor(Math.random() * NB_AVATARS);

  // ======= SÉLECTEUR D'AVATARS =======
  function renderAvatars() {
    let html = '';
    for (let i = 1; i <= NB_AVATARS; i++) {
      const isSelected = (i === selectedAvatar);
      html += `
        <li class="avatar-option ${isSelected ? 'is-selected' : ''}"
            data-avatar="${i}"
            tabindex="0"
            role="button"
            aria-label="Avatar ${i}">
          <img src="assets/avatar${i}.png" alt="Avatar ${i}" />
        </li>
      `;
    }
    avatarPicker.innerHTML = html;
  }
  renderAvatars();

  avatarPicker.addEventListener('click', (e) => {
    const opt = e.target.closest('.avatar-option');
    if (!opt) return;
    selectedAvatar = parseInt(opt.dataset.avatar, 10);
    renderAvatars();
  });


  // ======= ÉTAT =======
  // La partie trouvée (ou null si PIN incorrect)
  let foundPartie = null;
  let lookupTimer = null;


  // ======= PRÉ-REMPLISSAGE DU CODE PIN =======
  const params = new URLSearchParams(window.location.search);
  const prefillPin = params.get('pin');
  if (prefillPin && /^\d{6}$/.test(prefillPin)) {
    pinInput.value = prefillPin;
    lookupPartie(prefillPin);
  }


  // ======= VALIDATION DES CHAMPS =======
  function validate() {
    const pin = pinInput.value.replace(/\D/g, '');
    const pseudo = pseudoInput.value.trim();
    const pinOk = /^\d{6}$/.test(pin) && foundPartie !== null;
    const pseudoOk = pseudo.length >= 2;
    btnGo.disabled = !(pinOk && pseudoOk);
  }

  pinInput.addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    e.target.value = digits;

    // On nettoie le récap et l'erreur pendant qu'on tape
    if (digits.length < 6) {
      foundPartie = null;
      recap.hidden = true;
      errorEl.hidden = true;
      validate();
      return;
    }

    // Debounce de 250ms pour éviter trop de requêtes
    if (lookupTimer) clearTimeout(lookupTimer);
    lookupTimer = setTimeout(() => lookupPartie(digits), 250);
  });

  pseudoInput.addEventListener('input', validate);
  pseudoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnGo.disabled) {
      e.preventDefault();
      btnGo.click();
    }
  });


  // ======= RECHERCHE DE LA PARTIE EN BASE =======
  async function lookupPartie(pin) {
    errorEl.hidden = true;
    recap.hidden = true;
    foundPartie = null;
    validate();

    try {
      const partie = await Wooo.api.getPartieByPin(pin);
      if (!partie) {
        errorEl.hidden = false;
        errorEl.textContent = 'Aucune partie ne correspond à ce code PIN.';
        return;
      }

      // Si la partie est déjà lancée (votes ou terminée), on vérifie d'abord
      // si le joueur fait déjà partie de cette partie (cas où il a fermé l'onglet
      // par accident). Sinon → page "trop tard"
      if (partie.status === 'votes' || partie.status === 'terminee') {
        const session = Wooo.session.get();
        const isAlreadyMember = session &&
                                session.partie_id === partie.id &&
                                session.joueur_id;

        if (isAlreadyMember) {
          // Il fait partie de la partie → on le ramène au bon endroit
          if (partie.status === 'votes') {
            window.location.replace('guess.html?theme=0');
          } else {
            window.location.replace('classement.html');
          }
          return;
        }

        // Sinon : retardataire → page "trop tard"
        window.location.replace('late.html?pin=' + encodeURIComponent(pin));
        return;
      }

      foundPartie = partie;
      recapList.innerHTML = partie.themes.map(theme =>
        `<li class="invite-recap__item">${escapeHtml(theme)}</li>`
      ).join('');
      recap.hidden = false;
      validate();
    } catch (err) {
      console.error(err);
      errorEl.hidden = false;
      errorEl.textContent = 'Erreur de connexion. Vérifie ton internet et réessaie.';
    }
  }


  // Limite max de joueurs par partie
  const MAX_PLAYERS = 10;


  // ======= REJOINDRE LA PARTIE =======
  btnGo.addEventListener('click', async () => {
    const pseudo = pseudoInput.value.trim();
    if (!foundPartie || pseudo.length < 2) return;

    btnGo.disabled = true;
    const original = btnGo.textContent;
    btnGo.textContent = 'Connexion…';

    try {
      // On revérifie le statut au cas où la partie aurait été lancée entre temps
      const partie = await Wooo.api.getPartieById(foundPartie.id);
      if (!partie || partie.status === 'votes' || partie.status === 'terminee') {
        window.location.replace('late.html?pin=' + encodeURIComponent(foundPartie.pin_code));
        return;
      }

      // Vérifie que la partie n'est pas pleine
      const existants = await Wooo.api.getJoueurs(foundPartie.id);
      if (existants.length >= MAX_PLAYERS) {
        btnGo.disabled = false;
        btnGo.textContent = original;
        errorEl.hidden = false;
        errorEl.textContent = `Cette partie est complète (${MAX_PLAYERS} joueurs maximum).`;
        return;
      }

      // Inscrit le joueur dans la base avec son avatar
      const joueur = await Wooo.api.addJoueur(foundPartie.id, pseudo, false, selectedAvatar);

      // On enregistre la session locale
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
      btnGo.textContent = original;

      // Message d'erreur sympa
      if (err.message.includes('déjà pris')) {
        errorEl.hidden = false;
        errorEl.textContent = 'Ce prénom est déjà pris dans cette partie. Choisis-en un autre !';
      } else {
        alert('Oups : ' + err.message);
      }
    }
  });


  // ======= UTILITAIRES =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Init
  validate();
  if (!prefillPin) {
    setTimeout(() => pinInput.focus(), 100);
  } else {
    setTimeout(() => pseudoInput.focus(), 100);
  }

})();
