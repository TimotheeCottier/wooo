/* =========================================================
   WOOO — Confirmation d'une chanson
   ---------------------------------------------------------
   - Récupère le track depuis sessionStorage 'wooo:pending-pick'
   - Affiche vinyle qui tourne + infos + play/pause
   - "Je confirme" → enregistre via savePick puis :
       - va au thème suivant (search.html)
       - OU va à validate.html si dernier thème
   - Retour → search.html du même thème (pour rechoisir)
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo confirm.js] version 4 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack          = $('btn-back');
  const btnClose         = $('btn-close');
  const progressDots     = $('progress-dots');
  const themeTitleEl     = $('confirm-theme');
  const vinylDisc        = $('vinyl-disc');
  const coverImg         = $('cover-img');
  const songTitle        = $('song-title');
  const songArtist       = $('song-artist');
  const btnPlay          = $('btn-play');
  const btnPause         = $('btn-pause');
  const btnConfirm       = $('btn-confirm');
  const audio            = $('audio-player');


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index-musique.html');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const themeIndex = parseInt(params.get('theme') || '0', 10);
  const themeName = (session.themes && session.themes[themeIndex]) || '';
  const totalThemes = (session.themes || []).length;

  themeTitleEl.textContent = themeName.toUpperCase();
  renderProgressDots();


  // ======= RÉCUPÈRE LE PENDING PICK =======
  let pending = null;
  try {
    const raw = sessionStorage.getItem('wooo:pending-pick');
    if (raw) pending = JSON.parse(raw);
  } catch (e) {}

  if (!pending || pending.theme_index !== themeIndex) {
    // Pas de chanson en attente → retour search
    window.location.replace('search.html?theme=' + themeIndex);
    return;
  }

  // Affichage
  coverImg.src = pending.cover || '';
  songTitle.textContent = pending.title || '';
  songArtist.textContent = pending.artist || '';

  // Le vinyle tourne en permanence (animation CSS).
  // Ralentit quand on est en pause.
  if (pending.preview) {
    audio.src = pending.preview;
  }


  function renderProgressDots() {
    let html = '';
    for (let i = 0; i < totalThemes; i++) {
      if (i === themeIndex) {
        html += `<span class="progress-dot is-current">${i + 1}</span>`;
      } else if (i < themeIndex) {
        html += `<span class="progress-dot is-done"></span>`;
      } else {
        html += `<span class="progress-dot"></span>`;
      }
    }
    progressDots.innerHTML = html;
  }


  // ======= LECTURE AUDIO =======
  // Le vinyle ne tourne PAS au chargement. Il tourne uniquement quand l'audio joue.
  // Pas d'autoplay : c'est l'utilisateur qui décide de lancer la lecture.
  vinylDisc.style.animationPlayState = 'paused';

  btnPlay.addEventListener('click', () => {
    if (!pending.preview) return;
    audio.play();
  });
  btnPause.addEventListener('click', () => audio.pause());

  audio.addEventListener('play', () => {
    btnPlay.hidden = true;
    btnPause.hidden = false;
    vinylDisc.style.animationPlayState = 'running';
  });
  audio.addEventListener('pause', () => {
    btnPlay.hidden = false;
    btnPause.hidden = true;
    vinylDisc.style.animationPlayState = 'paused';
  });
  audio.addEventListener('ended', () => {
    btnPlay.hidden = false;
    btnPause.hidden = true;
    vinylDisc.style.animationPlayState = 'paused';
  });


  // ======= CONFIRMATION =======
  btnConfirm.addEventListener('click', async () => {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Enregistrement…';
    audio.pause();

    try {
      // Construire le track au format Deezer attendu par savePick
      await Wooo.api.savePick(session.partie_id, session.joueur_id, themeIndex, {
        id: pending.deezer_id,
        title: pending.title,
        artist: { name: pending.artist },
        album: { cover_medium: pending.cover, cover_big: pending.cover },
        preview: pending.preview,
      });

      // Nettoie le pending pick
      sessionStorage.removeItem('wooo:pending-pick');

      // Si on est en mode édition (vient de validate.html), retour direct
      const editReturn = sessionStorage.getItem('wooo:edit-return');
      if (editReturn === 'validate') {
        sessionStorage.removeItem('wooo:edit-return');
        window.location.href = 'validate.html';
        return;
      }

      // Sinon, parcours normal : thème suivant ou validate
      if (themeIndex + 1 < totalThemes) {
        window.location.href = 'search.html?theme=' + (themeIndex + 1);
      } else {
        window.location.href = 'validate.html';
      }
    } catch (err) {
      console.error(err);
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Je confirme';
      alert('Oups : ' + err.message);
    }
  });


  // ======= NAVIGATION =======
  btnBack.addEventListener('click', () => {
    audio.pause();
    sessionStorage.removeItem('wooo:pending-pick');
    window.location.href = 'search.html?theme=' + themeIndex;
  });

  btnClose.addEventListener('click', () => {
    if (confirm('Tu veux vraiment arrêter ?')) {
      audio.pause();
      sessionStorage.removeItem('wooo:pending-pick');
      window.location.href = 'index-musique.html';
    }
  });

})();
