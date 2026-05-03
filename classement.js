/* =========================================================
   WOOO MUSIQUE — Page classement
   ---------------------------------------------------------
   - Récupère tous les scores de la partie depuis Supabase
   - Agrège : pour chaque joueur, somme des points + bonus
   - Affiche le classement (1er = plus de points)
   - Si tous les joueurs n'ont pas encore voté → bandeau "en cours"
   - Refresh toutes les 5s pour suivre la progression
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const list        = $('classement-list');
  const loadingEl   = $('classement-loading');
  const banner      = $('classement-banner');
  const bannerSmall = $('classement-banner-small');
  const subtitleEl  = $('classement-subtitle');
  const btnReplay   = $('btn-replay');


  // ======= LECTURE DE LA SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id) {
    window.location.replace('index.html');
    return;
  }

  const totalThemes = session.themes ? session.themes.length : 0;


  // ======= ÉTAT =======
  let pollTimer = null;
  let lastSignature = '';
  let firstRender = true;


  // ======= CHARGEMENT DES SCORES =======
  async function load() {
    try {
      const [joueurs, scores, picks, votes] = await Promise.all([
        Wooo.api.getJoueurs(session.partie_id),
        getScores(session.partie_id),
        Wooo.api.getPicksForPartie(session.partie_id),
        Wooo.api.getVotesForPartie(session.partie_id),
      ]);

      // Calcul d'une signature pour détecter les changements
      const sig = JSON.stringify([
        joueurs.map(j => j.id + ':' + j.pseudo),
        scores.map(s => s.joueur_id + ':' + s.points + ':' + s.bonus),
        votes.length,
      ]);
      // Si rien n'a changé, on saute le re-render (= pas de saut visuel)
      if (sig === lastSignature) return;
      lastSignature = sig;

      // On compte par joueur combien de thèmes il a votés
      const themesByJoueur = {};
      const pointsByJoueur = {};
      scores.forEach(s => {
        themesByJoueur[s.joueur_id] = (themesByJoueur[s.joueur_id] || 0) + 1;
        pointsByJoueur[s.joueur_id] = (pointsByJoueur[s.joueur_id] || 0) + s.points + s.bonus;
      });

      // Tri : par points décroissants, puis nom
      const ranked = joueurs.map(j => ({
        ...j,
        points: pointsByJoueur[j.id] || 0,
        themesDone: themesByJoueur[j.id] || 0,
      })).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.pseudo.localeCompare(b.pseudo);
      });

      // Quelqu'un n'a pas fini ? On affiche un bandeau d'attente
      const waiting = ranked.filter(p => p.themesDone < totalThemes);
      if (waiting.length > 0) {
        banner.hidden = false;
        bannerSmall.textContent =
          'En attente de ' + waiting.map(p => p.pseudo).join(', ') +
          ' (' + waiting.length + ' joueur' + (waiting.length > 1 ? 's' : '') + ')';
      } else {
        banner.hidden = true;
        // Tout le monde a voté → on marque la partie comme terminée
        // (idempotent : on peut le faire plusieurs fois sans souci)
        try {
          await Wooo.api.setPartieStatus(session.partie_id, 'terminee');
        } catch (e) {
          // Pas grave si ça échoue (pourrait déjà être 'terminee')
        }
      }

      renderList(ranked);

      // Récap par thème : visible uniquement si J'AI fini mes votes
      // (sinon ce serait du spoiler)
      const myThemesDone = themesByJoueur[session.joueur_id] || 0;
      if (myThemesDone >= totalThemes) {
        renderRecap(joueurs, picks, votes);
      }

    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'Erreur de chargement.';
    }
  }


  // ======= RÉCAP PAR JOUEUR =======
  // Pour chaque autre joueur, on liste ses votes sur tous les thèmes :
  // pour chaque chanson qu'il devait deviner, qui il a voté + ✓/✗
  function renderRecap(joueurs, picks, votes) {
    const recapSection = $('recap-themes');
    const recapList    = $('recap-themes-list');

    // Index pratique pour lookup rapide
    const playerById = {};
    joueurs.forEach(p => { playerById[p.id] = p; });

    // On liste tous les joueurs sauf moi (mes propres votes sont déjà
    // affichés dans le récap thème par thème pendant le jeu)
    const otherPlayers = joueurs.filter(p => p.id !== session.joueur_id);

    let html = '';

    otherPlayers.forEach(player => {
      const avatar = player.avatar || 1;

      html += `
        <div class="theme-recap">
          <h3 class="theme-recap__title player-recap-title">
            <div class="player-recap-avatar">
              <img src="assets/avatar${avatar}.png" alt="" />
            </div>
            <span>Les votes de <strong>${escapeHtml(player.pseudo)}</strong></span>
          </h3>
      `;

      // Pour chaque thème, on affiche les chansons à deviner pour ce joueur
      // (= toutes les chansons sauf les siennes)
      for (let themeIdx = 0; themeIdx < totalThemes; themeIdx++) {
        const themePicks = picks.filter(p =>
          p.theme_index === themeIdx && p.joueur_id !== player.id
        );

        if (themePicks.length === 0) continue;

        // Map deezer_id → liste de joueurs ayant choisi cette musique sur ce thème
        // (pour gérer les doublons : voter n'importe lequel = bonne réponse)
        const allThemePicks = picks.filter(p => p.theme_index === themeIdx);
        const playersByDeezerId = {};
        allThemePicks.forEach(p => {
          if (!playersByDeezerId[p.deezer_id]) playersByDeezerId[p.deezer_id] = [];
          playersByDeezerId[p.deezer_id].push(p.joueur_id);
        });

        html += `<p class="player-recap-theme-label">Thème ${themeIdx + 1} — ${escapeHtml(session.themes[themeIdx])}</p>`;
        html += `<ul class="votes-list">`;

        themePicks.forEach(pick => {
          const author = playerById[pick.joueur_id];
          if (!author) return;

          const vote = votes.find(v => v.choix_id === pick.id && v.voter_id === player.id);

          let rightHtml = '';
          if (!vote) {
            rightHtml = `<span class="vote-row__verdict vote-row__verdict--waiting">En attente</span>`;
          } else {
            const guessed = playerById[vote.guessed_id];
            // Bonne réponse si le joueur voté a choisi la MÊME musique (par deezer_id)
            const acceptableIds = playersByDeezerId[pick.deezer_id] || [author.id];
            const isCorrect = acceptableIds.includes(vote.guessed_id);
            const verdictCls = isCorrect ? 'vote-row__verdict--correct' : 'vote-row__verdict--wrong';
            const verdictIcon = isCorrect ? '✓' : '✗';
            rightHtml = `
              <span class="vote-row__guessed-text">→ a voté <strong>${escapeHtml((guessed && guessed.pseudo) || '?')}</strong></span>
              <span class="vote-row__verdict ${verdictCls}">${verdictIcon}</span>
            `;
          }

          html += `
            <li class="vote-row vote-row--by-player">
              <div class="vote-row__song-cover">
                <img src="${escapeHtml(pick.cover || '')}" alt="" onerror="this.style.display='none'" />
              </div>
              <div class="vote-row__song-info">
                <p class="vote-row__song-title">${escapeHtml(pick.title)}</p>
                <p class="vote-row__song-artist">${escapeHtml(pick.artist)} · choix de <strong>${escapeHtml(author.pseudo)}</strong></p>
              </div>
              <div class="vote-row__guess">
                ${rightHtml}
              </div>
            </li>
          `;
        });

        html += `</ul>`;
      }

      html += `</div>`;
    });

    recapList.innerHTML = html;
    recapSection.hidden = false;
  }

  /** Récupère les scores d'une partie depuis Supabase */
  async function getScores(partieId) {
    const url = Wooo.config.SUPABASE_URL +
                '/rest/v1/scores?partie_id=eq.' + encodeURIComponent(partieId) +
                '&select=*';
    const resp = await fetch(url, {
      headers: {
        'apikey': Wooo.config.SUPABASE_ANON,
        'Authorization': 'Bearer ' + Wooo.config.SUPABASE_ANON,
      },
    });
    if (!resp.ok) throw new Error('Erreur lecture scores');
    return await resp.json();
  }


  // ======= RENDU DU CLASSEMENT =======
  function renderList(ranked) {
    loadingEl.hidden = true;

    // Désactive l'animation à partir du 2e rendu (évite les sauts visuels au polling)
    if (!firstRender) {
      list.classList.add('no-anim');
    } else {
      firstRender = false;
    }

    // Calcul des rangs (avec gestion des ex æquo)
    let prevPoints = null;
    let currentRank = 0;
    let displayedRank = 0;
    ranked.forEach((p, i) => {
      currentRank++;
      if (p.points !== prevPoints) {
        displayedRank = currentRank;
        prevPoints = p.points;
      }
      p._rank = displayedRank;
    });

    list.innerHTML = ranked.map((p, i) => {
      const rank = p._rank;
      const suffix = ordinalSuffix(rank);
      const isMe = (p.id === session.joueur_id);
      const avatar = p.avatar || 1;

      let medalClass = '';
      if (rank === 1) medalClass = 'classement-row--gold';
      else if (rank === 2) medalClass = 'classement-row--silver';
      else if (rank === 3) medalClass = 'classement-row--bronze';

      const hasVoted = p.themesDone > 0;
      const hasFinished = p.themesDone >= totalThemes;

      return `
        <li class="classement-row ${medalClass}">
          <span class="classement-row__rank">
            ${rank}<span class="classement-row__rank-suffix">${suffix}</span>
          </span>
          <div class="classement-row__avatar">
            <img src="assets/avatar${avatar}.png" alt="" />
          </div>
          <div class="classement-row__player">
            <span class="classement-row__name">${escapeHtml(p.pseudo)}${isMe ? '<span class="classement-row__me">toi</span>' : ''}</span>
          </div>
          <div class="classement-row__score">
            ${
              hasVoted
                ? `<span class="classement-row__points">${p.points}</span>
                   <span class="classement-row__pts-label">pts${!hasFinished ? ' • en cours' : ''}</span>`
                : `<span class="classement-row__waiting">en attente</span>`
            }
          </div>
        </li>
      `;
    }).join('');
  }

  function ordinalSuffix(n) {
    if (n === 1) return 'er';
    return 'e';
  }


  // ======= NOUVELLE PARTIE =======
  btnReplay.addEventListener('click', () => {
    Wooo.session.clear();
    window.location.href = 'create.html';
  });


  // ======= UTILITAIRES =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT + POLLING =======
  load();
  // Refresh toutes les 15 secondes pour suivre les votes des autres
  // (le rendu silencieux évite tout saut visuel)
  pollTimer = setInterval(load, 15000);
  window.addEventListener('beforeunload', () => clearInterval(pollTimer));

})();
