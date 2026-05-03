# 🎵 Wooo Musique

Un jeu musical multijoueur asynchrone pour jouer entre amis : chacun choisit ses chansons sur des thèmes donnés (« Musique préférée », « Musique d'ado », etc.), puis tout le monde devine qui a choisi quoi.

## ✨ Fonctionnalités

- 🎮 **Multijoueur** : 3 à 10 joueurs par partie
- 🎨 **8 avatars** au choix
- 🎵 **Catalogue Deezer** : recherche parmi des millions de morceaux avec extraits 30 secondes
- 🎯 **Thèmes personnalisables** : 14 thèmes prédéfinis + possibilité de créer les siens
- ⚡ **Temps réel** : suivi en direct des inscriptions, des choix et des votes
- 🏆 **Classement** avec podium et récap des votes par joueur

## 🚀 Comment jouer

1. Le créateur lance une partie et choisit ≥ 3 thèmes
2. Il invite ses amis avec un lien (code PIN à 6 chiffres)
3. Chacun choisit une chanson par thème
4. Quand tout le monde a fini, le créateur lance la phase de votes
5. Pour chaque chanson, deviner qui l'a choisie — +1 par bonne réponse, +2 bonus si sans-faute
6. Classement final avec récap détaillé

## 🛠 Stack technique

- **Frontend** : HTML / CSS / JavaScript vanilla (pas de framework)
- **Base de données** : [Supabase](https://supabase.com) (PostgreSQL + Auth + Realtime)
- **API musique** : [Deezer Public API](https://developers.deezer.com) via une Edge Function Supabase (proxy CORS)
- **Hébergement** : Vercel / Netlify (statique)

## 📁 Structure du projet

```
wooo/
├── index.html              # Accueil + onboarding
├── create.html             # Choix des thèmes
├── invite.html             # Pseudo + avatar + lien à partager (créateur)
├── join.html               # Rejoindre une partie via code PIN
├── search.html             # Recherche de chansons (Deezer)
├── lobby.html              # Salle d'attente
├── guess.html              # Phase de vote (vinyle + avatars)
├── recap.html              # Ajustement des votes + résultats
├── classement.html         # Classement final + récap
├── late.html               # "Trop tard, partie déjà lancée"
├── styles.css              # Styles globaux et tokens
├── search.css              # Styles communs aux pages
├── *.css                   # Styles spécifiques par page
├── *.js                    # Logique JS par page
├── supabase.js             # Client Supabase + API métier
├── script.js               # JS de la homepage (carrousel)
└── assets/
    ├── logo.svg
    ├── illu-*.svg          # Illustrations onboarding
    └── avatar1-8.png       # Avatars joueurs
```

## ⚙️ Configuration Supabase

Pour faire tourner le projet, il faut une instance Supabase avec :

### Tables

```sql
create table parties (
  id uuid primary key default gen_random_uuid(),
  pin_code text unique not null,
  themes text[] not null,
  status text default 'en_cours',
  created_at timestamptz default now()
);

create table joueurs (
  id uuid primary key default gen_random_uuid(),
  partie_id uuid references parties(id) on delete cascade,
  pseudo text not null,
  color text,
  avatar integer default 1 check (avatar between 1 and 9),
  is_creator boolean default false,
  joined_at timestamptz default now(),
  unique(partie_id, pseudo)
);

create table choix (
  id uuid primary key default gen_random_uuid(),
  partie_id uuid references parties(id) on delete cascade,
  joueur_id uuid references joueurs(id) on delete cascade,
  theme_index integer not null,
  deezer_id bigint,
  title text, artist text, cover text, preview_url text,
  picked_at timestamptz default now(),
  unique(joueur_id, theme_index)
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  partie_id uuid references parties(id) on delete cascade,
  voter_id uuid references joueurs(id) on delete cascade,
  choix_id uuid references choix(id) on delete cascade,
  guessed_id uuid references joueurs(id) on delete cascade,
  voted_at timestamptz default now(),
  unique(voter_id, choix_id)
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  partie_id uuid references parties(id) on delete cascade,
  joueur_id uuid references joueurs(id) on delete cascade,
  theme_index integer not null,
  points integer default 0,
  bonus integer default 0,
  computed_at timestamptz default now(),
  unique(joueur_id, theme_index)
);
```

### RLS (Row Level Security)

Toutes les tables ont des policies ouvertes (select, insert, update) pour permettre l'accès anonyme :

```sql
alter table parties enable row level security;
create policy "lecture parties" on parties for select using (true);
create policy "creation parties" on parties for insert with check (true);
create policy "maj parties" on parties for update using (true) with check (true);

-- Idem pour joueurs, choix, votes, scores
```

### Realtime

Activer la réplication realtime sur les tables `parties`, `joueurs`, `choix`, `votes`, `scores`.

### Edge Function `deezer-search`

Proxy CORS vers l'API Deezer. Code dans `supabase/functions/deezer-search/index.ts` (à créer).

### Configuration côté frontend

Modifier `supabase.js` avec ton URL Supabase et ta clé anon.

## 🌐 Déploiement

### Vercel (recommandé)

```bash
npx vercel
```

Ou drag-and-drop du dossier sur https://vercel.com/new.

### Netlify

Drag-and-drop du dossier sur https://app.netlify.com/drop.

## 🤝 Contribuer

Les PRs sont les bienvenues ! N'hésite pas à ouvrir une issue pour discuter d'une nouvelle fonctionnalité.

## 📝 Licence

MIT — voir le fichier [LICENSE](LICENSE).
