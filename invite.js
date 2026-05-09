/* =========================================================
   WOOO — Écran de partage final (Bravo [pseudo] !)
   ---------------------------------------------------------
   - Affiche avatar + pseudo + PIN du créateur
   - Bouton copier le PIN
   - Bouton partager le lien
   - Lien retour homepage (la session reste sauvegardée → retour facile)
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo invite.js] version 4 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnHome      = $('btn-home');
  const myAvatar     = $('my-avatar');
  const pseudoEl     = $('invite-pseudo');
  const pinCodeEl    = $('pin-code');
  const btnCopy      = $('btn-copy');
  const btnShare     = $('btn-share');
  const btnBackHome  = $('btn-back-home');
  const toast        = $('toast');
  const toastText    = $('toast-text');


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id) {
    window.location.replace('index.html');
    return;
  }

  // Affichage
  pseudoEl.textContent = (session.pseudo || '').toUpperCase();
  pinCodeEl.textContent = session.pin_code || '------';
  const av = session.avatar || 1;
  myAvatar.innerHTML = `<img src="assets/avatar${av}.png" alt="" />`;


  // ======= COPIER LE PIN =======
  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(session.pin_code);
      showToast('Code copié !');
    } catch (e) {
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
    const url = window.location.origin + window.location.pathname.replace(/[^/]+$/, '')
              + 'join.html?pin=' + encodeURIComponent(session.pin_code);
    const text = `Rejoins ma partie Wooo ! Code : ${session.pin_code}`;

    if (navigator.share) {
      try {
        await navigator.share({ text, url, title: 'Wooo' });
        return;
      } catch (e) { /* annulé */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Lien copié !');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Lien copié !');
    }
  });


  // ======= NAVIGATION =======
  btnHome.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  btnBackHome.addEventListener('click', () => {
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
