/* =========================================================
   WOOO — Classement final
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const btnClose        = $('btn-close');
  const progressDots    = $('progress-dots');
  const titleEl         = $('classement-title');
  const leadEl          = $('classement-lead');
  const list            = $('classement-list');
  const loadingEl       = $('classement-loading');
  const btnInfo         = $('btn-info');
  const infoModal       = $('info-modal');
  const recapSection    = $('recap-by-player');
  const recapList       = $('recap-by-player-list');
  const btnRelaunch     = $('btn-relaunch');
  const btnNew          = $('btn-new');


  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  const totalThemes = (session.themes || []).length;
  let pollTimer = null;
  let lastSig = '';
  let firstRender = true;

  renderProgressDots();

  // Adaptation produit (musique vs ciné)
  const isCine = session.produit === 'cine';
  document.documentElement.setAttribute('data-product', isCine ? 'cine' : 'musique');
  if (isCine) {
    // Adapter les textes de la modale "Comment sont calculés les points ?"
    document.querySelectorAll('.rules-card p').forEach(p => {
      p.textContent = p.textContent
        .replace(/chanson/gi, 'film')
        .replace(/musique/gi, 'film');
    });
  }


  function renderProgressDots() {
    // Partie terminée → toutes les pastilles en orange foncé sans numéro
    let html = '';
    for (let i = 0; i < totalThemes; i++) {
      html += `<span class="progress-dot is-done"></span>`;
    }
    progressDots.innerHTML = html;
  }


  // ======= CHARGEMENT =======
  async function load() {
    try {
      const [joueurs, scores, picks, votes] = await Promise.all([
        Wooo.api.getJoueurs(session.partie_id),
        getScores(session.partie_id),
        Wooo.api.getPicksForPartie(session.partie_id),
        Wooo.api.getVotesForPartie(session.partie_id),
      ]);

      const sig = JSON.stringify([
        joueurs.map(j => j.id + ':' + j.pseudo),
        scores.map(s => s.joueur_id + ':' + s.points + ':' + s.bonus),
        votes.length,
      ]);
      if (sig === lastSig) return;
      lastSig = sig;

      // Compte points par joueur
      const themesByJoueur = {};
      const pointsByJoueur = {};
      scores.forEach(s => {
        themesByJoueur[s.joueur_id] = (themesByJoueur[s.joueur_id] || 0) + 1;
        pointsByJoueur[s.joueur_id] = (pointsByJoueur[s.joueur_id] || 0) + s.points + s.bonus;
      });

      const ranked = joueurs.map(j => ({
        ...j,
        points: pointsByJoueur[j.id] || 0,
        themesDone: themesByJoueur[j.id] || 0,
        finished: (themesByJoueur[j.id] || 0) >= totalThemes,
      })).sort((a, b) => {
        // Tri : 1) finished avant pas finished, 2) points desc, 3) themesDone desc, 4) pseudo
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (b.points !== a.points) return b.points - a.points;
        if (b.themesDone !== a.themesDone) return b.themesDone - a.themesDone;
        return a.pseudo.localeCompare(b.pseudo);
      });

      // Tout le monde a fini ?
      const everyoneDone = ranked.every(p => p.finished);
      if (everyoneDone) {
        titleEl.textContent = 'C\'EST FINI !';
        leadEl.textContent = `Bravo à ${ranked[0]?.pseudo || 'l\'équipe'} qui remporte la partie !`;
        // Cache le bouton "Relancer tes potes" puisque tout le monde a voté
        if (btnRelaunch) btnRelaunch.hidden = true;
        // Marquer la partie comme terminée
        Wooo.api.setPartieStatus(session.partie_id, 'terminee').catch(() => {});
      } else {
        const remaining = ranked.filter(p => !p.finished).length;
        leadEl.textContent = `Voici le classement intermédiaire, on attend encore ${remaining} retardataire${remaining > 1 ? 's' : ''} !`;
        if (btnRelaunch) btnRelaunch.hidden = false;
      }

      renderList(ranked);

      // Récap par joueur (si j'ai fini)
      const myDone = themesByJoueur[session.joueur_id] || 0;
      if (myDone >= totalThemes) {
        renderRecap(joueurs, picks, votes);
      }

    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'Erreur de chargement.';
    }
  }


  async function getScores(partieId) {
    const url = Wooo.config.SUPABASE_URL + '/rest/v1/scores?partie_id=eq.' + encodeURIComponent(partieId) + '&select=*';
    const resp = await fetch(url, {
      headers: {
        'apikey': Wooo.config.SUPABASE_ANON,
        'Authorization': 'Bearer ' + Wooo.config.SUPABASE_ANON,
      },
    });
    if (!resp.ok) throw new Error('Erreur scores');
    return await resp.json();
  }


  function renderList(ranked) {
    loadingEl.hidden = true;
    if (!firstRender) {
      list.classList.add('no-anim');
    } else {
      firstRender = false;
    }

    // Calcul des rangs avec ex-aequo, UNIQUEMENT pour les joueurs ayant fini
    let prevPoints = null;
    let currentRank = 0;
    let displayedRank = 0;
    ranked.forEach(p => {
      if (!p.finished) {
        p._rank = null;
        return;
      }
      currentRank++;
      if (p.points !== prevPoints) {
        displayedRank = currentRank;
        prevPoints = p.points;
      }
      p._rank = displayedRank;
    });

    const colors = (Wooo.config && Wooo.config.PLAYER_COLORS) || [];

    list.innerHTML = ranked.map((p, idx) => {
      const rank = p._rank;
      let medalClass = '';
      if (rank === 1) medalClass = 'classement-row--gold';
      else if (rank === 2) medalClass = 'classement-row--silver';
      else if (rank === 3) medalClass = 'classement-row--bronze';

      const isMe = (p.id === session.joueur_id);
      const isWaiting = !p.finished;
      const color = colors[idx % colors.length];
      const av = p.avatar || 1;

      return `
        <li class="classement-row ${medalClass} ${isWaiting ? 'classement-row--waiting' : ''}">
          <span class="classement-row__rank">${rank !== null ? rank : '—'}</span>
          <span class="classement-row__tag" style="background: ${color}">
            <span class="classement-row__tag-avatar"><img src="assets/avatar${av}.png" alt="" /></span>
            ${escapeHtml(p.pseudo)}${isMe ? '<span class="classement-row__me-badge">TOI</span>' : ''}
          </span>
          <span class="classement-row__score">
            ${isWaiting ? '…' : p.points}<span class="classement-row__score-pts">${isWaiting ? '' : 'pts'}</span>
          </span>
        </li>
      `;
    }).join('');
  }


  function renderRecap(joueurs, picks, votes) {
    const playerById = {};
    joueurs.forEach(p => { playerById[p.id] = p; });

    // Mes votes en premier, puis ceux des autres
    const me = joueurs.find(p => p.id === session.joueur_id);
    const others = joueurs.filter(p => p.id !== session.joueur_id);
    const orderedPlayers = me ? [me, ...others] : others;

    let html = '';
    orderedPlayers.forEach(player => {
      const av = player.avatar || 1;
      const isMe = player.id === session.joueur_id;
      const blockTitle = isMe ? 'Tes votes' : `Les votes de ${escapeHtml(player.pseudo)}`;
      html += `
        <div class="player-recap-block">
          <div class="player-recap-block__head">
            <div class="player-recap-block__avatar"><img src="assets/avatar${av}.png" alt="" /></div>
            <span class="player-recap-block__name">${blockTitle}</span>
          </div>
      `;

      for (let themeIdx = 0; themeIdx < totalThemes; themeIdx++) {
        const themePicks = picks.filter(p => p.theme_index === themeIdx && p.joueur_id !== player.id);
        if (themePicks.length === 0) continue;

        const allThemePicks = picks.filter(p => p.theme_index === themeIdx);
        const playersByDeezerId = {};
        allThemePicks.forEach(p => {
          if (!playersByDeezerId[p.deezer_id]) playersByDeezerId[p.deezer_id] = [];
          playersByDeezerId[p.deezer_id].push(p.joueur_id);
        });

        html += `<p class="player-recap-theme-label">Thème ${themeIdx + 1} — ${escapeHtml(session.themes[themeIdx])}</p>`;
        html += `<div>`;

        themePicks.forEach(pick => {
          const author = playerById[pick.joueur_id];
          if (!author) return;
          const vote = votes.find(v => v.choix_id === pick.id && v.voter_id === player.id);

          let verdictHtml = '';
          if (!vote) {
            verdictHtml = '<span class="vote-row__verdict vote-row__verdict--waiting">En attente</span>';
          } else {
            const acceptable = playersByDeezerId[pick.deezer_id] || [author.id];
            const isCorrect = acceptable.includes(vote.guessed_id);
            const guessed = playerById[vote.guessed_id];
            verdictHtml = `<span class="vote-row__verdict ${isCorrect ? 'vote-row__verdict--correct' : 'vote-row__verdict--wrong'}">${isCorrect ? '✓' : '✗'}</span>`;
            // ajout de l'info du vote
            html += `
              <div class="vote-row">
                <div class="vote-row__cover"><img src="${escapeHtml(pick.cover || '')}" alt="" onerror="this.style.display='none'" /></div>
                <div class="vote-row__info">
                  <p class="vote-row__title">${escapeHtml(pick.title)}</p>
                  <p class="vote-row__sub">a voté <strong>${escapeHtml((guessed && guessed.pseudo) || '?')}</strong> · choix de <strong>${escapeHtml(author.pseudo)}</strong></p>
                </div>
                ${verdictHtml}
              </div>
            `;
            return;
          }

          html += `
            <div class="vote-row">
              <div class="vote-row__cover"><img src="${escapeHtml(pick.cover || '')}" alt="" onerror="this.style.display='none'" /></div>
              <div class="vote-row__info">
                <p class="vote-row__title">${escapeHtml(pick.title)}</p>
                <p class="vote-row__sub">choix de <strong>${escapeHtml(author.pseudo)}</strong></p>
              </div>
              ${verdictHtml}
            </div>
          `;
        });

        html += `</div>`;
      }

      html += `</div>`;
    });

    recapList.innerHTML = html;
    recapSection.hidden = false;
  }


  // ======= MODALE INFO =======
  btnInfo.addEventListener('click', () => {
    infoModal.hidden = false;
    document.body.style.overflow = 'hidden';
  });
  infoModal.addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined || e.target.closest('[data-close]')) {
      infoModal.hidden = true;
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !infoModal.hidden) {
      infoModal.hidden = true;
      document.body.style.overflow = '';
    }
  });


  // ======= ACTIONS =======
  btnRelaunch.addEventListener('click', async () => {
    const url = window.location.origin + window.location.pathname.replace(/[^/]+$/, '')
              + 'join.html?pin=' + encodeURIComponent(session.pin_code);
    const text = `Relance ! Code Wooo : ${session.pin_code}`;
    await Wooo.share.shareOrCopyLink({
      url, text, title: 'Wooo',
      onCopied: () => alert('Lien copié !'),
    });
  });

  btnNew.addEventListener('click', () => {
    Wooo.session.clear();
    window.location.href = 'create.html';
  });

  btnBack.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  btnClose.addEventListener('click', () => {
    window.location.href = 'index.html';
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // INIT + POLLING (15s)
  load();
  pollTimer = setInterval(load, 15000);
  window.addEventListener('beforeunload', () => clearInterval(pollTimer));

})();
