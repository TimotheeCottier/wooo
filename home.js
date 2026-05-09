/* =========================================================
   WOOO — Homepage
   ---------------------------------------------------------
   - Affiche les parties en cours (depuis localStorage + état Supabase)
   - Bouton "Je crée une partie" → create.html
   - Bouton "Je rejoins une partie" → join.html
   - Modale "Comment jouer ?" avec 3 cartes de règles
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const btnCreate     = $('btn-create');
  const btnJoin       = $('btn-join');
  const btnHow        = $('btn-how');
  const btnBackHub    = $('btn-back-hub');

  // Bouton retour vers le hub multi-produit
  if (btnBackHub) {
    btnBackHub.addEventListener('click', () => {
      window.location.href = 'hub.html';
    });
  }
  const howModal      = $('how-modal');
  const activeBlock   = $('active-games');
  const activeList    = $('active-games-list');
  const newGameTitle  = $('new-game-title');


  // ======= AU CHARGEMENT : on efface la session (on est à la home) =======
  // ATTENTION : on ne touche PAS à l'historique, juste à la session courante.
  // Comme ça, cliquer sur une partie dans la liste recharge la session de cette partie.


  // ======= CHARGER LES PARTIES EN COURS =======
  async function loadActiveGames() {
    try {
      const games = await Wooo.history.activeGames();
      if (games.length === 0) {
        activeBlock.hidden = true;
        newGameTitle.textContent = 'Nouvelle partie';
        return;
      }

      activeBlock.hidden = false;
      newGameTitle.textContent = 'Ou commence une nouvelle partie';
      renderActiveGames(games);
    } catch (err) {
      console.warn('[Wooo] Erreur chargement parties en cours :', err);
    }
  }

  function renderActiveGames(games) {
    activeList.innerHTML = games.map(game => {
      // On affiche les avatars + pseudos des joueurs sous forme de tags
      const tags = game.joueurs.slice(0, 5).map((p, i) => {
        const color = pastel(i);
        const avatar = p.avatar || 1;
        return `
          <span class="player-tag" style="background: ${color}">
            <span class="player-tag__avatar">
              <img src="assets/avatar${avatar}.png" alt="" />
            </span>
            ${escapeHtml(p.pseudo)}
          </span>
        `;
      }).join('');

      const more = (game.joueurs.length > 5)
        ? `<span class="player-tag player-tag--no-avatar" style="background: var(--color-bg)">+${game.joueurs.length - 5}</span>`
        : '';

      return `
        <li class="active-game" data-partie-id="${escapeHtml(game.partie_id)}">
          <div class="active-game__players">${tags}${more}</div>
          <button type="button" class="active-game__cta" data-action="play">Jouer</button>
          <button type="button" class="active-game__delete" data-action="delete" aria-label="Supprimer cette partie">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </li>
      `;
    }).join('');
  }

  /** Couleur pastel cyclique */
  function pastel(i) {
    const colors = (Wooo.config && Wooo.config.PLAYER_COLORS) || [
      '#FFCCCC', '#FFCF97', '#FFE895', '#AFEBBF', '#AFDEFF',
      '#BEF9EB', '#C8CAFF', '#EDCFFF', '#FFCEFA',
    ];
    return colors[i % colors.length];
  }


  // ======= CLIC SUR UNE PARTIE EN COURS =======
  activeList.addEventListener('click', async (e) => {
    const card = e.target.closest('.active-game');
    if (!card) return;

    const action = e.target.closest('[data-action]')?.dataset.action;
    const partieId = card.dataset.partieId;

    // Clic sur la poubelle → confirmation de suppression
    if (action === 'delete') {
      e.stopPropagation();
      askDelete(partieId);
      return;
    }

    // Sinon : on joue
    const game = (await Wooo.history.activeGames()).find(g => g.partie_id === partieId);
    if (!game) {
      Wooo.history.remove(partieId);
      loadActiveGames();
      return;
    }

    // Restaure la session pour cette partie
    Wooo.session.save({
      partie_id:  game.partie_id,
      pin_code:   game.pin_code,
      themes:     game.themes,
      joueur_id:  game.joueur_id,
      pseudo:     game.pseudo,
      avatar:     game.avatar,
      is_creator: game.is_creator,
    });

    // Redirige vers le bon écran selon le statut
    if (game.status === 'votes') {
      window.location.href = 'guess.html?theme=0';
    } else {
      window.location.href = game.is_creator ? 'lobby.html' : 'lobby-invite.html';
    }
  });


  // ======= SUPPRESSION D'UNE PARTIE =======
  let pendingDeleteId = null;

  function askDelete(partieId) {
    pendingDeleteId = partieId;
    const modal = document.getElementById('delete-modal');
    if (modal) modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    const modal = document.getElementById('delete-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (e) => {
    // Fermeture
    if (e.target.matches('[data-delete-close]') || e.target.closest('[data-delete-close]')) {
      closeDeleteModal();
      return;
    }
    // Confirmation
    if (e.target.matches('#btn-delete-confirm')) {
      if (pendingDeleteId) {
        Wooo.history.remove(pendingDeleteId);
        loadActiveGames();
      }
      closeDeleteModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDeleteModal();
  });


  // ======= BOUTONS PRINCIPAUX =======
  btnCreate.addEventListener('click', () => {
    Wooo.session.clear();
    window.location.href = 'create.html';
  });

  btnJoin.addEventListener('click', () => {
    Wooo.session.clear();
    window.location.href = 'join.html';
  });


  // ======= MODALE "COMMENT JOUER ?" =======
  btnHow.addEventListener('click', () => {
    howModal.hidden = false;
    document.body.style.overflow = 'hidden';
  });

  howModal.addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined || e.target.closest('[data-close]')) {
      howModal.hidden = true;
      document.body.style.overflow = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !howModal.hidden) {
      howModal.hidden = true;
      document.body.style.overflow = '';
    }
  });


  // ======= UTILITAIRES =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  loadActiveGames();

})();
