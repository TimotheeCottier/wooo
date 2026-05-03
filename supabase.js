/* =========================================================
   WOOO MUSIQUE — Module Supabase (config + utilitaires)
   ---------------------------------------------------------
   Ce fichier centralise tout ce qui touche au backend pour
   ne pas dupliquer le code dans les autres scripts.

   IMPORTANT :
   - L'URL et la clé "anon" ci-dessous sont publiques par
     conception : elles seront visibles dans le code envoyé
     au navigateur. C'est normal et sans risque tant qu'on
     ne met JAMAIS la clé "service_role" ici.
   - Les règles RLS définies dans la base (cf. SQL fourni)
     contrôlent qui peut lire/écrire quoi.
   ========================================================= */

// On expose tout ce qu'on définit ici dans un objet global "Wooo"
// pour que les autres scripts puissent y accéder.
window.Wooo = window.Wooo || {};

(function (Wooo) {
  'use strict';

  // ======= CONFIG (à mettre à jour si on change de projet) =======
  const SUPABASE_URL  = 'https://lwiecxmmurxpaoayqbql.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3aWVjeG1tdXJ4cGFvYXlxYnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDcwNzUsImV4cCI6MjA5MzEyMzA3NX0.yLHQkDNqK_hGoH42UDxnWGPeY6jw3SDLMz1la1CMlR0';

  // Couleurs pastel attribuées aux joueurs (cycliques, du Figma)
  const PLAYER_COLORS = [
    '#FFCCCC',  // 1 — rose
    '#FFCF97',  // 2 — pêche
    '#FFE895',  // 3 — jaune
    '#AFEBBF',  // 4 — menthe
    '#AFDEFF',  // 5 — bleu ciel
    '#BEF9EB',  // 6 — cyan pâle
    '#C8CAFF',  // 7 — lavande
    '#EDCFFF',  // 8 — mauve
    '#FFCEFA',  // 9 — rose-mauve
  ];


  // ======= ENDPOINTS =======
  const REST_BASE      = SUPABASE_URL + '/rest/v1';
  const FUNCTIONS_BASE = SUPABASE_URL + '/functions/v1';

  // Headers standards à envoyer pour chaque requête REST
  function authHeaders(extra) {
    return Object.assign({
      'apikey': SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
      'Content-Type': 'application/json',
    }, extra || {});
  }


  // ======= CLIENT SUPABASE JS (temps réel + helpers) =======
  // Le client est utilisé surtout pour s'abonner aux changements de la base
  // (mise à jour automatique des écrans quand quelqu'un rejoint/vote/etc.)
  let _client = null;
  function getClient() {
    if (_client) return _client;
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.warn('[Wooo] Le SDK Supabase n\'est pas chargé.');
      return null;
    }
    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      realtime: { params: { eventsPerSecond: 5 } },
    });
    return _client;
  }


  // ======= API : PARTIES =======

  /**
   * Crée une partie en base.
   * @param {string[]} themes
   * @returns {Promise<{id, pin_code, themes}>}
   */
  async function createPartie(themes, produit) {
    const produitFinal = produit || 'musique';
    // On génère un code PIN unique (on retente si jamais collision)
    for (let attempt = 0; attempt < 5; attempt++) {
      const pin = generatePinCode();
      const resp = await fetch(REST_BASE + '/parties', {
        method: 'POST',
        headers: authHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify({
          pin_code: pin,
          themes: themes,
          produit: produitFinal,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        return data[0];
      }

      // Erreur 409 = pin déjà pris → on retente
      if (resp.status !== 409) {
        const err = await resp.text();
        throw new Error('Erreur création partie : ' + err);
      }
    }
    throw new Error('Impossible de générer un code PIN unique. Réessaie.');
  }

  /**
   * Récupère une partie par son code PIN.
   * @returns {Promise<Object|null>} la partie, ou null si non trouvée
   */
  async function getPartieByPin(pinCode) {
    const url = REST_BASE + '/parties?pin_code=eq.' + encodeURIComponent(pinCode) + '&select=*';
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Erreur recherche partie');
    const data = await resp.json();
    return data[0] || null;
  }

  /**
   * Récupère une partie par son ID.
   */
  async function getPartieById(id) {
    const url = REST_BASE + '/parties?id=eq.' + encodeURIComponent(id) + '&select=*';
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Erreur recherche partie');
    const data = await resp.json();
    return data[0] || null;
  }


  // ======= API : JOUEURS =======

  /**
   * Liste les joueurs d'une partie.
   */
  async function getJoueurs(partieId) {
    const url = REST_BASE + '/joueurs?partie_id=eq.' + encodeURIComponent(partieId) +
                '&select=*&order=joined_at.asc';
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Erreur lecture joueurs');
    return await resp.json();
  }

  /**
   * Ajoute un joueur à la partie. Le pseudo doit être unique dans la partie.
   * @param avatar Numéro d'avatar (1-9), optionnel
   * @returns {Promise<Object>} le joueur créé
   */
  async function addJoueur(partieId, pseudo, isCreator, avatar) {
    // On compte les joueurs déjà présents pour attribuer une couleur
    const existants = await getJoueurs(partieId);

    // Vérifie l'unicité du pseudo (sans tenir compte de la casse)
    const exists = existants.some(j => j.pseudo.toLowerCase() === pseudo.toLowerCase());
    if (exists) {
      throw new Error('Ce pseudo est déjà pris dans cette partie.');
    }

    const color = PLAYER_COLORS[existants.length % PLAYER_COLORS.length];

    const body = {
      partie_id:  partieId,
      pseudo:     pseudo,
      is_creator: !!isCreator,
      color:      color,
    };
    if (avatar && avatar >= 1 && avatar <= 9) {
      body.avatar = avatar;
    }

    const resp = await fetch(REST_BASE + '/joueurs', {
      method: 'POST',
      headers: authHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error('Erreur ajout joueur : ' + err);
    }
    const data = await resp.json();
    return data[0];
  }

  /**
   * Met à jour un joueur (pseudo, avatar...).
   */
  async function updateJoueur(joueurId, updates) {
    const url = REST_BASE + '/joueurs?id=eq.' + encodeURIComponent(joueurId);
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: authHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(updates),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error('Erreur mise à jour joueur : ' + err);
    }
    const data = await resp.json();
    return data[0];
  }


  // ======= API : CHOIX =======

  /**
   * Enregistre (ou met à jour) le choix d'un joueur pour un thème donné.
   * Si le joueur a déjà choisi pour ce thème, on remplace.
   */
  async function savePick(partieId, joueurId, themeIndex, track) {
    const body = {
      partie_id:   partieId,
      joueur_id:   joueurId,
      theme_index: themeIndex,
      deezer_id:   track.id,
      title:       track.title,
      artist:      track.artist.name,
      cover:       track.album.cover_big || track.album.cover_medium || '',
      preview_url: track.preview,
    };

    // Le "upsert" fait : insert si pas d'existant, sinon update.
    // Nécessite la contrainte unique (joueur_id, theme_index) qu'on a posée dans le SQL.
    const resp = await fetch(REST_BASE + '/choix?on_conflict=joueur_id,theme_index', {
      method: 'POST',
      headers: authHeaders({
        'Prefer': 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error('Erreur enregistrement choix : ' + err);
    }
    return await resp.json();
  }

  /**
   * Récupère tous les choix d'un joueur dans une partie.
   */
  async function getPicksForJoueur(partieId, joueurId) {
    const url = REST_BASE + '/choix' +
                '?partie_id=eq.' + encodeURIComponent(partieId) +
                '&joueur_id=eq.' + encodeURIComponent(joueurId) +
                '&select=*&order=theme_index.asc';
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Erreur lecture choix');
    return await resp.json();
  }

  /**
   * Récupère TOUS les choix d'une partie (utile pour la phase de vote).
   */
  async function getPicksForPartie(partieId) {
    const url = REST_BASE + '/choix' +
                '?partie_id=eq.' + encodeURIComponent(partieId) +
                '&select=*&order=theme_index.asc,picked_at.asc';
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Erreur lecture choix');
    return await resp.json();
  }

  /**
   * Compte combien de morceaux chaque joueur a choisi.
   * Retourne un objet { joueurId: nbChoix }.
   */
  async function getPickCountsByJoueur(partieId) {
    const picks = await getPicksForPartie(partieId);
    const counts = {};
    picks.forEach(p => {
      counts[p.joueur_id] = (counts[p.joueur_id] || 0) + 1;
    });
    return counts;
  }

  /**
   * Récupère TOUS les votes d'une partie.
   * @returns {Promise<Array>} Tableau de votes
   */
  async function getVotesForPartie(partieId) {
    const url = REST_BASE + '/votes' +
                '?partie_id=eq.' + encodeURIComponent(partieId) +
                '&select=*';
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Erreur lecture votes');
    return await resp.json();
  }

  /**
   * Met à jour le statut d'une partie : 'en_cours' → 'votes' → 'terminee'
   */
  async function setPartieStatus(partieId, status) {
    const url = REST_BASE + '/parties?id=eq.' + encodeURIComponent(partieId);
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: authHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify({ status }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error('Erreur changement statut : ' + err);
    }
    const data = await resp.json();
    // ATTENTION : si RLS bloque l'UPDATE silencieusement, data peut être [] (tableau vide).
    // On le détecte explicitement.
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(
        'La mise à jour du statut a échoué silencieusement. ' +
        'Cause probable : RLS bloque l\'UPDATE. ' +
        'Solution : exécute ce SQL dans Supabase :\n\n' +
        'create policy "maj parties" on public.parties for update using (true) with check (true);'
      );
    }
    return data[0];
  }


  // ======= API : DEEZER (via Edge Function) =======

  /**
   * Lance une recherche Deezer via notre Edge Function.
   * @param query  texte de recherche
   * @param signal AbortSignal optionnel
   * @param opts   { index, limit } pour la pagination
   */
  async function searchDeezer(query, signal, opts) {
    const limit = (opts && opts.limit) || 10;
    const index = (opts && opts.index) || 0;
    const url = FUNCTIONS_BASE + '/deezer-search' +
                '?q=' + encodeURIComponent(query) +
                '&limit=' + limit +
                '&index=' + index;
    const resp = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + SUPABASE_ANON,
        'apikey': SUPABASE_ANON,
      },
      signal: signal,
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error('Erreur Deezer : ' + err);
    }
    const data = await resp.json();
    const tracks = data.data || [];
    // Sécurité côté client : on filtre les morceaux sans extrait audio
    // (au cas où la edge function ne le fait pas / mal)
    return tracks.filter(t => t.preview && typeof t.preview === 'string' && t.preview.length > 0);
  }


  // ======= UTILITAIRES =======

  function generatePinCode() {
    // 6 chiffres aléatoires (le 1er ne peut pas être 0)
    const first = Math.floor(Math.random() * 9) + 1;
    const rest = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return '' + first + rest;
  }

  /**
   * Lit le contexte stocké localement (juste pour savoir QUI on est sur cet appareil :
   * la session locale = quelle partie + quel joueur on est).
   */
  function getSession() {
    try {
      const raw = localStorage.getItem('wooo:session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveSession(session) {
    localStorage.setItem('wooo:session', JSON.stringify(session));
    // Quand on enregistre une session, on l'ajoute aussi à l'historique
    addToHistory(session);
  }
  function clearSession() {
    localStorage.removeItem('wooo:session');
  }


  // ======= HISTORIQUE DES PARTIES =======
  // Liste de toutes les parties auxquelles l'utilisateur a participé
  // sur cet appareil. Stocké en localStorage.
  // Format : [{ partie_id, pin_code, themes, joueur_id, pseudo, avatar, is_creator, last_seen }]
  const HISTORY_KEY = 'wooo:history';
  const HISTORY_MAX = 20;

  function getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function addToHistory(session) {
    if (!session || !session.partie_id || !session.joueur_id) return;
    const list = getHistory();
    // Supprime l'éventuelle entrée existante pour cette partie
    const filtered = list.filter(p => p.partie_id !== session.partie_id);
    // Ajoute en tête
    filtered.unshift({
      partie_id:  session.partie_id,
      pin_code:   session.pin_code,
      themes:     session.themes,
      joueur_id:  session.joueur_id,
      pseudo:     session.pseudo,
      avatar:     session.avatar,
      is_creator: session.is_creator,
      last_seen:  Date.now(),
    });
    // Limite la taille
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, HISTORY_MAX)));
  }

  function removeFromHistory(partieId) {
    const list = getHistory().filter(p => p.partie_id !== partieId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }

  /**
   * Récupère les parties en cours (status = en_cours ou votes)
   * en croisant l'historique local avec les statuts réels en base.
   * Retourne un tableau enrichi : { ...histo, status, joueurs: [...] }
   */
  async function getActiveGames() {
    const history = getHistory();
    if (history.length === 0) return [];

    // On récupère les parties en parallèle (en filtrant les inexistantes)
    const results = await Promise.all(history.map(async (h) => {
      try {
        const partie = await getPartieById(h.partie_id);
        if (!partie) {
          // Partie supprimée → on la retire de l'historique
          removeFromHistory(h.partie_id);
          return null;
        }
        // On filtre les parties terminées (mais on garde les en_cours et votes)
        if (partie.status === 'terminee') return null;
        // On récupère aussi les joueurs pour l'affichage
        const joueurs = await getJoueurs(h.partie_id);
        return { ...h, status: partie.status, joueurs };
      } catch (e) {
        return null;
      }
    }));

    return results.filter(Boolean);
  }


  // ======= EXPOSITION =======
  Wooo.api = {
    createPartie,
    getPartieByPin,
    getPartieById,
    setPartieStatus,
    getJoueurs,
    addJoueur,
    updateJoueur,
    savePick,
    getPicksForJoueur,
    getPicksForPartie,
    getPickCountsByJoueur,
    getVotesForPartie,
    searchDeezer,
    getClient,
  };

  Wooo.session = {
    get:   getSession,
    save:  saveSession,
    clear: clearSession,
  };

  Wooo.history = {
    list:        getHistory,
    add:         addToHistory,
    remove:      removeFromHistory,
    activeGames: getActiveGames,
  };

  Wooo.config = {
    SUPABASE_URL,
    SUPABASE_ANON,
    PLAYER_COLORS,
  };

})(window.Wooo);
