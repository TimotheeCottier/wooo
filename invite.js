/* =========================================================
   WOOO MUSIQUE — Page invitation
   ---------------------------------------------------------
   - Affiche le lien à partager (avec PIN) + bouton "Copier"
   - Saisie du pseudo
   - Sélecteur d'avatar (1-9)
   - Au démarrage : on inscrit le créateur en base avec
     pseudo + avatar choisis, puis on redirige
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const pseudoInput     = $('pseudo-input');
  const avatarPicker    = $('avatar-picker');
  const shareLinkEl     = $('share-link');
  const btnCopy         = $('btn-copy');
  const btnStart        = $('btn-start');
  const copyFeedback    = $('copy-feedback');
  const recapList       = $('recap-list');

  const NB_AVATARS = 8;


  // ======= LECTURE DE LA SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id) {
    window.location.replace('create.html');
    return;
  }


  // ======= ÉTAT =======
  // Avatar par défaut : un aléatoire au premier chargement
  let selectedAvatar = session.avatar || (1 + Math.floor(Math.random() * NB_AVATARS));


  // ======= LIEN À PARTAGER =======
  const shareUrl = buildShareUrl(session.pin_code);
  shareLinkEl.textContent = shareUrl;

  function buildShareUrl(pin) {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return base + 'join.html?pin=' + pin;
  }


  // ======= AFFICHAGE DES THÈMES =======
  recapList.innerHTML = session.themes.map(theme => `
    <li class="invite-recap__item">${escapeHtml(theme)}</li>
  `).join('');


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
            aria-label="Avatar ${i}"
            aria-pressed="${isSelected}">
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


  // ======= PSEUDO =======
  if (session.pseudo) pseudoInput.value = session.pseudo;

  function updateStartButton() {
    btnStart.disabled = (pseudoInput.value.trim().length < 2);
  }
  pseudoInput.addEventListener('input', updateStartButton);
  pseudoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnStart.disabled) {
      e.preventDefault();
      btnStart.click();
    }
  });
  updateStartButton();
  if (!session.pseudo) setTimeout(() => pseudoInput.focus(), 100);


  // ======= COPIER LE LIEN =======
  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showCopyFeedback();
    } catch (err) {
      // Fallback : prompt
      prompt('Copie ce lien manuellement :', shareUrl);
    }
  });

  function showCopyFeedback() {
    copyFeedback.hidden = false;
    setTimeout(() => { copyFeedback.hidden = true; }, 2500);
  }


  // ======= DÉMARRAGE DE LA PARTIE =======
  btnStart.addEventListener('click', async () => {
    const pseudo = pseudoInput.value.trim();
    if (pseudo.length < 2) return;

    btnStart.disabled = true;
    const original = btnStart.textContent;
    btnStart.textContent = 'Connexion…';

    try {
      let joueur;
      if (session.joueur_id) {
        // Si déjà inscrit, on met à jour pseudo + avatar
        joueur = await Wooo.api.updateJoueur(session.joueur_id, {
          pseudo, avatar: selectedAvatar,
        });
      } else {
        joueur = await Wooo.api.addJoueur(session.partie_id, pseudo, true, selectedAvatar);
      }

      session.pseudo    = pseudo;
      session.avatar    = selectedAvatar;
      session.joueur_id = joueur.id;
      Wooo.session.save(session);

      window.location.href = 'search.html?theme=0';
    } catch (err) {
      console.error(err);
      btnStart.disabled = false;
      btnStart.textContent = original;
      alert('Oups : ' + err.message);
    }
  });


  // ======= UTILITAIRES =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

})();
