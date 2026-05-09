/* =========================================================
   WOOO — Recap des votes (avant validation)
   ---------------------------------------------------------
   - Récupère votes en cours depuis sessionStorage
   - Phase 'adjust' : permet d'échanger 2 attributions par clic
   - Phase 'results' : affiche ✓/✗ et points
   - Gère les doublons (2 personnes = même chanson)
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const btnClose        = $('btn-close');
  const progressDots    = $('progress-dots');
  const titleEl         = $('recap-title');
  const leadEl          = $('recap-lead');
  const list            = $('recap-list');
  const btnConfirm      = $('btn-confirm');
  const btnNext         = $('btn-next');
  const audio           = $('audio-player');


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const themeIndex = parseInt(params.get('theme') || '0', 10);
  const themeName = (session.themes && session.themes[themeIndex]) || '';
  const totalThemes = (session.themes || []).length;

  titleEl.textContent = themeName.toUpperCase();
  renderProgressDots();


  // ======= ÉTAT =======
  let phase = 'adjust';
  let allPlayers = [];
  let tracks = [];
  let votes = {};                  // { pick_id: joueur_id }
  let selectedTrackId = null;
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

      // Map deezer_id → joueurs (pour gérer les doublons)
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

    list.innerHTML = tracks.map((track, idx) => {
      const guessedId = votes[track.id];
      const guessed = allPlayers.find(p => p.id === guessedId);
      const isCorrect = phase === 'results' && isVoteCorrect(track, guessedId);
      const isWrong = phase === 'results' && !isCorrect;
      const cls = isCorrect ? ' recap-row--correct' : (isWrong ? ' recap-row--wrong' : '');
      const isSwapSource = (selectedTrackId === track.id);
      const swapCls = isSwapSource ? ' is-swap-source' : '';

      // Tag du joueur (si attribué)
      let tagHtml = '';
      if (guessed) {
        const playerIdx = allPlayers.findIndex(p => p.id === guessed.id);
        const color = colors[playerIdx % colors.length];
        const av = guessed.avatar || 1;
        tagHtml = `
          <span class="player-tag" style="background: ${color}">
            <span class="player-tag__avatar">
              <img src="assets/avatar${av}.png" alt="" />
            </span>
            ${escapeHtml(guessed.pseudo)}
          </span>
        `;
      }

      return `
        <li class="recap-row${cls}${swapCls}" data-track-id="${track.id}">
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
  }


  // ======= INTERACTION : échange par clic =======
  list.addEventListener('click', (e) => {
    if (phase !== 'adjust') return;
    const row = e.target.closest('.recap-row');
    if (!row) return;

    // Si on a cliqué sur le bouton play, on lit l'extrait
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'play') {
      const track = tracks.find(t => t.id === row.dataset.trackId);
      if (track) togglePlay(track);
      return;
    }

    const trackId = row.dataset.trackId;
    if (!selectedTrackId) {
      selectedTrackId = trackId;
      renderList();
    } else if (selectedTrackId === trackId) {
      // Même clic = annule
      selectedTrackId = null;
      renderList();
    } else {
      // Échange les 2 votes
      const a = selectedTrackId;
      const b = trackId;
      const tmp = votes[a];
      votes[a] = votes[b];
      votes[b] = tmp;
      // Si l'un était vide, on garde
      if (!votes[a]) delete votes[a];
      if (!votes[b]) delete votes[b];
      selectedTrackId = null;
      renderList();
    }
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
      const trackId = row.dataset.trackId;
      const isPlaying = (currentPlayingId === trackId);
      const playBtn = row.querySelector('.recap-row__play');
      if (playBtn) playBtn.classList.toggle('is-active', isPlaying);
    });
  }


  // ======= VALIDATION =======
  btnConfirm.addEventListener('click', async () => {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Calcul en cours…';

    try {
      let points = 0;
      tracks.forEach(t => {
        if (isVoteCorrect(t, votes[t.id])) points++;
      });
      const sansFaute = (points === tracks.length && tracks.length > 0);
      const bonus = sansFaute ? 2 : 0;

      await saveVotesAndScore(points, bonus);

      // Bascule en phase résultats
      phase = 'results';
      audio.pause();
      currentPlayingId = null;
      const totalGain = points + bonus;
      const totalText = sansFaute
        ? `Sans faute ! Tu remportes ${totalGain} points (dont ${bonus} de bonus) pour ce thème.`
        : `Tu remportes ${points} point${points > 1 ? 's' : ''} pour ce thème.`;
      leadEl.textContent = totalText;

      btnConfirm.hidden = true;

      if (themeIndex + 1 < totalThemes) {
        btnNext.hidden = false;
        btnNext.textContent = `Je passe au thème n°${themeIndex + 2}`;
      } else {
        btnNext.hidden = false;
        btnNext.textContent = 'Voir le classement';
      }

      renderList();

      // Nettoie le sessionStorage
      sessionStorage.removeItem('wooo:current-votes:' + themeIndex);

    } catch (err) {
      console.error(err);
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Je veux voir les résultats !';
      alert('Oups : ' + err.message);
    }
  });


  btnNext.addEventListener('click', () => {
    if (themeIndex + 1 < totalThemes) {
      window.location.href = 'guess.html?theme=' + (themeIndex + 1);
    } else {
      // Marquer la partie comme terminée
      Wooo.api.setPartieStatus(session.partie_id, 'terminee').catch(err => {
        console.warn('Statut terminée ignoré :', err);
      });
      window.location.href = 'classement.html';
    }
  });


  async function saveVotesAndScore(points, bonus) {
    // 1) Pour chaque vote, on insert/update dans la table votes
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

    // 2) Score
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
      window.location.href = 'index.html';
    }
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  init();

})();
