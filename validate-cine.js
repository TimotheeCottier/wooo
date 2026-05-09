/* =========================================================
   WOOO Ciné — Validation finale des choix
   ---------------------------------------------------------
   Identique à validate.js mais :
   - Pas de play/pause
   - Bouton "Modifier" → search-cine.html
   - Validation → lobby.html ou lobby-invite.html
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo validate-cine.js] version 6 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack       = $('btn-back');
  const myAvatar      = $('my-avatar');
  const themesList    = $('validate-themes');
  const loadingEl     = $('validate-loading');
  const btnValidate   = $('btn-validate');


  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  const av = session.avatar || 1;
  myAvatar.innerHTML = `<img src="assets/avatar${av}.png" alt="" />`;


  async function load() {
    try {
      const allPicks = await Wooo.api.getPicksForPartie(session.partie_id);
      const myPicks = allPicks.filter(p => p.joueur_id === session.joueur_id);
      myPicks.sort((a, b) => a.theme_index - b.theme_index);
      renderList(myPicks);
    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'Erreur de chargement.';
    }
  }


  function renderList(picks) {
    loadingEl.hidden = true;

    themesList.innerHTML = (session.themes || []).map((themeName, idx) => {
      const pick = picks.find(p => p.theme_index === idx);
      const songHtml = pick ? `
        <div class="validate-song" data-track-id="${pick.id}">
          <div class="validate-song__cover">
            <img src="${escapeHtml(pick.cover || '')}" alt="" onerror="this.style.display='none'" />
          </div>
          <div class="validate-song__info">
            <p class="validate-song__title">${escapeHtml(pick.title)}</p>
            <p class="validate-song__artist">${escapeHtml(pick.artist || '')}</p>
          </div>
          <button type="button" class="validate-song__edit" data-action="edit" data-theme="${idx}">Modifier</button>
        </div>
      ` : `
        <div class="validate-song">
          <div class="validate-song__info">
            <p class="validate-song__title" style="color: var(--color-error);">Pas de film/série choisi</p>
          </div>
          <button type="button" class="validate-song__edit" data-action="edit" data-theme="${idx}">Choisir</button>
        </div>
      `;
      return `
        <li class="validate-theme">
          <div class="validate-theme__head">
            <span class="validate-theme__num">${idx + 1}</span>
            <span class="validate-theme__name">${escapeHtml(themeName)}</span>
          </div>
          ${songHtml}
        </li>
      `;
    }).join('');

    const allChosen = (session.themes || []).every((_, idx) => picks.find(p => p.theme_index === idx));
    btnValidate.disabled = !allChosen;
  }


  themesList.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action !== 'edit') return;
    const themeIdx = e.target.closest('[data-action]').dataset.theme;
    sessionStorage.setItem('wooo:edit-return', 'validate');
    window.location.href = 'search-cine.html?theme=' + themeIdx;
  });


  btnValidate.addEventListener('click', () => {
    window.location.href = session.is_creator ? 'lobby.html' : 'lobby-invite.html';
  });


  btnBack.addEventListener('click', () => {
    const lastIdx = (session.themes || []).length - 1;
    window.location.href = 'search-cine.html?theme=' + Math.max(0, lastIdx);
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  load();

})();
