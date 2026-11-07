const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'auction_nexus_full_backup');
const masterPlayers = JSON.parse(fs.readFileSync(path.join(baseDir, 'master_players_migrated.json'), 'utf8'));
const defState = JSON.parse(fs.readFileSync(path.join(baseDir, 'default_profile', 'state.json'), 'utf8'));
const kkrState = JSON.parse(fs.readFileSync(path.join(baseDir, 'profile_kkr_srm', 'state.json'), 'utf8'));

// Build cleaned player pool for default auction (replacing Base64 with CDN URLs)
const defPlayerPoolCleaned = defState.playerPool.map(p => {
  let masterId = 'master_' + p.name.trim().toLowerCase();
  if (p.name.trim().toLowerCase() === 'farhan') {
    masterId = (p.role === 'Batter') ? 'master_farhan_batter' : 'master_farhan_allrounder';
  }
  const master = masterPlayers.find(m => m.id === masterId);
  return {
    ...p,
    masterPlayerId: masterId,
    image: master ? master.photoUrl : p.image
  };
});

const cleanedDefState = {
  ...defState,
  playerPool: defPlayerPoolCleaned
};

// Build cleaned player pool for KKR vs SRM
const kkrPlayerPoolCleaned = kkrState.playerPool.map(p => {
  let masterId = 'master_' + p.name.trim().toLowerCase();
  if (p.name.trim().toLowerCase() === 'farhan') {
    masterId = 'master_farhan_allrounder';
  }
  const master = masterPlayers.find(m => m.id === masterId);
  return {
    ...p,
    masterPlayerId: masterId,
    image: master ? master.photoUrl : p.image
  };
});

const cleanedKkrState = {
  ...kkrState,
  playerPool: kkrPlayerPoolCleaned
};

let sql = `-- ============================================================
-- AUCTION NEXUS — COMPLETE DATABASE & PLAYER MASTER LIBRARY SETUP
-- Run this entire script in: Supabase → SQL Editor → New Query
-- Project: Mirza1601's Project (jsuegqbknolxiwmfppfl)
-- ============================================================

-- ─── 1. Admin Profiles Table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'admin',
  email       text,
  created_at  timestamptz DEFAULT now()
);

-- ─── 2. Permanent Player Master Library Table ────────────────
CREATE TABLE IF NOT EXISTS public.master_players (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  photo_url           text NOT NULL,
  role                text NOT NULL DEFAULT 'All Rounder',
  category            text NOT NULL DEFAULT 'General',
  default_base_price  numeric NOT NULL DEFAULT 3.0,
  stats               jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_archived         boolean NOT NULL DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ─── 3. Auctions Table (Independent Auction Environments) ────
CREATE TABLE IF NOT EXISTS public.auctions (
  id                  text PRIMARY KEY,
  title               text NOT NULL,
  status              text NOT NULL DEFAULT 'upcoming',
  team_a_name         text NOT NULL DEFAULT 'Team A',
  team_a_captain      text NOT NULL DEFAULT 'Captain A',
  team_a_purse        numeric NOT NULL DEFAULT 100.0,
  team_b_name         text NOT NULL DEFAULT 'Team B',
  team_b_captain      text NOT NULL DEFAULT 'Captain B',
  team_b_purse        numeric NOT NULL DEFAULT 100.0,
  state_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ─── 4. Auction Participants Table (Junction Table) ──────────
CREATE TABLE IF NOT EXISTS public.auction_participants (
  id                  bigserial PRIMARY KEY,
  auction_id          text NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  player_id           text NOT NULL REFERENCES public.master_players(id) ON DELETE RESTRICT,
  base_price          numeric NOT NULL DEFAULT 3.0,
  status              text NOT NULL DEFAULT 'available',
  winning_team        text,
  sold_price          numeric DEFAULT 0,
  lot_order           integer DEFAULT 0,
  auction_metadata    jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(auction_id, player_id)
);

-- ─── 5. Live Auction State Table (Broadcasting) ──────────────
CREATE TABLE IF NOT EXISTS public.auction_state (
  id                  integer PRIMARY KEY DEFAULT 1,
  active_auction_id   text REFERENCES public.auctions(id) ON DELETE SET NULL,
  state_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
  auction_status      text NOT NULL DEFAULT 'upcoming',
  updated_at          timestamptz DEFAULT now(),
  updated_by          uuid REFERENCES auth.users(id)
);

-- Enforce single-row constraint on auction_state
CREATE UNIQUE INDEX IF NOT EXISTS auction_state_single_row ON public.auction_state ((true));

-- ─── 6. Enable Row Level Security (RLS) ──────────────────────
ALTER TABLE public.admin_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_state        ENABLE ROW LEVEL SECURITY;

-- ─── 7. RLS Policies: Public Read + Admin Write ──────────────

-- admin_profiles
DROP POLICY IF EXISTS "admin_profiles_read_all" ON public.admin_profiles;
CREATE POLICY "admin_profiles_read_all" ON public.admin_profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_profiles_write_all" ON public.admin_profiles;
CREATE POLICY "admin_profiles_write_all" ON public.admin_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- master_players
DROP POLICY IF EXISTS "master_players_read" ON public.master_players;
CREATE POLICY "master_players_read" ON public.master_players FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "master_players_write" ON public.master_players;
CREATE POLICY "master_players_write" ON public.master_players FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- auctions
DROP POLICY IF EXISTS "auctions_read" ON public.auctions;
CREATE POLICY "auctions_read" ON public.auctions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auctions_write" ON public.auctions;
CREATE POLICY "auctions_write" ON public.auctions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- auction_participants
DROP POLICY IF EXISTS "auction_participants_read" ON public.auction_participants;
CREATE POLICY "auction_participants_read" ON public.auction_participants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auction_participants_write" ON public.auction_participants;
CREATE POLICY "auction_participants_write" ON public.auction_participants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- auction_state
DROP POLICY IF EXISTS "auction_state_read" ON public.auction_state;
CREATE POLICY "auction_state_read" ON public.auction_state FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auction_state_write" ON public.auction_state;
CREATE POLICY "auction_state_write" ON public.auction_state FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─── 8. Enable Supabase Realtime Publications ────────────────
ALTER TABLE public.auction_state        REPLICA IDENTITY FULL;
ALTER TABLE public.master_players       REPLICA IDENTITY FULL;
ALTER TABLE public.auction_participants REPLICA IDENTITY FULL;
ALTER TABLE public.auctions             REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auction_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_state;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'master_players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.master_players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auction_participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_participants;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auctions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
  END IF;
END $$;

-- ─── 9. Seed Admin User ──────────────────────────────────────
INSERT INTO public.admin_profiles (id, role, email)
VALUES ('e5b0168a-68cf-49da-97b2-57d9ef6f3339', 'admin', 'mirzazabiullah@gmail.com')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- ─── 10. Seed Permanent Master Players (22 Players) ──────────
`;

for (const m of masterPlayers) {
  const statsJson = JSON.stringify(m.stats).replace(/'/g, "''");
  sql += `INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('${m.id}', '${m.name.replace(/'/g, "''")}', '${m.photoUrl}', '${m.role}', '${m.category}', ${m.basePrice}, '${statsJson}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;\n`;
}

sql += `\n-- ─── 11. Seed Auctions (Default & KKR vs SRM) ────────────────
INSERT INTO public.auctions (id, title, status, team_a_name, team_a_captain, team_a_purse, team_b_name, team_b_captain, team_b_purse, state_json)
VALUES (
  'default_auction',
  'Premier League Auction (Live)',
  'upcoming',
  '${defState.teamA?.teamName || 'Team A'}',
  '${defState.teamA?.captain || 'Captain A'}',
  ${defState.teamA?.purse || 100},
  '${defState.teamB?.teamName || 'Team B'}',
  '${defState.teamB?.captain || 'Captain B'}',
  ${defState.teamB?.purse || 100},
  '${JSON.stringify(cleanedDefState).replace(/'/g, "''")}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  state_json = EXCLUDED.state_json;

INSERT INTO public.auctions (id, title, status, team_a_name, team_a_captain, team_a_purse, team_b_name, team_b_captain, team_b_purse, state_json)
VALUES (
  'kkr_vs_srm',
  'IPL Championship: KKR vs SRM (Historical)',
  'completed',
  '${kkrState.teamA?.teamName || 'KKR'}',
  '${kkrState.teamA?.captain || 'Captain KKR'}',
  ${kkrState.teamA?.purse || 100},
  '${kkrState.teamB?.teamName || 'SRM'}',
  '${kkrState.teamB?.captain || 'Captain SRM'}',
  ${kkrState.teamB?.purse || 100},
  '${JSON.stringify(cleanedKkrState).replace(/'/g, "''")}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  state_json = EXCLUDED.state_json;

-- ─── 12. Seed Auction Participants ───────────────────────────
`;

// Seed default_auction participants
for (let i = 0; i < defPlayerPoolCleaned.length; i++) {
  const p = defPlayerPoolCleaned[i];
  sql += `INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', '${p.masterPlayerId}', ${p.price || 3.0}, '${p.sold ? 'sold' : 'available'}', ${p.team ? `'${p.team}'` : 'NULL'}, ${p.soldPrice || 0}, ${i + 1})
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;\n`;
}

// Seed kkr_vs_srm participants
for (let i = 0; i < kkrPlayerPoolCleaned.length; i++) {
  const p = kkrPlayerPoolCleaned[i];
  sql += `INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', '${p.masterPlayerId}', ${p.price || 3.0}, '${p.sold ? 'sold' : 'available'}', ${p.team ? `'${p.team}'` : 'NULL'}, ${p.soldPrice || 0}, ${i + 1})
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;\n`;
}

sql += `\n-- ─── 13. Initialize Live Auction State ────────────────────────
INSERT INTO public.auction_state (id, active_auction_id, state_json, auction_status)
VALUES (
  1,
  'default_auction',
  '${JSON.stringify(cleanedDefState).replace(/'/g, "''")}'::jsonb,
  'upcoming'
)
ON CONFLICT (id) DO UPDATE SET
  active_auction_id = EXCLUDED.active_auction_id,
  state_json = EXCLUDED.state_json,
  auction_status = EXCLUDED.auction_status;
`;

fs.writeFileSync(path.join(__dirname, '..', 'supabase-setup.sql'), sql, 'utf8');
console.log('Successfully generated full supabase-setup.sql!');
