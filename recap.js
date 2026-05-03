/* =========================================================
   WOOO MUSIQUE — Page récap
   ---------------------------------------------------------
   Phase 1 — AJUSTEMENT
   - Liste des chansons à deviner avec leur attribution
   - PLUS un rappel de TON propre morceau pour ce thème (non modifiable)
   - Mécanique d'échange entre 2 attributions :
     * 1er clic sur un joueur attribué → sélectionné (fond rempli, pulse)
     * 2e clic sur un AUTRE joueur attribué → on échange leurs chansons
     * Clic sur le même → désélection
   - Clic sur la pochette → lit/met en pause l'extrait
   - Bouton "Je confirme ces choix"

   Phase 2 — RÉSULTATS
   - Calcul +1 par bonne réponse, +2 si sans-faute
   - Verdict animé par chanson + bon joueur si erreur
   - Enregistrement votes + score en base Supabase
   - Bouton "Thème suivant" ou "Voir le classement"
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const themeTitleEl   = $('theme-title');
  const themeNumEl     = $('theme-num');
  const themeTotalEl   = $('theme-total');
  const subtitleEl     = $('recap-subtitle');
  const hintEl         = $('recap-hint');
  const list           = $('recap-list');
  const actionsConfirm = $('actions-confirm');
  const actionsNext    = $('actions-next');
  const btnConfirm     = $('btn-confirm');
  const btnNext        = $('btn-next');
  const audio          = $('audio-player');


  // ======= LECTURE DE LA SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const themeIndex = parseInt(params.get('theme') || '0', 10);
  if (themeIndex < 0 || themeIndex >= session.themes.length) {
    window.location.replace('classement.html');
    return;
  }


  // ======= CHARGEMENT DES DONNÉES LOCALES =======
  const recapKey = 'wooo:recap:' + session.partie_id + ':' + themeIndex;
  const stored = JSON.parse(localStorage.getItem(recapKey) || '{}');
  let tracks = stored.tracks || [];
  let votes  = stored.votes  || {};
  let myPick = stored.myPick || null;
  let allPlayers = [];


  if (tracks.length === 0) {
    window.location.replace('guess.html?theme=' + themeIndex);
    return;
  }


  // ======= ÉTAT =======
  let phase = 'adjust';
  // Pour la mécanique d'échange : on retient quel TRACK on a sélectionné
  // (puisque c'est l'attribution joueur de ce track qu'on va échanger)
  let selectedTrackId = null;

  // Map deezer_id → liste de joueurs ayant choisi cette musique
  // (pour gérer les doublons : si Alice ET Bob ont choisi la même chanson,
  // voter Alice OU Bob compte comme bonne réponse)
  let playersByDeezerId = {};


  // ======= INIT =======
  async function init() {
    themeTitleEl.textContent = session.themes[themeIndex];
    themeNumEl.textContent = `Thème ${themeIndex + 1}`;
    themeTotalEl.textContent = `sur ${session.themes.length}`;

    try {
      const [joueurs, allPicks] = await Promise.all([
        Wooo.api.getJoueurs(session.partie_id),
        Wooo.api.getPicksForPartie(session.partie_id),
      ]);
      allPlayers = joueurs;

      // Construit la map deezer_id → liste de joueurs (pour les doublons)
      const themePicks = allPicks.filter(p => p.theme_index === themeIndex);
      playersByDeezerId = {};
      themePicks.forEach(p => {
        if (!playersByDeezerId[p.deezer_id]) playersByDeezerId[p.deezer_id] = [];
        playersByDeezerId[p.deezer_id].push(p.joueur_id);
      });

      renderList();
    } catch (err) {
      console.error(err);
      list.innerHTML = '<p style="color:var(--color-red); text-align:center;">Erreur de chargement.</p>';
    }
  }


  /** Vérifie si le vote est correct, en tenant compte des doublons. */
  function isVoteCorrect(track, guessedId) {
    if (!guessedId) return false;
    const acceptableIds = playersByDeezerId[track.deezer_id] || [track.joueur_id];
    return acceptableIds.includes(guessedId);
  }


  // ======= RENDU =======
  function renderList() {
    list.classList.toggle('is-results', phase === 'results');

    let html = '';

    // 1. RAPPEL : mon propre morceau (en haut, non modifiable)
    //    Affiché uniquement en phase ajustement (pas dans les résultats)
    if (phase === 'adjust' && myPick) {
      html += `
        <li class="recap-row recap-row--mine">
          <span class="recap-row__num"></span>
          <div class="recap-row__cover" data-action="play-mine">
            <img src="${escapeHtml(myPick.cover || '')}" alt="" onerror="this.style.display='none'" />
          </div>
          <div class="recap-row__info">
            <p class="recap-row__title">${escapeHtml(myPick.title)}</p>
            <p class="recap-row__artist">${escapeHtml(myPick.artist)}</p>
          </div>
          <span class="recap-row__mine-tag">
            <span class="player-row__dot"></span>
            Ton choix
          </span>
        </li>
      `;
    }

    // 2. LES CHANSONS À DEVINER (avec leur attribution)
    tracks.forEach((track, idx) => {
      const guessedId = votes[track.id];
      const guessed = allPlayers.find(p => p.id === guessedId);

      const isCorrect = phase === 'results' && isVoteCorrect(track, guessedId);
      const isWrong   = phase === 'results' && !isCorrect && guessedId;
      const correctPlayer = allPlayers.find(p => p.id === track.joueur_id);

      const cls = isCorrect ? ' recap-row--correct' : (isWrong ? ' recap-row--wrong' : '');

      let rightCell = '';
      if (phase === 'adjust') {
        const isSelected = (selectedTrackId === track.id);
        const selCls = isSelected ? ' is-selected' : '';
        if (guessed) {
          rightCell = `
            <button type="button"
                    class="recap-row__player${selCls}"
                    style="color: ${escapeHtml(guessed.color)}"
                    data-action="select"
                    data-track-id="${escapeHtml(track.id)}">
              <span class="player-row__dot"></span>
              <span class="recap-row__player-name">${escapeHtml(guessed.pseudo)}</span>
            </button>
          `;
        } else {
          rightCell = `
            <span class="recap-row__player" style="color: var(--color-grey)">
              <span class="player-row__dot"></span>
              <span class="recap-row__player-name">À choisir</span>
            </span>
          `;
        }
      } else {
        // Phase résultats
        rightCell = `
          <span class="recap-row__verdict ${isCorrect ? 'recap-row__verdict--correct' : 'recap-row__verdict--wrong'}">
            ${isCorrect ? '✓' : '✗'}
          </span>
        `;
      }

      html += `
        <li class="recap-row${cls}" data-track-id="${escapeHtml(track.id)}">
          <span class="recap-row__num">${idx + 1}</span>
          <div class="recap-row__cover" data-action="play">
            <img src="${escapeHtml(track.cover || '')}" alt="" onerror="this.style.display='none'" />
          </div>
          <div class="recap-row__info">
            <p class="recap-row__title">${escapeHtml(track.title)}</p>
            <p class="recap-row__artist">${escapeHtml(track.artist)}</p>
          </div>
          ${rightCell}
          ${
            phase === 'results' && isWrong
              ? `<p class="recap-row__correct-answer">→ C'était <strong>${escapeHtml((correctPlayer && correctPlayer.pseudo) || '?')}</strong></p>`
              : ''
          }
        </li>
      `;
    });

    list.innerHTML = html;
  }


  // ======= ÉCOUTEUR DE CLICS DANS LA LISTE =======
  list.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;

    // ----- Lecture audio sur la pochette (mon morceau) -----
    if (action === 'play-mine') {
      if (!myPick) return;
      togglePlay(myPick.preview_url, e.target.closest('.recap-row'));
      return;
    }

    // ----- Lecture audio sur une pochette à deviner -----
    if (action === 'play') {
      const row = e.target.closest('.recap-row');
      const trackId = row && row.dataset.trackId;
      const track = tracks.find(t => t.id === trackId);
      if (!track) return;
      togglePlay(track.preview_url, row);
      return;
    }

    // ----- Sélection / échange d'un joueur attribué (uniquement en phase ajustement) -----
    if (action === 'select' && phase === 'adjust') {
      const btn = e.target.closest('[data-action="select"]');
      const clickedTrackId = btn.dataset.trackId;

      if (!selectedTrackId) {
        // Premier clic : on sélectionne
        selectedTrackId = clickedTrackId;
        renderList();
      } else if (selectedTrackId === clickedTrackId) {
        // Re-clic sur le même : on désélectionne
        selectedTrackId = null;
        renderList();
      } else {
        // 2e clic sur un autre : on échange les attributions
        const tmp = votes[selectedTrackId];
        votes[selectedTrackId] = votes[clickedTrackId];
        votes[clickedTrackId] = tmp;

        selectedTrackId = null;
        saveLocalVotes();
        renderList();
      }
      return;
    }
  });


  // ======= LECTURE AUDIO =======
  function togglePlay(previewUrl, row) {
    if (!previewUrl) return;

    if (audio.src && audio.src.includes(previewUrl) && !audio.paused) {
      audio.pause();
      list.querySelectorAll('.recap-row.is-playing').forEach(r => r.classList.remove('is-playing'));
      return;
    }

    list.querySelectorAll('.recap-row.is-playing').forEach(r => r.classList.remove('is-playing'));
    audio.src = previewUrl;
    audio.play().catch(err => console.warn(err));
    if (row) row.classList.add('is-playing');
  }

  audio.addEventListener('ended', () => {
    list.querySelectorAll('.recap-row.is-playing').forEach(r => r.classList.remove('is-playing'));
  });


  // ======= CONFIRMATION → PHASE RÉSULTATS =======
  btnConfirm.addEventListener('click', async () => {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Calcul en cours…';

    try {
      // 1. Calcul du score, avec gestion des DOUBLONS de musique :
      // si Alice ET Bob ont choisi la même chanson, voter Alice OU Bob compte.
      let points = 0;
      tracks.forEach(t => {
        if (isVoteCorrect(t, votes[t.id])) points++;
      });

      const sansFaute = (points === tracks.length && tracks.length > 0);
      const bonus = sansFaute ? 2 : 0;

      // 2. Enregistrement en base
      await saveVotesAndScore(points, bonus);

      // 3. Bascule en phase résultats
      phase = 'results';
      audio.pause();
      audio.src = '';
      subtitleEl.textContent = 'Voici tes résultats !';
      hintEl.style.display = 'none';
      actionsConfirm.hidden = true;
      actionsNext.hidden = false;

      const isLastTheme = (themeIndex === session.themes.length - 1);
      btnNext.textContent = isLastTheme ? 'Voir le classement' : 'Thème suivant';

      renderList();
      renderScoreFooter(points, bonus, tracks.length);

    } catch (err) {
      console.error(err);
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Je confirme ces choix';
      alert('Oups : ' + err.message);
    }
  });


  // ======= ENREGISTREMENT EN BASE =======
  async function saveVotesAndScore(points, bonus) {
    const headers = {
      'apikey': Wooo.config.SUPABASE_ANON,
      'Authorization': 'Bearer ' + Wooo.config.SUPABASE_ANON,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    };

    // 1. Votes (upsert sur (voter_id, choix_id))
    const REST = Wooo.config.SUPABASE_URL + '/rest/v1/votes?on_conflict=voter_id,choix_id';
    const voteRows = Object.entries(votes).map(([choixId, guessedId]) => ({
      partie_id:  session.partie_id,
      voter_id:   session.joueur_id,
      choix_id:   choixId,
      guessed_id: guessedId,
    }));
    if (voteRows.length > 0) {
      const resp = await fetch(REST, {
        method: 'POST',
        headers,
        body: JSON.stringify(voteRows),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error('Erreur enregistrement votes : ' + err);
      }
    }

    // 2. Score (upsert sur (joueur_id, theme_index))
    const scoreUrl = Wooo.config.SUPABASE_URL +
                     '/rest/v1/scores?on_conflict=joueur_id,theme_index';
    const respScore = await fetch(scoreUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        partie_id:   session.partie_id,
        joueur_id:   session.joueur_id,
        theme_index: themeIndex,
        points:      points,
        bonus:       bonus,
      }),
    });
    if (!respScore.ok) {
      const err = await respScore.text();
      throw new Error('Erreur enregistrement score : ' + err);
    }
  }


  // ======= AFFICHAGE DU SCORE EN BAS =======
  function renderScoreFooter(points, bonus, total) {
    const totalPts = points + bonus;
    const wrap = document.createElement('div');
    wrap.className = 'recap-score';
    wrap.innerHTML = `
      <p class="recap-score__value">${totalPts}</p>
      <p class="recap-score__label">point${totalPts > 1 ? 's' : ''} sur ce thème</p>
      ${bonus > 0 ? `<span class="recap-score__bonus">🎉 SANS FAUTE — bonus +${bonus}</span>` : ''}
    `;
    list.parentElement.appendChild(wrap);
  }


  // ======= NAVIGATION =======
  btnNext.addEventListener('click', () => {
    localStorage.removeItem(recapKey);
    localStorage.removeItem('wooo:votes:' + session.partie_id + ':' + themeIndex);

    const next = themeIndex + 1;
    if (next < session.themes.length) {
      window.location.href = 'guess.html?theme=' + next;
    } else {
      window.location.href = 'classement.html';
    }
  });


  // ======= UTILITAIRES =======
  function saveLocalVotes() {
    localStorage.setItem(recapKey, JSON.stringify({ tracks, votes, myPick }));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  init();

})();
