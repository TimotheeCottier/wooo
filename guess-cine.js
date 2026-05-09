/* =========================================================
   WOOO Ciné — Page de vote (guess)
   ---------------------------------------------------------
   - Identique à guess.js mais :
     - Poster fixe au lieu de vinyle qui tourne
     - Pas d'audio / pas de play / pause
     - Redirige vers recap-cine.html à la fin
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo guess-cine.js] version 6 chargée ✅');

  const $ = (id) => document.getElementById(id);

  // ----- Éléments -----
  const countdownOverlay = $('countdown');
  const countdownNumber  = $('countdown-number');
  const guessApp         = $('guess-app');
  const btnBack          = $('btn-back');
  const btnClose         = $('btn-close');
  const progressDots     = $('progress-dots');
  const themeTitleEl     = $('guess-theme');
  const trackTitle       = $('track-title');
  const trackArtist      = $('track-artist');
  const vinyl            = $('poster-target');   // ← poster au lieu de vinyl
  const coverImg         = $('cover-img');
  const playersTagsEl    = $('players-tags');


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace("hub.html");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const themeIndex = parseInt(params.get('theme') || '0', 10);
  const themeName = (session.themes && session.themes[themeIndex]) || '';
  const totalThemes = (session.themes || []).length;


  // ======= ÉTAT =======
  let allPicks = [];        // chansons à deviner sur ce thème (sauf les miennes)
  let allPlayers = [];      // tous les joueurs de la partie
  let currentTrackIdx = 0;  // index de la chanson en cours dans allPicks
  let votes = {};           // { pick.id: joueur_id_voté }
  let isLocked = false;     // verrou drag&drop pendant la transition entre tracks


  // ======= COUNTDOWN 3-2-1-GO (3 sec) =======
  function runCountdown() {
    let n = 3;
    countdownNumber.textContent = n;

    const tick = setInterval(() => {
      n--;
      if (n === 0) {
        countdownNumber.textContent = 'GO !';
        countdownNumber.style.fontSize = 'clamp(80px, 15vw, 180px)';
      } else if (n < 0) {
        clearInterval(tick);
        countdownOverlay.hidden = true;
        guessApp.setAttribute('aria-hidden', 'false');
        loadAndStart();
      } else {
        countdownNumber.textContent = n;
        // Replay l'animation
        countdownNumber.style.animation = 'none';
        countdownNumber.offsetHeight;  // trigger reflow
        countdownNumber.style.animation = 'countdown-pulse 1s var(--ease-out)';
      }
    }, 1000);
  }


  // ======= CHARGEMENT INITIAL =======
  async function loadAndStart() {
    themeTitleEl.textContent = themeName.toUpperCase();

    try {
      const [picks, joueurs] = await Promise.all([
        Wooo.api.getPicksForPartie(session.partie_id),
        Wooo.api.getJoueurs(session.partie_id),
      ]);

      allPlayers = joueurs;
      // Filtre : chansons du thème, mais pas les miennes (un joueur ne se vote pas)
      allPicks = picks.filter(p =>
        p.theme_index === themeIndex && p.joueur_id !== session.joueur_id
      );

      if (allPicks.length === 0) {
        // Cas pathologique : aucun morceau à voter
        window.location.href = 'recap-cine.html?theme=' + themeIndex;
        return;
      }

      renderProgressDots();
      renderPlayersTags();
      showTrack(0);
    } catch (err) {
      console.error('[Wooo] Erreur chargement guess :', err);
      themeTitleEl.textContent = 'Erreur de chargement';
    }
  }


  // ======= PROGRESS DOTS =======
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


  // ======= TAGS JOUEURS =======
  function renderPlayersTags() {
    // Tous les autres joueurs (sauf moi) deviennent draggables
    const others = allPlayers.filter(p => p.id !== session.joueur_id);
    const colors = (Wooo.config && Wooo.config.PLAYER_COLORS) || [];

    playersTagsEl.innerHTML = others.map((p, i) => {
      const color = colors[i % colors.length];
      const avatar = p.avatar || 1;
      return `
        <li class="player-tag" style="background: ${color}"
            data-player-id="${p.id}"
            draggable="false">
          <span class="player-tag__avatar">
            <img src="assets/avatar${avatar}.png" alt="" />
          </span>
          ${escapeHtml(p.pseudo)}
        </li>
      `;
    }).join('');

    setupDragDrop();
  }


  // ======= AFFICHAGE D'UNE CHANSON =======
  function showTrack(idx) {
    if (idx >= allPicks.length) {
      // Fini ! Vers recap
      window.location.href = 'recap-cine.html?theme=' + themeIndex;
      return;
    }
    currentTrackIdx = idx;
    isLocked = false;          // déverrouille le drag&drop
    const pick = allPicks[idx];

    trackTitle.textContent = pick.title || '';
    trackArtist.textContent = pick.artist || '';
    coverImg.src = pick.cover || '';

    // Retire l'avatar attribué (s'il y en avait un) - cherche dans stage et vinyle
    const stageEl = vinyl.parentElement;
    const oldAssigned = stageEl.querySelector('.assigned-avatar') || vinyl.querySelector('.assigned-avatar');
    if (oldAssigned) oldAssigned.remove();

    // Restaure l'avatar si un vote a déjà été fait pour cette chanson
    if (votes[pick.id]) {
      placeAvatarOnVinyl(votes[pick.id]);
    }
  }


  // ======= DRAG-AND-DROP =======
  function setupDragDrop() {
    const tags = playersTagsEl.querySelectorAll('.player-tag');
    tags.forEach(tag => {
      tag.addEventListener('mousedown', onDragStart);
      tag.addEventListener('touchstart', onDragStart, { passive: false });
    });
  }

  let dragState = null;

  function onDragStart(e) {
    const tag = e.currentTarget;
    if (tag.classList.contains('is-placed')) return;
    // Verrouillage : on bloque tout nouveau drag pendant la transition
    if (isLocked) return;

    e.preventDefault();

    const isTouch = (e.type === 'touchstart');
    const point = isTouch ? e.touches[0] : e;

    const rect = tag.getBoundingClientRect();
    dragState = {
      tag,
      isTouch,
      startX: point.clientX,
      startY: point.clientY,
      offsetX: point.clientX - rect.left,
      offsetY: point.clientY - rect.top,
      moved: false,
      width: rect.width,
      height: rect.height,
    };

    if (isTouch) {
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('touchend', onDragEnd);
    } else {
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
    }
  }

  function onDragMove(e) {
    if (!dragState) return;
    e.preventDefault();
    const point = dragState.isTouch ? e.touches[0] : e;
    const dx = Math.abs(point.clientX - dragState.startX);
    const dy = Math.abs(point.clientY - dragState.startY);

    // Seuil pour distinguer drag vs clic
    if (!dragState.moved && (dx > 5 || dy > 5)) {
      dragState.moved = true;
      dragState.tag.classList.add('is-dragging');
      dragState.tag.style.width = dragState.width + 'px';
      dragState.tag.style.height = dragState.height + 'px';
    }

    if (dragState.moved) {
      dragState.tag.style.left = (point.clientX - dragState.offsetX) + 'px';
      dragState.tag.style.top  = (point.clientY - dragState.offsetY) + 'px';

      // Vérifie si on est au-dessus du vinyle
      const vinylRect = vinyl.getBoundingClientRect();
      const overVinyl = point.clientX >= vinylRect.left
                     && point.clientX <= vinylRect.right
                     && point.clientY >= vinylRect.top
                     && point.clientY <= vinylRect.bottom;
      vinyl.classList.toggle('is-drop-target', overVinyl);
    }
  }

  function onDragEnd(e) {
    if (!dragState) return;

    const wasMoved = dragState.moved;
    const tag = dragState.tag;
    const point = dragState.isTouch
      ? (e.changedTouches && e.changedTouches[0])
      : e;

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);

    if (wasMoved && point) {
      // Drop : est-ce qu'on est au-dessus du vinyle ?
      const vinylRect = vinyl.getBoundingClientRect();
      const overVinyl = point.clientX >= vinylRect.left
                     && point.clientX <= vinylRect.right
                     && point.clientY >= vinylRect.top
                     && point.clientY <= vinylRect.bottom;

      // Reset visuel
      tag.classList.remove('is-dragging');
      tag.style.left = tag.style.top = '';
      tag.style.width = tag.style.height = '';
      vinyl.classList.remove('is-drop-target');

      if (overVinyl) {
        // VICTOIRE : on attribue ce joueur à la chanson
        attributePlayer(tag.dataset.playerId);
      }
    } else {
      // Pas bougé = clic → fallback : attribue directement
      attributePlayer(tag.dataset.playerId);
    }

    dragState = null;
  }


  // ======= ATTRIBUTION D'UN JOUEUR À LA CHANSON COURANTE =======
  function attributePlayer(playerId) {
    if (isLocked) return;       // déjà attribué, en attente du prochain track
    const pick = allPicks[currentTrackIdx];
    if (!pick) return;

    isLocked = true;            // verrouille jusqu'au showTrack suivant

    votes[pick.id] = playerId;
    placeAvatarOnVinyl(playerId);

    // On grise le tag (utilisé)
    refreshTagsState();

    // Petit délai puis on passe à la suivante (qui réinitialise isLocked)
    setTimeout(() => {
      showTrack(currentTrackIdx + 1);
    }, 800);
  }

  function placeAvatarOnVinyl(playerId) {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    // Supprime l'ancien avatar attribué (placé hors du vinyle qui tourne)
    const stage = vinyl.parentElement;
    const old = stage.querySelector('.assigned-avatar');
    if (old) old.remove();

    const avatar = player.avatar || 1;
    const div = document.createElement('div');
    div.className = 'assigned-avatar';
    div.innerHTML = `<img src="assets/avatar${avatar}.png" alt="${escapeHtml(player.pseudo)}" />`;
    // L'avatar est ajouté DANS le stage (parent du vinyle), pas dans le vinyle lui-même.
    // Comme ça, il reste droit pendant que le vinyle tourne.
    stage.appendChild(div);
  }


  // ======= STATE DES TAGS (grisé si déjà utilisé) =======
  // Note : on n'interdit pas d'utiliser le même joueur pour plusieurs chansons
  // si l'utilisateur le souhaite. Mais on grise quand même pour signaler
  // qu'on l'a déjà utilisé sur une autre chanson de ce thème.
  function refreshTagsState() {
    const usedIds = new Set(Object.values(votes));
    playersTagsEl.querySelectorAll('.player-tag').forEach(tag => {
      const id = tag.dataset.playerId;
      tag.classList.toggle('is-placed', usedIds.has(id));
    });
  }


  // ======= NAVIGATION =======
  btnBack.addEventListener('click', () => {
    if (currentTrackIdx > 0) {
      showTrack(currentTrackIdx - 1);
    } else if (themeIndex > 0) {
      window.location.href = 'guess.html?theme=' + (themeIndex - 1);
    } else {
      window.location.href = session.is_creator ? 'lobby.html' : 'lobby-invite.html';
    }
  });

  btnClose.addEventListener('click', () => {
    if (confirm('Tu veux vraiment arrêter ? Tes votes en cours seront sauvegardés.')) {
      window.location.href = "index-cine.html";
    }
  });


  // ======= UTILITAIRE =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  // On stocke les votes pour le passage à recap-cine.html
  window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('wooo:current-votes:' + themeIndex, JSON.stringify(votes));
  });

  runCountdown();

})();
