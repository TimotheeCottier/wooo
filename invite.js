/* =========================================================
   WOOO — Page "Ta partie est créée !"
   ---------------------------------------------------------
   - Affiche l'avatar + pseudo du créateur (déjà en session)
   - Affiche le PIN à partager
   - Bouton "Je partage le lien" → Web Share API ou copie
   - Bouton "Je choisis mes chansons" → search.html
   - Bouton copier le PIN
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const btnBack       = $('btn-back');
  const avatarImg     = $('avatar-img');
  const pseudoEl      = $('invite-pseudo');
  const pinCode       = $('pin-code');
  const btnCopy       = $('btn-copy');
  const btnShare      = $('btn-share');
  const btnGo         = $('btn-go');
  const toast         = $('toast');
  const toastText     = $('toast-text');


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  // Affichage avatar + pseudo
  const avatar = session.avatar || 1;
  avatarImg.src = `assets/avatar${avatar}.png`;
  avatarImg.alt = session.pseudo || '';
  pseudoEl.textContent = session.pseudo || '';
  pinCode.textContent = session.pin_code || '------';


  // ======= LIEN À PARTAGER =======
  function buildShareLink() {
    return window.location.origin + window.location.pathname.replace(/[^/]+$/, '')
         + 'join.html?pin=' + encodeURIComponent(session.pin_code);
  }


  // ======= COPIER LE PIN =======
  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(session.pin_code);
      showToast('Code copié !');
    } catch (err) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = session.pin_code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Code copié !');
    }
  });


  // ======= PARTAGER LE LIEN =======
  btnShare.addEventListener('click', async () => {
    const url = buildShareLink();
    const title = 'Wooo — Devine ce qu\'écoutent tes potes';
    const text = `Rejoins ma partie Wooo ! Code : ${session.pin_code}`;

    // Web Share API (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // Annulé par l'utilisateur, on ne fait rien
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback : copie du lien
    try {
      await navigator.clipboard.writeText(url);
      showToast('Lien copié !');
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Lien copié !');
    }
  });


  // ======= ALLER À LA RECHERCHE =======
  btnGo.addEventListener('click', () => {
    window.location.href = 'search.html?theme=0';
  });


  // ======= RETOUR =======
  btnBack.addEventListener('click', () => {
    window.location.href = 'index.html';
  });


  // ======= TOAST =======
  let toastTimer;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toastText.textContent = msg;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2000);
  }

})();
