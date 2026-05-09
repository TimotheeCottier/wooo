/* =========================================================
   WOOO — Lobby INVITÉ
   ---------------------------------------------------------
   - Liste joueurs + thèmes
   - Bouton "Voter !" désactivé tant que partie pas lancée
   - Polling actif (1.5s) pour détecter que le créateur a lancé
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo lobby-invite.js] version 6 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const playersList     = $('lobby-players');
  const themesList      = $('lobby-themes');
  const messageEl       = $('lobby-message');
  const btnVoter        = $('btn-voter');


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  // Si le créateur arrive ici par erreur, on le redirige vers son lobby à lui
  if (session.is_creator) {
    window.location.replace('lobby.html');
    return;
  }

  const totalThemes = (session.themes || []).length;

  // PIN
  const pinCodeEl = $('lobby-pin-code');
  if (pinCodeEl) pinCodeEl.textContent = session.pin_code || '------';

  // Adaptation produit
  const isCine = session.produit === 'cine';
  document.documentElement.setAttribute('data-product', isCine ? 'cine' : 'musique');
  const themesIntro = $('themes-intro');
  if (themesIntro) {
    themesIntro.textContent = isCine
      ? `Pour chaque thème, tu vas voir les films/séries choisis par tes potes et tu devras retrouver qui a choisi quoi !`
      : `Pour chaque thème, tu vas entendre les chansons choisies par tes potes et tu devras retrouver qui a choisi quoi !`;
  }
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
      // Si la partie est déjà lancée
      if (partie.status === 'votes') {
        activateVoterButton();
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
    const myCount = pickCounts[session.joueur_id] || 0;
    const myReady = myCount === totalThemes;

    if (!myReady) {
      messageEl.textContent = `Tu n'as pas encore terminé tes choix (${myCount}/${totalThemes}). Reprends-les pour participer.`;
      messageEl.style.color = 'var(--color-error)';
      return;
    }

    const creator = players.find(p => p.is_creator);
    const creatorName = creator ? creator.pseudo : 'le créateur';
    messageEl.textContent = `Attends que ${creatorName} lance la partie.`;
    messageEl.style.color = 'var(--color-text-soft)';
  }


  function activateVoterButton() {
    if (!btnVoter || !btnVoter.disabled) return;
    btnVoter.disabled = false;
    messageEl.textContent = 'La partie est lancée ! Clique sur "Voter !" pour commencer.';
    messageEl.style.color = 'var(--color-success)';
  }


  // ======= BOUTON VOTER =======
  btnVoter.addEventListener('click', () => {
    window.location.href = guessUrl + '?theme=0';
  });


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

      if (partie.status === 'votes') {
        activateVoterButton();
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
      console.warn('[Wooo] Polling lobby-invite error:', e);
    }
  }

  // Polling rapide (1.5s) pour détecter que le créateur a lancé
  pollTimer = setInterval(checkStatus, 1500);

  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkStatus();
  });


  // ======= NAVIGATION =======
  btnBack.addEventListener('click', () => {
    window.location.href = isCine ? 'index-cine.html' : 'index-musique.html';
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  loadInitial();

})();
