/* =========================================================
   WOOO — Rejoindre une partie : étape 1 PIN
   ---------------------------------------------------------
   - Saisie du PIN
   - Vérification de la partie côté Supabase
   - Si OK → redirige vers join-identity.html?pin=...
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo join.js] version 5 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const pinInput        = $('pin-input');
  const pinError        = $('pin-error');
  const btnValidatePin  = $('btn-validate-pin');


  // ======= AUTO-FILL DU PIN DEPUIS L'URL =======
  const params = new URLSearchParams(window.location.search);
  if (params.get('pin')) {
    const pin = params.get('pin').trim();
    if (/^\d{6}$/.test(pin)) {
      pinInput.value = pin;
      validatePinInput();
    }
  }


  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
    validatePinInput();
  });

  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnValidatePin.disabled) btnValidatePin.click();
  });

  function validatePinInput() {
    btnValidatePin.disabled = !/^\d{6}$/.test(pinInput.value.trim());
    pinError.hidden = true;
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

      // Étape 2
      window.location.href = 'join-identity.html?pin=' + encodeURIComponent(pin);
    } catch (err) {
      console.error(err);
      btnValidatePin.textContent = 'Valider';
      btnValidatePin.disabled = false;
      pinError.textContent = 'Erreur de connexion.';
      pinError.hidden = false;
    }
  });


  btnBack.addEventListener('click', () => {
    window.location.href = 'index.html';
  });


  setTimeout(() => pinInput.focus(), 100);

})();
