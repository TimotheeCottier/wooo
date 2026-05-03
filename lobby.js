/* =========================================================
   WOOO MUSIQUE — Page lobby (salle d'attente)
   ---------------------------------------------------------
   - Lien à partager + bouton "Copier"
   - Min 3 joueurs pour démarrer
   - Bouton "Lancer les votes" : visible UNIQUEMENT chez le créateur
     - Désactivé tant que < 3 joueurs
     - Désactivé tant que tout le monde n'a pas fini ses choix
   - Avatars affichés à gauche du pseudo
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const linkEl        = $('lobby-link');
  const btnCopy       = $('btn-copy');
  const copyFeedback  = $('copy-feedback');
  const messageEl     = $('lobby-message');
  const playersList   = $('players-list');
  const btnLaunch     = $('btn-launch');
  const statusSteps   = document.querySelectorAll('.status-step');


  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 10;


  // ======= LECTURE DE LA SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  // Le footer est toujours visible, mais on choisit quel sous-bloc afficher
  // selon le rôle (créateur ou invité)
  const footerCreator = document.getElementById('footer-creator');
  const footerGuest   = document.getElementById('footer-guest');
  const btnVoter      = document.getElementById('btn-voter');

  if (session.is_creator) {
    footerCreator.hidden = false;
  } else {
    footerGuest.hidden = false;
  }


  // ======= LIEN À PARTAGER =======
  const shareUrl = buildShareUrl(session.pin_code);
  linkEl.textContent = shareUrl;

  function buildShareUrl(pin) {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return base + 'join.html?pin=' + pin;
  }

  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copyFeedback.hidden = false;
      setTimeout(() => { copyFeedback.hidden = true; }, 2500);
    } catch (err) {
      prompt('Copie ce lien :', shareUrl);
    }
  });


  // ======= ÉTAT =======
  let players = [];
  let pickCounts = {};
  let partieStatus = 'en_cours';
  const totalThemes = session.themes.length;


  // ======= CHARGEMENT INITIAL =======
  async function loadAll() {
    try {
      const [partie, joueurs, counts] = await Promise.all([
        Wooo.api.getPartieById(session.partie_id),
        Wooo.api.getJoueurs(session.partie_id),
        Wooo.api.getPickCountsByJoueur(session.partie_id),
      ]);

      if (!partie) {
        messageEl.textContent = 'Cette partie n\'existe plus.';
        return;
      }

      partieStatus = partie.status;
      players = joueurs;
      pickCounts = counts;

      if (partieStatus === 'votes') {
        // Créateur : redirige direct
        // Invité : affiche le footer avec bouton "Voter !"
        if (session.is_creator) {
          window.location.href = 'guess.html?theme=0';
        } else {
          render();             // affiche les joueurs etc. avant le bouton
          activateVoterButton();
        }
        return;
      }
      if (partieStatus === 'terminee') {
        window.location.href = 'classement.html';
        return;
      }

      render();
    } catch (err) {
      console.error('Erreur chargement lobby :', err);
      messageEl.textContent = 'Erreur de connexion. Réessaie en rechargeant la page.';
    }
  }


  // ======= RENDU =======
  function render() {
    renderStatus();
    renderPlayers();
    renderMessage();
  }

  /**
   * Rendu sans animation (pour les mises à jour silencieuses du polling).
   * Évite que les lignes "sautent" à chaque refresh.
   */
  function renderSilent() {
    playersList.classList.add('no-anim');
    renderStatus();
    renderPlayers();
    renderMessage();
    // On garde la classe en place — les futurs renders seront aussi silencieux
    // (pas grave : l'anim n'a vraiment de sens qu'au tout premier chargement)
  }

  function renderStatus() {
    const map = { created: 'done', joined: 'active', voting: 'pending', done: 'pending' };
    if (partieStatus === 'votes')    map.joined = 'done', map.voting = 'active';
    if (partieStatus === 'terminee') map.joined = 'done', map.voting = 'done', map.done = 'active';

    statusSteps.forEach(step => {
      step.classList.remove('status-step--active', 'status-step--done');
      const state = map[step.dataset.step];
      if (state === 'active') step.classList.add('status-step--active');
      if (state === 'done')   step.classList.add('status-step--done');
    });
  }

  function renderPlayers() {
    if (players.length === 0) {
      playersList.innerHTML = '<li class="players-empty">Aucun joueur pour l\'instant…</li>';
      return;
    }

    playersList.innerHTML = players.map(p => {
      const nbChoix = pickCounts[p.id] || 0;
      const isReady = nbChoix === totalThemes;
      const isMe = (p.id === session.joueur_id);
      const avatar = p.avatar || 1;

      let statusLabel = 'en attente';
      let statusClass = '';
      if (isReady) {
        statusLabel = 'prêt';
        statusClass = 'player-row__status--ready';
      }

      return `
        <li class="player-row">
          <div class="player-row__avatar">
            <img src="assets/avatar${avatar}.png" alt="" />
          </div>
          <span class="player-row__name">
            ${escapeHtml(p.pseudo)}
            ${isMe ? '<span class="player-row__me">toi</span>' : ''}
          </span>
          <span class="player-row__status ${statusClass}">${statusLabel}</span>
        </li>
      `;
    }).join('');
  }

  function renderMessage() {
    // STRICT : tous les joueurs inscrits doivent avoir fait TOUS leurs choix
    const nbReady = players.filter(p => (pickCounts[p.id] || 0) === totalThemes).length;
    const everyoneReady = (nbReady === players.length) && (players.length > 0);
    const enoughPlayers = players.length >= MIN_PLAYERS;
    const allReady = enoughPlayers && everyoneReady;

    const myCount = pickCounts[session.joueur_id] || 0;
    const myReady = myCount === totalThemes;

    console.log('[Wooo] État lobby — joueurs:', players.length, 'prêts:', nbReady,
                '/', players.length, '— allReady:', allReady);

    // Le bouton lancer (s'il existe = créateur) est désactivé si pas tout le monde prêt
    if (btnLaunch) {
      btnLaunch.disabled = !allReady;
    }

    // Cas 1 : moi-même je n'ai pas fini
    if (!myReady) {
      messageEl.textContent = `Tu n\'as pas encore terminé tes choix (${myCount}/${totalThemes}). ` +
                              `Reprends-les pour passer à la suite.`;
      messageEl.style.color = 'var(--color-red)';
      return;
    }

    // Pas assez de joueurs ?
    if (!enoughPlayers) {
      const needed = MIN_PLAYERS - players.length;
      messageEl.textContent =
        `Il faut au moins ${MIN_PLAYERS} joueurs pour lancer la partie. ` +
        `Encore ${needed} à inviter !`;
      messageEl.style.color = 'var(--color-red)';
      return;
    }

    // CRÉATEUR
    if (session.is_creator) {
      if (allReady) {
        messageEl.textContent = 'Tout le monde est prêt ! C\'est à toi de lancer la partie.';
        messageEl.style.color = '#2EA047';
      } else {
        const nbWaiting = players.length - nbReady;
        messageEl.textContent =
          `En attente de ${nbWaiting} joueur${nbWaiting > 1 ? 's' : ''} ` +
          `(${nbReady}/${players.length} prêts).`;
        messageEl.style.color = 'var(--color-red)';
      }
      return;
    }

    // INVITÉ
    const creator = players.find(p => p.is_creator);
    const creatorName = creator ? creator.pseudo : 'le créateur';
    if (allReady) {
      messageEl.textContent = `Tout le monde est prêt ! Attends que ${creatorName} lance la partie !`;
      messageEl.style.color = '#2EA047';
    } else {
      const nbWaiting = players.length - nbReady;
      messageEl.textContent =
        `En attente de ${nbWaiting} joueur${nbWaiting > 1 ? 's' : ''} ` +
        `(${nbReady}/${players.length} prêts).`;
      messageEl.style.color = 'var(--color-red)';
    }
  }


  // ======= LANCEMENT =======
  // Bouton seulement actif chez le créateur (le footer est masqué chez les autres)
  if (btnLaunch) {
    btnLaunch.addEventListener('click', async () => {
      // Double sécurité : on revérifie en direct que tout le monde est prêt
      // (au cas où le bouton serait actif par erreur)
      const nbReady = players.filter(p => (pickCounts[p.id] || 0) === totalThemes).length;
      if (players.length < MIN_PLAYERS || nbReady !== players.length) {
        alert(`Impossible de lancer : ${nbReady}/${players.length} joueurs ont terminé leurs choix.`);
        return;
      }

      btnLaunch.disabled = true;
      btnLaunch.textContent = 'Démarrage…';
      try {
        const updated = await Wooo.api.setPartieStatus(session.partie_id, 'votes');
        // Vérifier que la mise à jour a bien eu lieu (au cas où RLS bloque silencieusement)
        if (!updated || updated.status !== 'votes') {
          throw new Error('Le statut de la partie n\'a pas pu être mis à jour. ' +
                          'Vérifie que la policy UPDATE est activée sur Supabase.');
        }
        window.location.href = 'guess.html?theme=0';
      } catch (err) {
        console.error('[Wooo] Erreur lancement partie :', err);
        btnLaunch.disabled = false;
        btnLaunch.textContent = 'Lancer les votes';
        alert('Oups : ' + err.message);
      }
    });
  }


  // ======= TEMPS RÉEL =======
  const client = Wooo.api.getClient();
  if (client) {
    const channel = client.channel('lobby:' + session.partie_id);

    channel.on('postgres_changes', {
      event: '*', schema: 'public', table: 'joueurs',
      filter: 'partie_id=eq.' + session.partie_id,
    }, async () => {
      players = await Wooo.api.getJoueurs(session.partie_id);
      renderSilent();
    });

    channel.on('postgres_changes', {
      event: '*', schema: 'public', table: 'choix',
      filter: 'partie_id=eq.' + session.partie_id,
    }, async () => {
      pickCounts = await Wooo.api.getPickCountsByJoueur(session.partie_id);
      renderSilent();
    });

    channel.on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'parties',
      filter: 'id=eq.' + session.partie_id,
    }, (payload) => {
      const newStatus = payload.new && payload.new.status;
      if (newStatus === 'votes') {
        // Créateur : redirige direct (déjà fait par le clic du bouton)
        // Invité : affiche le footer avec bouton "Voter !"
        if (session.is_creator) {
          window.location.href = 'guess.html?theme=0';
        } else {
          activateVoterButton();
        }
      } else if (newStatus === 'terminee') {
        window.location.href = 'classement.html';
      } else if (newStatus) {
        partieStatus = newStatus;
        render();
      }
    });

    channel.subscribe();
    window.addEventListener('beforeunload', () => client.removeChannel(channel));
  }


  // ======= POLLING DE SECOURS =======
  // Polling LENT (30 sec) pour la liste des joueurs : ça met à jour si quelqu'un
  // rejoint sans que le temps réel ne marche.
  // Polling RAPIDE (1.5 sec) UNIQUEMENT pour l'invité, pour détecter
  // rapidement quand le créateur lance les votes.
  let pollTimer = null;
  let lastStateSignature = '';

  /**
   * Renvoie une "signature" de l'état actuel pour détecter
   * si quelque chose a changé et éviter les re-renders inutiles.
   */
  function computeStateSignature(partie, joueurs, counts) {
    const parts = [partie.status];
    joueurs.forEach(j => {
      parts.push(j.id + ':' + j.pseudo + ':' + (j.avatar || 1) + ':' + (counts[j.id] || 0));
    });
    return parts.join('|');
  }

  async function checkPartieStatus() {
    try {
      const [partie, joueurs, counts] = await Promise.all([
        Wooo.api.getPartieById(session.partie_id),
        Wooo.api.getJoueurs(session.partie_id),
        Wooo.api.getPickCountsByJoueur(session.partie_id),
      ]);
      if (!partie) return;

      console.log('[Wooo] Polling — statut:', partie.status, '— joueurs:', joueurs.length);

      // Détection : le statut a-t-il changé vers 'votes' ?
      if (partie.status === 'votes') {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (session.is_creator) {
          window.location.href = 'guess.html?theme=0';
        } else {
          activateVoterButton();
        }
        return;
      }
      if (partie.status === 'terminee') {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        window.location.href = 'classement.html';
        return;
      }

      // Mise à jour silencieuse de l'état UNIQUEMENT si quelque chose a changé
      const newSig = computeStateSignature(partie, joueurs, counts);
      if (newSig !== lastStateSignature) {
        lastStateSignature = newSig;
        players = joueurs;
        pickCounts = counts;
        renderSilent();      // pas d'animation
      }
    } catch (e) {
      console.warn('[Wooo] Erreur polling lobby :', e);
    }
  }

  // Pour les invités : polling rapide (1.5s) car on attend l'activation du bouton
  // Pour le créateur : polling plus lent (30s) car juste pour la liste des joueurs
  const POLL_INTERVAL = session.is_creator ? 30000 : 1500;
  pollTimer = setInterval(checkPartieStatus, POLL_INTERVAL);

  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });

  // Et on vérifie aussi au retour de l'onglet
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkPartieStatus();
  });


  // ======= ACTIVATION DU BOUTON "VOTER !" (invités uniquement) =======
  // Le bouton est déjà visible dans le footer dès le chargement, mais désactivé.
  // Cette fonction l'active quand le créateur a lancé la partie.
  function activateVoterButton() {
    if (!btnVoter) return;
    if (!btnVoter.disabled) return;       // déjà actif
    btnVoter.disabled = false;
    messageEl.textContent = 'La partie est lancée ! Clique sur "Voter !" pour commencer à deviner.';
    messageEl.style.color = '#2EA047';
    console.log('[Wooo] Bouton "Voter !" activé.');
  }

  // Le clic sur le bouton voter
  if (btnVoter) {
    btnVoter.addEventListener('click', () => {
      window.location.href = 'guess.html?theme=0';
    });
  }


  // ======= UTILITAIRES =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  loadAll();

})();
