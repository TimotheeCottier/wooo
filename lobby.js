/* =========================================================
   WOOO — Lobby
   ---------------------------------------------------------
   - Liste des joueurs en tags pastel
   - Liste des thèmes (avec ✓ quand tout le monde a choisi)
   - Créateur : bouton "C'est parti !" actif quand tout est prêt
   - Invité : bouton "Voter !" désactivé tant que pas lancé
   - Polling Supabase + temps réel
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const playersList     = $('lobby-players');
  const themesList      = $('lobby-themes');
  const messageEl       = $('lobby-message');
  const btnShare        = $('btn-share');
  const btnLaunch       = $('btn-launch');
  const btnVoter        = $('btn-voter');
  const toast           = $('toast');
  const toastText       = $('toast-text');

  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 10;


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  const totalThemes = (session.themes || []).length;

  // Affichage des boutons selon le rôle
  if (session.is_creator) {
    btnLaunch.hidden = false;
    btnShare.hidden = false;
  } else {
    btnVoter.hidden = false;
  }


  // ======= ÉTAT =======
  let players = [];
  let pickCounts = {};
  let lastSig = '';


  // ======= INIT =======
  async function loadInitial() {
    try {
      const [partie, joueurs, counts] = await Promise.all([
        Wooo.api.getPartieById(session.partie_id),
        Wooo.api.getJoueurs(session.partie_id),
        Wooo.api.getPickCountsByJoueur(session.partie_id),
      ]);
      if (!partie) {
        window.location.replace('index.html');
        return;
      }
      // Si la partie est déjà lancée, redirige
      if (partie.status === 'votes') {
        if (session.is_creator) {
          window.location.href = 'guess.html?theme=0';
        } else {
          activateVoterButton();
        }
        return;
      }
      if (partie.status === 'terminee') {
        window.location.href = 'classement.html';
        return;
      }

      players = joueurs;
      pickCounts = counts;
      render();
    } catch (err) {
      console.error(err);
    }
  }


  // ======= RENDU =======
  function render() {
    renderPlayers();
    renderThemes();
    renderMessage();
  }

  function renderSilent() {
    playersList.classList.add('no-anim');
    render();
  }

  function renderPlayers() {
    const colors = (Wooo.config && Wooo.config.PLAYER_COLORS) || [];
    playersList.innerHTML = players.map((p, i) => {
      const color = colors[i % colors.length];
      const avatar = p.avatar || 1;
      const isMe = (p.id === session.joueur_id);
      return `
        <li class="player-tag ${isMe ? 'player-tag--me' : ''}" style="background: ${color}">
          <span class="player-tag__avatar">
            <img src="assets/avatar${avatar}.png" alt="" />
          </span>
          ${escapeHtml(p.pseudo)}
        </li>
      `;
    }).join('');
  }

  function renderThemes() {
    themesList.innerHTML = (session.themes || []).map((theme, i) => {
      // Le thème est "ready" si tous les joueurs ont choisi pour ce thème.
      // Pour ça il faudrait un détail par thème ; on fait simple en regardant
      // si tous ont ≥ (i+1) choix.
      const allReady = players.length > 0 && players.every(p => (pickCounts[p.id] || 0) > i);
      return `
        <li class="lobby-theme ${allReady ? 'lobby-theme--ready' : ''}">
          ${escapeHtml(theme)}
        </li>
      `;
    }).join('');
  }

  function renderMessage() {
    const nbReady = players.filter(p => (pickCounts[p.id] || 0) === totalThemes).length;
    const everyoneReady = (nbReady === players.length) && (players.length > 0);
    const enoughPlayers = players.length >= MIN_PLAYERS;
    const allReady = enoughPlayers && everyoneReady;

    const myCount = pickCounts[session.joueur_id] || 0;
    const myReady = myCount === totalThemes;

    if (btnLaunch) btnLaunch.disabled = !allReady;

    if (!myReady) {
      messageEl.textContent = `Tu n'as pas encore terminé tes choix (${myCount}/${totalThemes}). Reprends-les pour passer à la suite.`;
      messageEl.style.color = 'var(--color-error)';
      return;
    }

    if (!enoughPlayers) {
      const needed = MIN_PLAYERS - players.length;
      messageEl.textContent = `Il faut au moins ${MIN_PLAYERS} joueurs pour lancer. Encore ${needed} à inviter !`;
      messageEl.style.color = 'var(--color-error)';
      return;
    }

    if (session.is_creator) {
      if (allReady) {
        messageEl.textContent = "Tout le monde est prêt ! C'est à toi de lancer la partie.";
        messageEl.style.color = 'var(--color-success)';
      } else {
        const nbWaiting = players.length - nbReady;
        messageEl.textContent = `En attente de ${nbWaiting} joueur${nbWaiting > 1 ? 's' : ''} (${nbReady}/${players.length} prêts).`;
        messageEl.style.color = 'var(--color-error)';
      }
      return;
    }

    // Invité
    const creator = players.find(p => p.is_creator);
    const creatorName = creator ? creator.pseudo : 'le créateur';
    if (allReady) {
      messageEl.textContent = `Tout le monde est prêt ! Attends que ${creatorName} lance la partie.`;
      messageEl.style.color = 'var(--color-success)';
    } else {
      const nbWaiting = players.length - nbReady;
      messageEl.textContent = `En attente de ${nbWaiting} joueur${nbWaiting > 1 ? 's' : ''} (${nbReady}/${players.length} prêts).`;
      messageEl.style.color = 'var(--color-error)';
    }
  }


  function activateVoterButton() {
    if (!btnVoter) return;
    if (!btnVoter.disabled) return;
    btnVoter.disabled = false;
    messageEl.textContent = 'La partie est lancée ! Clique sur "Voter !" pour commencer.';
    messageEl.style.color = 'var(--color-success)';
  }


  // ======= BOUTON LANCER (créateur) =======
  if (btnLaunch) {
    btnLaunch.addEventListener('click', async () => {
      const nbReady = players.filter(p => (pickCounts[p.id] || 0) === totalThemes).length;
      if (players.length < MIN_PLAYERS || nbReady !== players.length) {
        alert(`Impossible de lancer : ${nbReady}/${players.length} joueurs prêts.`);
        return;
      }
      btnLaunch.disabled = true;
      btnLaunch.textContent = 'Démarrage…';
      try {
        const updated = await Wooo.api.setPartieStatus(session.partie_id, 'votes');
        if (!updated || updated.status !== 'votes') {
          throw new Error('Mise à jour silencieusement bloquée. Vérifie la policy UPDATE sur Supabase.');
        }
        window.location.href = 'guess.html?theme=0';
      } catch (err) {
        console.error(err);
        btnLaunch.disabled = false;
        btnLaunch.textContent = "C'est parti !";
        alert('Oups : ' + err.message);
      }
    });
  }


  // ======= BOUTON VOTER (invité) =======
  if (btnVoter) {
    btnVoter.addEventListener('click', () => {
      window.location.href = 'guess.html?theme=0';
    });
  }


  // ======= BOUTON INVITER (créateur) =======
  if (btnShare) {
    btnShare.addEventListener('click', async () => {
      const url = window.location.origin + window.location.pathname.replace(/[^/]+$/, '')
                + 'join.html?pin=' + encodeURIComponent(session.pin_code);
      const text = `Rejoins ma partie Wooo ! Code : ${session.pin_code}`;
      if (navigator.share) {
        try { await navigator.share({ text, url, title: 'Wooo' }); return; } catch (e) {}
      }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Lien copié !');
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('Lien copié !');
      }
    });
  }


  // ======= POLLING =======
  let pollTimer = null;
  async function checkStatus() {
    try {
      const [partie, joueurs, counts] = await Promise.all([
        Wooo.api.getPartieById(session.partie_id),
        Wooo.api.getJoueurs(session.partie_id),
        Wooo.api.getPickCountsByJoueur(session.partie_id),
      ]);
      if (!partie) return;
      console.log('[Wooo] Polling — statut:', partie.status, '— joueurs:', joueurs.length);

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

      const sig = JSON.stringify([
        joueurs.map(j => j.id + ':' + j.pseudo + ':' + (j.avatar || 1)),
        joueurs.map(j => counts[j.id] || 0),
      ]);
      if (sig !== lastSig) {
        lastSig = sig;
        players = joueurs;
        pickCounts = counts;
        renderSilent();
      }
    } catch (e) {
      console.warn('[Wooo] Polling lobby error:', e);
    }
  }

  const POLL_INTERVAL = session.is_creator ? 30000 : 1500;
  pollTimer = setInterval(checkStatus, POLL_INTERVAL);

  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkStatus();
  });


  // ======= NAVIGATION =======
  btnBack.addEventListener('click', () => {
    window.location.href = 'index.html';
  });


  // ======= UTILITAIRE =======
  let toastTimer;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toastText.textContent = msg;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  loadInitial();

})();
