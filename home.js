/* =========================================================
   WOOO — Homepage unifiée
   ---------------------------------------------------------
   - Boutons "Je crée une partie" / "Je rejoins une partie"
   - Liste des parties en cours, regroupées en 3 sections :
       1) Choix      — je suis encore en train de choisir mes items
       2) Déduction  — la partie est lancée, je dois deviner
       3) Classement — partie terminée
   - Chaque carte montre les joueurs et leur état (à jour / en attente)
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo home.js] version 7 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnCreate     = $('btn-create');
  const btnJoin       = $('btn-join');
  const btnHow        = $('btn-how');
  const howModal      = $('how-modal');
  const activeBlock   = $('active-games');

  const sectionChoix      = $('section-choix');
  const sectionDeduction  = $('section-deduction');
  const sectionClassement = $('section-classement');
  const listChoix         = $('list-choix');
  const listDeduction     = $('list-deduction');
  const listClassement    = $('list-classement');


  // ======= BOUTONS PRINCIPAUX =======
  btnCreate.addEventListener('click', () => {
    Wooo.session.clear();
    window.location.href = 'create.html';
  });

  btnJoin.addEventListener('click', () => {
    Wooo.session.clear();
    window.location.href = 'join.html';
  });


  // ======= CHARGEMENT DES PARTIES EN COURS =======
  async function loadActiveGames() {
    try {
      const games = await Wooo.history.activeGames();
      if (games.length === 0) {
        activeBlock.hidden = true;
        return;
      }

      // Pour chaque partie, on récupère les détails (joueurs + nb de picks par joueur)
      // afin de savoir qui est à jour. activeGames inclut déjà status + joueurs.
      // On va groupe en 3 buckets selon statut + état du joueur courant.
      const buckets = { choix: [], deduction: [], classement: [] };

      for (const game of games) {
        const myJoueurId = game.joueur_id;
        const totalThemes = (game.themes || []).length;

        // On enrichit avec le nombre de picks par joueur (déjà dans game.joueurs si activeGames le fait)
        const picksByJoueur = game.picksByJoueur || {};

        const myPicks = picksByJoueur[myJoueurId] || 0;
        const iAmDone = myPicks >= totalThemes;

        // Classement : partie terminée
        if (game.status === 'terminee') {
          buckets.classement.push(game);
          continue;
        }
        // Déduction : partie en cours (statut votes)
        if (game.status === 'votes') {
          buckets.deduction.push(game);
          continue;
        }
        // Sinon, partie en attente : on est dans la phase Choix
        // (que le joueur ait fini ou non, on reste en "Choix" jusqu'à ce que le créateur lance)
        buckets.choix.push(game);
      }

      // Affichage
      const hasAny = buckets.choix.length || buckets.deduction.length || buckets.classement.length;
      if (!hasAny) {
        activeBlock.hidden = true;
        return;
      }
      activeBlock.hidden = false;

      renderSection(sectionChoix, listChoix, buckets.choix);
      renderSection(sectionDeduction, listDeduction, buckets.deduction);
      renderSection(sectionClassement, listClassement, buckets.classement);
    } catch (err) {
      console.warn('[Wooo] Erreur chargement parties en cours :', err);
    }
  }


  function renderSection(sectionEl, listEl, games) {
    if (games.length === 0) {
      sectionEl.hidden = true;
      return;
    }
    sectionEl.hidden = false;
    listEl.innerHTML = games.map(renderGameCard).join('');
  }


  function renderGameCard(game) {
    const productLabel = getProductLabel(game.produit);
    const productClass = getProductClass(game.produit);
    const totalThemes = (game.themes || []).length;
    const picksByJoueur = game.picksByJoueur || {};
    const status = game.status;

    // Détermine l'état de chaque joueur :
    //   - status='attente' → joueurs qui ont fini leurs choix (picks === totalThemes) sont "à jour"
    //   - status='votes'   → joueurs qui ont voté pour tous les thèmes sont "à jour"
    //                       (on regarde les scores, donc on simplifie en disant qu'on a pas l'info ici)
    //   - status='terminee' → tout le monde est à jour
    const playersList = game.joueurs || [];

    let waitingList = [];
    let readyList = [];

    if (status === 'terminee') {
      readyList = playersList;
    } else if (status === 'votes') {
      // On n'a pas l'info précise du nb de votes, on liste les joueurs sans distinction
      readyList = playersList;
    } else {
      // attente : on regarde qui a fini ses choix
      playersList.forEach(p => {
        const myPicks = picksByJoueur[p.id] || 0;
        if (myPicks >= totalThemes) readyList.push(p);
        else waitingList.push(p);
      });
    }

    const tagsHtml = playersList.slice(0, 5).map((p, i) => {
      const color = pastel(i);
      const av = p.avatar || 1;
      const myPicks = picksByJoueur[p.id] || 0;
      const isReady = (status === 'terminee') || (status === 'votes') || (myPicks >= totalThemes);
      return `
        <span class="player-tag ${isReady ? '' : 'player-tag--waiting'}" style="background: ${color}" title="${escapeHtml(p.pseudo)}${isReady ? ' (à jour)' : ' (en attente)'}">
          <span class="player-tag__avatar">
            <img src="assets/avatar${av}.png" alt="" />
          </span>
          ${escapeHtml(p.pseudo)}
        </span>
      `;
    }).join('');

    const more = (playersList.length > 5)
      ? `<span class="player-tag player-tag--no-avatar" style="background: var(--color-bg)">+${playersList.length - 5}</span>`
      : '';

    // Statut texte
    let statusText = '';
    if (status === 'terminee') {
      statusText = 'Terminée';
    } else if (status === 'votes') {
      statusText = 'En cours de déduction';
    } else if (waitingList.length === 0) {
      statusText = 'Tout le monde est prêt';
    } else {
      statusText = `En attente de ${waitingList.length} joueur${waitingList.length > 1 ? 's' : ''}`;
    }

    return `
      <li class="active-game ${productClass}" data-partie-id="${escapeHtml(game.partie_id)}">
        <div class="active-game__head">
          <span class="active-game__product">${productLabel}</span>
          <span class="active-game__status">${statusText}</span>
        </div>
        <div class="active-game__players">${tagsHtml}${more}</div>
        <div class="active-game__actions">
          <button type="button" class="active-game__cta" data-action="play">${ctaLabel(status)}</button>
          <button type="button" class="active-game__delete" data-action="delete" aria-label="Supprimer cette partie">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </li>
    `;
  }


  function ctaLabel(status) {
    if (status === 'terminee') return 'Voir le classement';
    if (status === 'votes') return 'Deviner';
    return 'Reprendre';
  }


  function getProductLabel(p) {
    switch (p) {
      case 'musique': return '🎵 Musique';
      case 'cinema':  return '🎬 Cinéma';
      case 'serie':   return '📺 Série';
      case 'cine':    return '🎬 Cinéma'; // rétrocompat
      default:        return '🎵 Musique';
    }
  }
  function getProductClass(p) {
    switch (p) {
      case 'musique': return 'active-game--musique';
      case 'cinema':  return 'active-game--cinema';
      case 'serie':   return 'active-game--serie';
      case 'cine':    return 'active-game--cinema';
      default:        return 'active-game--musique';
    }
  }


  function pastel(i) {
    const colors = (Wooo.config && Wooo.config.PLAYER_COLORS) || [
      '#FFCCCC', '#FFCF97', '#FFE895', '#AFEBBF', '#AFDEFF',
      '#BEF9EB', '#C8CAFF', '#EDCFFF', '#FFCEFA',
    ];
    return colors[i % colors.length];
  }


  // ======= CLIC SUR UNE PARTIE EN COURS =======
  activeBlock.addEventListener('click', async (e) => {
    const card = e.target.closest('.active-game');
    if (!card) return;

    const action = e.target.closest('[data-action]')?.dataset.action;
    const partieId = card.dataset.partieId;

    if (action === 'delete') {
      e.stopPropagation();
      askDelete(partieId);
      return;
    }

    const game = (await Wooo.history.activeGames()).find(g => g.partie_id === partieId);
    if (!game) {
      Wooo.history.remove(partieId);
      loadActiveGames();
      return;
    }

    // Restaure la session
    const produit = game.produit || 'musique';
    Wooo.session.save({
      partie_id:  game.partie_id,
      pin_code:   game.pin_code,
      themes:     game.themes,
      joueur_id:  game.joueur_id,
      pseudo:     game.pseudo,
      avatar:     game.avatar,
      is_creator: game.is_creator,
      produit:    produit,
    });

    // Redirige selon le statut + le produit
    if (game.status === 'terminee') {
      window.location.href = 'classement.html';
    } else if (game.status === 'votes') {
      const guessUrl = (produit === 'musique') ? 'guess.html' : 'guess-cine.html';
      window.location.href = guessUrl + '?theme=0';
    } else {
      window.location.href = game.is_creator ? 'lobby.html' : 'lobby-invite.html';
    }
  });


  // ======= SUPPRESSION =======
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
    if (e.target.matches('[data-delete-close]') || e.target.closest('[data-delete-close]')) {
      closeDeleteModal();
      return;
    }
    if (e.target.matches('#btn-delete-confirm')) {
      if (pendingDeleteId) {
        Wooo.history.remove(pendingDeleteId);
        loadActiveGames();
      }
      closeDeleteModal();
    }
  });


  // ======= MODALE COMMENT JOUER =======
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
    if (e.key === 'Escape') {
      if (!howModal.hidden) {
        howModal.hidden = true;
        document.body.style.overflow = '';
      }
      closeDeleteModal();
    }
  });


  // ======= UTILITAIRE =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  loadActiveGames();

})();
