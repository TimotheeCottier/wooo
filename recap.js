/* =========================================================
   WOOO — Recap des votes (avant validation)
   ---------------------------------------------------------
   - Affiche les chansons du thème + tag joueur attribué
   - Drag & drop des tags pour échanger les attributions
   - Bouton "Je passe au thème (X)" pour les thèmes intermédiaires
     ou "Je veux voir les résultats !" pour le dernier
   - À la validation : sauvegarde votes + score
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo recap.js] version 5 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const btnClose        = $('btn-close');
  const progressDots    = $('progress-dots');
  const titleEl         = $('recap-title');
  const leadEl          = $('recap-lead');
  const list            = $('recap-list');
  const btnNext         = $('btn-next');
  const audio           = $('audio-player');


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
  const isLastTheme = (themeIndex === totalThemes - 1);

  titleEl.textContent = themeName.toUpperCase();
  renderProgressDots();

  // Bouton dynamique
  if (isLastTheme) {
    btnNext.textContent = 'Je veux voir les résultats !';
  } else {
    btnNext.textContent = 'Je passe au thème ' + (themeIndex + 2);
  }


  // ======= ÉTAT =======
  let allPlayers = [];
  let tracks = [];
  let votes = {};
  let playersByDeezerId = {};
  let currentPlayingId = null;


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


  // ======= INIT =======
  async function init() {
    try {
      const [joueurs, allPicks] = await Promise.all([
        Wooo.api.getJoueurs(session.partie_id),
        Wooo.api.getPicksForPartie(session.partie_id),
      ]);
      allPlayers = joueurs;
      tracks = allPicks.filter(p => p.theme_index === themeIndex && p.joueur_id !== session.joueur_id);

      const themePicks = allPicks.filter(p => p.theme_index === themeIndex);
      playersByDeezerId = {};
      themePicks.forEach(p => {
        if (!playersByDeezerId[p.deezer_id]) playersByDeezerId[p.deezer_id] = [];
        playersByDeezerId[p.deezer_id].push(p.joueur_id);
      });

      // Récupère les votes faits sur la page guess
      try {
        const stored = sessionStorage.getItem('wooo:current-votes:' + themeIndex);
        if (stored) votes = JSON.parse(stored);
      } catch (e) {}

      renderList();
    } catch (err) {
      console.error(err);
      list.innerHTML = '<p style="color:var(--color-error); text-align:center;">Erreur de chargement.</p>';
    }
  }


  function isVoteCorrect(track, guessedId) {
    if (!guessedId) return false;
    const acceptable = playersByDeezerId[track.deezer_id] || [track.joueur_id];
    return acceptable.includes(guessedId);
  }


  // ======= RENDU =======
  function renderList() {
    const colors = (Wooo.config && Wooo.config.PLAYER_COLORS) || [];

    list.innerHTML = tracks.map((track) => {
      const guessedId = votes[track.id];
      const guessed = allPlayers.find(p => p.id === guessedId);

      let tagHtml = '';
      if (guessed) {
        const playerIdx = allPlayers.findIndex(p => p.id === guessed.id);
        const color = colors[playerIdx % colors.length];
        const av = guessed.avatar || 1;
        tagHtml = `
          <span class="player-tag recap-row__tag-pill"
                style="background: ${color}"
                draggable="true"
                data-player-id="${guessed.id}"
                data-source-track="${track.id}">
            <span class="player-tag__avatar">
              <img src="assets/avatar${av}.png" alt="" />
            </span>
            ${escapeHtml(guessed.pseudo)}
          </span>
        `;
      }

      return `
        <li class="recap-row" data-track-id="${track.id}">
          <div class="recap-row__cover" data-action="play">
            <img src="${escapeHtml(track.cover || '')}" alt="" onerror="this.style.display='none'" />
            <button type="button" class="recap-row__play" aria-label="Écouter">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
            </button>
          </div>
          <div class="recap-row__info">
            <p class="recap-row__title">${escapeHtml(track.title)}</p>
            <p class="recap-row__artist">${escapeHtml(track.artist)}</p>
          </div>
          <div class="recap-row__tag">${tagHtml}</div>
        </li>
      `;
    }).join('');

    setupDragAndDrop();
  }


  // ======= DRAG & DROP =======
  let draggedSourceTrack = null;
  let dragGhost = null;

  function setupDragAndDrop() {
    // Tags draggables (HTML5 drag-and-drop pour souris desktop, fallback tactile pour mobile)
    list.querySelectorAll('.recap-row__tag-pill').forEach(tag => {
      tag.addEventListener('dragstart', onDragStart);
      tag.addEventListener('dragend', onDragEnd);
      // Fallback tactile
      tag.addEventListener('touchstart', onTouchStart, { passive: false });
    });

    // Rangées qui acceptent le drop
    list.querySelectorAll('.recap-row').forEach(row => {
      row.addEventListener('dragover', onDragOver);
      row.addEventListener('dragleave', onDragLeave);
      row.addEventListener('drop', onDrop);
    });
  }

  function onDragStart(e) {
    draggedSourceTrack = e.currentTarget.dataset.sourceTrack;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedSourceTrack);
    e.currentTarget.classList.add('is-dragging');
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove('is-dragging');
    list.querySelectorAll('.recap-row').forEach(r => r.classList.remove('is-drop-target'));
    draggedSourceTrack = null;
  }

  function onDragOver(e) {
    if (!draggedSourceTrack) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('is-drop-target');
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove('is-drop-target');
  }

  function onDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('is-drop-target');
    const targetTrack = e.currentTarget.dataset.trackId;
    if (!targetTrack || !draggedSourceTrack || targetTrack === draggedSourceTrack) return;
    swapAttributions(draggedSourceTrack, targetTrack);
  }

  function swapAttributions(sourceTrack, targetTrack) {
    const tmp = votes[targetTrack];
    votes[targetTrack] = votes[sourceTrack];
    if (tmp) votes[sourceTrack] = tmp;
    else delete votes[sourceTrack];
    if (!votes[targetTrack]) delete votes[targetTrack];
    persistVotes();
    renderList();
  }


  // ======= TACTILE (mobile) : on imite le drag avec des touch events =======
  function onTouchStart(e) {
    e.preventDefault();
    const tag = e.currentTarget;
    draggedSourceTrack = tag.dataset.sourceTrack;
    tag.classList.add('is-dragging');

    // Crée un fantôme qui suit le doigt
    dragGhost = tag.cloneNode(true);
    dragGhost.style.position = 'fixed';
    dragGhost.style.top = '0';
    dragGhost.style.left = '0';
    dragGhost.style.pointerEvents = 'none';
    dragGhost.style.zIndex = '999';
    dragGhost.style.opacity = '0.85';
    document.body.appendChild(dragGhost);

    const onMove = (ev) => {
      const t = ev.touches[0];
      dragGhost.style.transform = `translate(${t.clientX - 40}px, ${t.clientY - 20}px)`;

      // Détecte sur quelle row le doigt est
      list.querySelectorAll('.recap-row').forEach(r => r.classList.remove('is-drop-target'));
      const elBelow = document.elementFromPoint(t.clientX, t.clientY);
      if (elBelow) {
        const row = elBelow.closest('.recap-row');
        if (row) row.classList.add('is-drop-target');
      }
    };

    const onEnd = (ev) => {
      tag.classList.remove('is-dragging');
      const t = ev.changedTouches[0];
      const elBelow = document.elementFromPoint(t.clientX, t.clientY);
      if (elBelow) {
        const row = elBelow.closest('.recap-row');
        if (row && row.dataset.trackId !== draggedSourceTrack) {
          swapAttributions(draggedSourceTrack, row.dataset.trackId);
        }
      }
      list.querySelectorAll('.recap-row').forEach(r => r.classList.remove('is-drop-target'));
      if (dragGhost) { dragGhost.remove(); dragGhost = null; }
      draggedSourceTrack = null;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }


  // ======= SAUVEGARDE LIVE DES VOTES (sessionStorage) =======
  function persistVotes() {
    sessionStorage.setItem('wooo:current-votes:' + themeIndex, JSON.stringify(votes));
  }


  // ======= LECTURE AUDIO =======
  list.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action !== 'play') return;
    const row = e.target.closest('.recap-row');
    const track = tracks.find(t => t.id === row.dataset.trackId);
    if (track) togglePlay(track);
  });

  function togglePlay(track) {
    if (currentPlayingId === track.id) {
      audio.pause();
      currentPlayingId = null;
    } else {
      audio.src = track.preview_url;
      audio.play();
      currentPlayingId = track.id;
    }
    updatePlayingState();
  }

  audio.addEventListener('ended', () => {
    currentPlayingId = null;
    updatePlayingState();
  });

  function updatePlayingState() {
    list.querySelectorAll('.recap-row').forEach(row => {
      const isPlaying = (currentPlayingId === row.dataset.trackId);
      const playBtn = row.querySelector('.recap-row__play');
      if (playBtn) playBtn.classList.toggle('is-active', isPlaying);
    });
  }


  // ======= BOUTON SUIVANT (sauvegarde + redirection) =======
  btnNext.addEventListener('click', async () => {
    btnNext.disabled = true;
    const originalText = btnNext.textContent;
    btnNext.textContent = 'Enregistrement…';
    audio.pause();

    try {
      let points = 0;
      tracks.forEach(t => {
        if (isVoteCorrect(t, votes[t.id])) points++;
      });
      const sansFaute = (points === tracks.length && tracks.length > 0);
      const bonus = sansFaute ? 2 : 0;

      await saveVotesAndScore(points, bonus);
      sessionStorage.removeItem('wooo:current-votes:' + themeIndex);

      if (themeIndex + 1 < totalThemes) {
        // Thème suivant
        window.location.href = 'guess.html?theme=' + (themeIndex + 1);
      } else {
        // FIN pour CE joueur uniquement → on va au classement
        // On ne change PAS le statut de la partie : les autres joueurs sont peut-être
        // encore en train de voter. Le classement saura calculer si tout le monde a fini.
        window.location.href = 'classement.html';
      }
    } catch (err) {
      console.error(err);
      btnNext.disabled = false;
      btnNext.textContent = originalText;
      alert('Oups : ' + err.message);
    }
  });


  async function saveVotesAndScore(points, bonus) {
    const promises = Object.entries(votes).map(([choixId, guessedId]) => {
      return fetch(Wooo.config.SUPABASE_URL + '/rest/v1/votes?on_conflict=voter_id,choix_id', {
        method: 'POST',
        headers: {
          'apikey': Wooo.config.SUPABASE_ANON,
          'Authorization': 'Bearer ' + Wooo.config.SUPABASE_ANON,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          partie_id: session.partie_id,
          voter_id: session.joueur_id,
          choix_id: choixId,
          guessed_id: guessedId,
        }),
      });
    });
    await Promise.all(promises);

    await fetch(Wooo.config.SUPABASE_URL + '/rest/v1/scores?on_conflict=joueur_id,theme_index', {
      method: 'POST',
      headers: {
        'apikey': Wooo.config.SUPABASE_ANON,
        'Authorization': 'Bearer ' + Wooo.config.SUPABASE_ANON,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        partie_id: session.partie_id,
        joueur_id: session.joueur_id,
        theme_index: themeIndex,
        points: points,
        bonus: bonus,
      }),
    });
  }


  // ======= NAVIGATION =======
  btnBack.addEventListener('click', () => {
    window.location.href = 'guess.html?theme=' + themeIndex;
  });

  btnClose.addEventListener('click', () => {
    if (confirm('Tu veux vraiment arrêter ?')) {
      window.location.href = 'index-musique.html';
    }
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  init();

})();
