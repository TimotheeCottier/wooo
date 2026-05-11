/* =========================================================
   WOOO — Lobby CRÉATEUR
   ---------------------------------------------------------
   - Liste joueurs + thèmes
   - Bouton "C'est parti !" actif dès 3 joueurs
   - Au clic : passe la partie en status='votes' puis va à guess.html
   - Bouton "Je partage le lien" pour inviter
   - Polling lent (30s) car le créateur n'attend rien d'asynchrone
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo lobby.js] version 6 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const playersList     = $('lobby-players');
  const themesList      = $('lobby-themes');
  const messageEl       = $('lobby-message');
  const btnShare        = $('btn-share');
  const btnLaunch       = $('btn-launch');
  const toast           = $('toast');
  const toastText       = $('toast-text');

  const MIN_PLAYERS = 3;


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  // Si un invité arrive ici par erreur, on le redirige vers son lobby
  if (!session.is_creator) {
    window.location.replace('lobby-invite.html');
    return;
  }

  const totalThemes = (session.themes || []).length;

  // PIN
  const pinCodeEl = $('lobby-pin-code');
  if (pinCodeEl) pinCodeEl.textContent = session.pin_code || '------';

  // Adaptation produit (musique vs ciné)
  const isCine = session.produit && session.produit !== 'musique';
  document.documentElement.setAttribute('data-product', isCine ? 'cine' : 'musique');
  const themesIntro = $('themes-intro');
  if (themesIntro) {
    const produit = session.produit || 'musique';
    if (produit === 'musique') {
      themesIntro.textContent = `Pour chaque thème, tu vas entendre les chansons choisies par tes potes et tu devras retrouver qui a choisi quoi !`;
    } else if (produit === 'cinema') {
      themesIntro.textContent = `Pour chaque thème, tu vas voir les films choisis par tes potes et tu devras retrouver qui a choisi quoi !`;
    } else if (produit === 'serie') {
      themesIntro.textContent = `Pour chaque thème, tu vas voir les séries choisies par tes potes et tu devras retrouver qui a choisi quoi !`;
    } else {
      themesIntro.textContent = `Pour chaque thème, tu vas voir les films/séries choisis par tes potes et tu devras retrouver qui a choisi quoi !`;
    }
  }
  // URL de la page de jeu selon produit
  const guessUrl = isCine ? 'guess-cine.html' : 'guess.html';


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
      // Si la partie est déjà lancée, on va voter directement
      if (partie.status === 'votes') {
        window.location.href = guessUrl + '?theme=0';
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
      const allReady = players.length > 0 && players.every(p => (pickCounts[p.id] || 0) > i);
      return `
        <li class="lobby-theme ${allReady ? 'lobby-theme--ready' : ''}">
          ${escapeHtml(theme)}
        </li>
      `;
    }).join('');
  }

  function renderMessage() {
    const enoughPlayers = players.length >= MIN_PLAYERS;
    const nbReady = players.filter(p => (pickCounts[p.id] || 0) === totalThemes).length;
    const myCount = pickCounts[session.joueur_id] || 0;
    const myReady = myCount === totalThemes;

    // Activation du bouton "C'est parti" : au moins 3 joueurs
    btnLaunch.disabled = !enoughPlayers;

    if (!enoughPlayers) {
      const needed = MIN_PLAYERS - players.length;
      messageEl.textContent = `Il faut au moins ${MIN_PLAYERS} joueurs pour lancer. Encore ${needed} à inviter !`;
      messageEl.style.color = 'var(--color-error)';
      return;
    }

    if (!myReady) {
      messageEl.textContent = `Tu n'as pas encore terminé tes choix (${myCount}/${totalThemes}). Reprends-les pour participer.`;
      messageEl.style.color = 'var(--color-error)';
      return;
    }

    if (nbReady === players.length) {
      messageEl.textContent = "Tout le monde est prêt ! Tu peux lancer la partie.";
      messageEl.style.color = 'var(--color-success)';
    } else {
      const nbWaiting = players.length - nbReady;
      messageEl.textContent = `${nbReady}/${players.length} joueurs prêts. Tu peux attendre les ${nbWaiting} retardataire${nbWaiting > 1 ? 's' : ''} ou lancer dès maintenant.`;
      messageEl.style.color = 'var(--color-text-soft)';
    }
  }


  // ======= BOUTON LANCER =======
  btnLaunch.addEventListener('click', async () => {
    if (players.length < MIN_PLAYERS) {
      alert(`Il faut au moins ${MIN_PLAYERS} joueurs pour lancer.`);
      return;
    }
    btnLaunch.disabled = true;
    btnLaunch.textContent = 'Démarrage…';
    try {
      const updated = await Wooo.api.setPartieStatus(session.partie_id, 'votes');
      if (!updated || updated.status !== 'votes') {
        throw new Error('Mise à jour silencieusement bloquée. Vérifie la policy UPDATE sur Supabase.');
      }
      window.location.href = guessUrl + '?theme=0';
    } catch (err) {
      console.error(err);
      btnLaunch.disabled = false;
      btnLaunch.textContent = "C'est parti !";
      alert('Oups : ' + err.message);
    }
  });


  // ======= BOUTON PARTAGE =======
  btnShare.addEventListener('click', async () => {
    const url = window.location.origin + window.location.pathname.replace(/[^/]+$/, '')
              + 'join.html?pin=' + encodeURIComponent(session.pin_code);
    const text = `Rejoins ma partie Wooo ! Code : ${session.pin_code}`;
    await Wooo.share.shareOrCopyLink({
      url, text, title: 'Wooo',
      onCopied: () => showToast('Lien copié !'),
    });
  });


  // ======= POLLING (lent : 15s) =======
  let pollTimer = null;
  async function checkStatus() {
    try {
      const [partie, joueurs, counts] = await Promise.all([
        Wooo.api.getPartieById(session.partie_id),
        Wooo.api.getJoueurs(session.partie_id),
        Wooo.api.getPickCountsByJoueur(session.partie_id),
      ]);
      if (!partie) return;

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

  pollTimer = setInterval(checkStatus, 15000);

  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkStatus();
  });


  // ======= NAVIGATION =======
  btnBack.addEventListener('click', () => {
    window.location.href = isCine ? 'index.html' : 'index.html';
  });


  // ======= TOAST =======
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


  loadInitial();

})();
