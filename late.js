/* =========================================================
   WOOO MUSIQUE — Page "trop tard"
   ---------------------------------------------------------
   Quand un joueur clique sur le lien d'invitation d'une partie
   qui est DÉJÀ lancée (statut 'votes' ou 'terminee'), il arrive
   ici au lieu de la page join.html.
   On lui montre :
   - Un message expliquant qu'il arrive trop tard
   - Le classement en cours
   - 2 boutons : créer une partie / rejoindre une autre partie
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const list        = $('classement-list');
  const loadingEl   = $('classement-loading');
  const btnCreate   = $('btn-create');
  const btnJoinOther = $('btn-join-other');


  // ======= LECTURE DU PIN =======
  const params = new URLSearchParams(window.location.search);
  const pin = (params.get('pin') || '').trim();

  if (!pin || !/^\d{6}$/.test(pin)) {
    // Pas de PIN valide → retour à l'accueil
    window.location.replace('index.html');
    return;
  }


  // ======= CHARGEMENT DU CLASSEMENT =======
  async function load() {
    try {
      const partie = await Wooo.api.getPartieByPin(pin);
      if (!partie) {
        loadingEl.textContent = 'Cette partie n\'existe plus.';
        return;
      }

      const [joueurs, scores] = await Promise.all([
        Wooo.api.getJoueurs(partie.id),
        getScores(partie.id),
      ]);

      // On agrège les points par joueur
      const pointsByJoueur = {};
      scores.forEach(s => {
        pointsByJoueur[s.joueur_id] = (pointsByJoueur[s.joueur_id] || 0) + s.points + s.bonus;
      });

      const ranked = joueurs.map(j => ({
        ...j,
        points: pointsByJoueur[j.id] || 0,
      })).sort((a, b) => b.points - a.points || a.pseudo.localeCompare(b.pseudo));

      renderList(ranked);
    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'Erreur de chargement.';
    }
  }

  async function getScores(partieId) {
    const url = Wooo.config.SUPABASE_URL +
                '/rest/v1/scores?partie_id=eq.' + encodeURIComponent(partieId) + '&select=*';
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
    list.classList.add('no-anim');

    let prevPoints = null;
    let currentRank = 0;
    let displayedRank = 0;
    ranked.forEach(p => {
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
      const avatar = p.avatar || 1;
      const color = colors[idx % colors.length];

      let medalClass = '';
      if (rank === 1) medalClass = 'classement-row--gold';
      else if (rank === 2) medalClass = 'classement-row--silver';
      else if (rank === 3) medalClass = 'classement-row--bronze';

      return `
        <li class="classement-row ${medalClass}">
          <span class="classement-row__rank">${rank}</span>
          <span class="classement-row__tag" style="background: ${color}">
            <span class="classement-row__tag-avatar"><img src="assets/avatar${avatar}.png" alt="" /></span>
            ${escapeHtml(p.pseudo)}
          </span>
          <span class="classement-row__score">
            ${p.points}<span class="classement-row__score-pts">pts</span>
          </span>
        </li>
      `;
    }).join('');
  }


  // ======= BOUTONS =======
  btnCreate.addEventListener('click', () => {
    Wooo.session.clear();
    window.location.href = 'create.html';
  });

  btnJoinOther.addEventListener('click', () => {
    Wooo.session.clear();
    window.location.href = 'join.html';
  });

  const btnBack = $('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  load();

})();
