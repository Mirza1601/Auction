-- ============================================================
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
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_adeen', 'Adeen', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_adeen.jpeg', 'All Rounder', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_anzar', 'Anzar', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_anzar.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_arhan', 'Arhan', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_arhan.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_ayaan', 'Ayaan', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_ayaan.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_farhan_allrounder', 'Farhan', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_farhan_allrounder.jpeg', 'All Rounder', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_farhan_batter', 'Farhan', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_farhan_batter.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_haseeb', 'Haseeb', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_haseeb.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_kaif', 'Kaif', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_kaif.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_loony', 'Loony', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_loony.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_moin', 'Moin', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_moin.jpeg', 'Bowler', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_nabeel', 'Nabeel', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_nabeel.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_omar', 'Omar', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_omar.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_rayyan', 'Rayyan', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_rayyan.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_razi', 'Razi', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_razi.jpeg', 'Wicket Keeper', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_rumaan', 'Rumaan', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_rumaan.jpeg', 'Batter', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_sami', 'Sami', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_sami.jpeg', 'Bowler', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_tabrez', 'Tabrez', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_tabrez.jpeg', 'Wicket Keeper', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_unais', 'Unais', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_unais.jpeg', 'All Rounder', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_zabi', 'Zabi', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zabi.jpeg', 'Bowler', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_zaid', 'Zaid', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zaid.jpeg', 'Wicket Keeper', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_zaki', 'Zaki', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zaki.jpeg', 'All Rounder', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;
INSERT INTO public.master_players (id, name, photo_url, role, category, default_base_price, stats, is_archived)
VALUES ('master_zuhair', 'Zuhair', 'https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zuhair.jpeg', 'All Rounder', 'General', 3, '{"matches":0,"runs":0,"wickets":0,"strikeRate":0,"economy":0,"battingStyle":"","bowlingStyle":""}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role,
  category = EXCLUDED.category,
  stats = EXCLUDED.stats;

-- ─── 11. Seed Auctions (Default & KKR vs SRM) ────────────────
INSERT INTO public.auctions (id, title, status, team_a_name, team_a_captain, team_a_purse, team_b_name, team_b_captain, team_b_purse, state_json)
VALUES (
  'default_auction',
  'Premier League Auction (Live)',
  'upcoming',
  'Team A',
  'Captain A',
  96,
  'Team B',
  'Captain B',
  100,
  '{"view":"auction","auctionStatus":"upcoming","teamA":{"teamName":"Team A","captain":"Captain A","purse":96,"players":["uj61gs34"]},"teamB":{"teamName":"Team B","captain":"Captain B","purse":100,"players":[]},"playerPool":[{"id":"8o1smdxe","name":"zaid","role":"Wicket Keeper","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zaid.jpeg","status":"available","masterPlayerId":"master_zaid"},{"id":"dvlsv37l","name":"razi","role":"Wicket Keeper","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_razi.jpeg","status":"available","masterPlayerId":"master_razi"},{"id":"uyuedg7m","name":"unais","role":"All Rounder","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_unais.jpeg","status":"available","masterPlayerId":"master_unais"},{"id":"ui1dgr6s","name":"ayaan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_ayaan.jpeg","status":"available","masterPlayerId":"master_ayaan"},{"id":"jusl84dn","name":"farhan","role":"All Rounder","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_farhan_allrounder.jpeg","status":"available","masterPlayerId":"master_farhan_allrounder"},{"id":"oepi6ize","name":"tabrez","role":"Wicket Keeper","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_tabrez.jpeg","status":"available","masterPlayerId":"master_tabrez"},{"id":"693ml8qs","name":"moin","role":"Bowler","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_moin.jpeg","status":"available","masterPlayerId":"master_moin"},{"id":"7yf5xe77","name":"zuhair","role":"All Rounder","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zuhair.jpeg","status":"available","masterPlayerId":"master_zuhair"},{"id":"uj61gs34","name":"zabi","role":"Bowler","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zabi.jpeg","status":"sold","soldTo":"A","soldPrice":4,"masterPlayerId":"master_zabi"},{"id":"wqu1gvzl","name":"rumaan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_rumaan.jpeg","status":"available","masterPlayerId":"master_rumaan"},{"id":"yuvqh05j","name":"arhan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_arhan.jpeg","status":"available","masterPlayerId":"master_arhan"},{"id":"rng5uxa0","name":"adeen","role":"All Rounder","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_adeen.jpeg","status":"available","masterPlayerId":"master_adeen"},{"id":"wwmz6b29","name":"anzar","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_anzar.jpeg","status":"available","masterPlayerId":"master_anzar"},{"id":"b4rstv5z","name":"farhan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_farhan_batter.jpeg","status":"available","masterPlayerId":"master_farhan_batter"},{"id":"4b0miih9","name":"kaif","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_kaif.jpeg","status":"available","masterPlayerId":"master_kaif"},{"id":"shsd5lkk","name":"rayyan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_rayyan.jpeg","status":"available","masterPlayerId":"master_rayyan"}],"activePlayerId":null,"currentBid":0,"currentBidder":null,"auctionHistory":[{"id":"3faeeb87","playerId":"uj61gs34","playerName":"zabi","team":"A","amount":4,"ts":1794092304971}],"trades":[],"bidLog":[],"lastSale":{"id":"3faeeb87","playerId":"uj61gs34","playerName":"zabi","team":"A","amount":4,"ts":1794092304971},"setupDone":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  state_json = EXCLUDED.state_json;

INSERT INTO public.auctions (id, title, status, team_a_name, team_a_captain, team_a_purse, team_b_name, team_b_captain, team_b_purse, state_json)
VALUES (
  'kkr_vs_srm',
  'IPL Championship: KKR vs SRM (Historical)',
  'completed',
  'KKR',
  'RUMAAN',
  20,
  'SRM',
  'ZAKI',
  32,
  '{"view":"auction","teamA":{"teamName":"KKR","captain":"RUMAAN","purse":20,"players":["bbt30ayr","h97vrax3","f88r62qb","mc50tyeu","m4jthmvs","40v4cq8s","64bdvd35","kvx289p6"]},"teamB":{"teamName":"SRM","captain":"ZAKI","purse":32,"players":["jeuvqjj3","tyv2zwnq","01rrwje9","q6d2c5v6","g22d0ed3","7k5pp639","fhjeyn23","z2cwrr0n"]},"playerPool":[{"id":"g22d0ed3","name":"UNAIS","role":"All Rounder","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_unais.jpeg","status":"sold","soldTo":"B","soldPrice":15,"masterPlayerId":"master_unais"},{"id":"bbt30ayr","name":"RUMAAN","role":"Batter","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_rumaan.jpeg","status":"sold","soldTo":"A","soldPrice":3,"masterPlayerId":"master_rumaan"},{"id":"m4jthmvs","name":"ZAID","role":"Wicket Keeper","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zaid.jpeg","status":"sold","soldTo":"A","soldPrice":3,"masterPlayerId":"master_zaid"},{"id":"64bdvd35","name":"HASEEB","role":"Batter","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_haseeb.jpeg","status":"sold","soldTo":"B","soldPrice":5,"masterPlayerId":"master_haseeb"},{"id":"jeuvqjj3","name":"ZAKI","role":"All Rounder","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zaki.jpeg","status":"sold","soldTo":"B","soldPrice":3,"masterPlayerId":"master_zaki"},{"id":"f88r62qb","name":"MOIN","role":"Bowler","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_moin.jpeg","status":"sold","soldTo":"A","soldPrice":9,"masterPlayerId":"master_moin"},{"id":"h97vrax3","name":"ADEEN","role":"All Rounder","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_adeen.jpeg","status":"sold","soldTo":"A","soldPrice":20,"masterPlayerId":"master_adeen"},{"id":"q6d2c5v6","name":"FARHAN","role":"All Rounder","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_farhan_allrounder.jpeg","status":"sold","soldTo":"B","soldPrice":17,"masterPlayerId":"master_farhan_allrounder"},{"id":"z2cwrr0n","name":"LOONY","role":"Batter","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_loony.jpeg","status":"sold","soldTo":"A","soldPrice":10,"masterPlayerId":"master_loony"},{"id":"kvx289p6","name":"ZUHAIR","role":"Batter","basePrice":1,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zuhair.jpeg","status":"sold","soldTo":"B","soldPrice":10,"masterPlayerId":"master_zuhair"},{"id":"7k5pp639","name":"RAZI","role":"Bowler","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_razi.jpeg","status":"sold","soldTo":"B","soldPrice":13,"masterPlayerId":"master_razi"},{"id":"mc50tyeu","name":"ZABI","role":"All Rounder","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zabi.jpeg","status":"sold","soldTo":"A","soldPrice":19,"masterPlayerId":"master_zabi"},{"id":"fhjeyn23","name":"NABEEL","role":"Batter","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_nabeel.jpeg","status":"sold","soldTo":"A","soldPrice":3,"masterPlayerId":"master_nabeel"},{"id":"tyv2zwnq","name":"OMAR","role":"Batter","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_omar.jpeg","status":"sold","soldTo":"B","soldPrice":5.5,"masterPlayerId":"master_omar"},{"id":"01rrwje9","name":"SAMI","role":"Bowler","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_sami.jpeg","status":"sold","soldTo":"B","soldPrice":9.5,"masterPlayerId":"master_sami"},{"id":"40v4cq8s","name":"TABREZ","role":"Wicket Keeper","basePrice":2,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_tabrez.jpeg","status":"sold","soldTo":"A","soldPrice":3,"masterPlayerId":"master_tabrez"}],"activePlayerId":null,"currentBid":0,"currentBidder":null,"auctionHistory":[{"id":"8rh1jty7","playerId":"fhjeyn23","playerName":"NABEEL","team":"A","amount":3,"ts":1780674517788},{"id":"9smtmjgb","playerId":"40v4cq8s","playerName":"TABREZ","team":"A","amount":3,"ts":1780674499915},{"id":"chkdxtm5","playerId":"m4jthmvs","playerName":"ZAID","team":"A","amount":3,"ts":1780674281956},{"id":"idz27n99","playerId":"7k5pp639","playerName":"RAZI","team":"B","amount":13,"ts":1780674206325},{"id":"v8o31xeq","playerId":"g22d0ed3","playerName":"UNAIS","team":"B","amount":15,"ts":1780674086462},{"id":"o6d6rn8l","playerId":"mc50tyeu","playerName":"ZABI","team":"A","amount":19,"ts":1780673959637},{"id":"0kyp1y74","playerId":"q6d2c5v6","playerName":"FARHAN","team":"B","amount":17,"ts":1780673856795},{"id":"gjuoz9lj","playerId":"01rrwje9","playerName":"SAMI","team":"B","amount":9.5,"ts":1780673765102},{"id":"e545glmi","playerId":"tyv2zwnq","playerName":"OMAR","team":"B","amount":5.5,"ts":1780673691527},{"id":"q8f3nim7","playerId":"z2cwrr0n","playerName":"LOONY","team":"A","amount":10,"ts":1780673608638},{"id":"2mw44o60","playerId":"f88r62qb","playerName":"MOIN","team":"A","amount":9,"ts":1780673442423},{"id":"3qtujmi9","playerId":"h97vrax3","playerName":"ADEEN","team":"A","amount":20,"ts":1780673244679},{"id":"ylr1itln","playerId":"fhjeyn23","playerName":"NABEEL","team":null,"amount":0,"ts":1780673076480,"unsold":true},{"id":"6fj2o4nr","playerId":"40v4cq8s","playerName":"TABREZ","team":null,"amount":0,"ts":1780673045880,"unsold":true},{"id":"84j8up1s","playerId":"bbt30ayr","playerName":"RUMAAN","team":"A","amount":3,"ts":1780672950786},{"id":"31aog53m","playerId":"jeuvqjj3","playerName":"ZAKI","team":"B","amount":3,"ts":1780672940842},{"id":"7v0d7nwd","playerId":"kvx289p6","playerName":"ZUHAIR","team":"B","amount":10,"ts":1780672906771},{"id":"2fbs1id7","playerId":"64bdvd35","playerName":"HASEEB","team":"B","amount":5,"ts":1780672603322}],"trades":[{"id":"i2wr5anf","ts":1780677482578,"teamAPlayers":["NABEEL","LOONY"],"teamBPlayers":["HASEEB","ZUHAIR"],"cashAmount":10,"cashDir":"AtoB"}],"bidLog":[],"lastSale":{"id":"8rh1jty7","playerId":"fhjeyn23","playerName":"NABEEL","team":"A","amount":3,"ts":1780674517788},"setupDone":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  state_json = EXCLUDED.state_json;

-- ─── 12. Seed Auction Participants ───────────────────────────
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_zaid', 3, 'available', NULL, 0, 1)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_razi', 3, 'available', NULL, 0, 2)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_unais', 3, 'available', NULL, 0, 3)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_ayaan', 3, 'available', NULL, 0, 4)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_farhan_allrounder', 3, 'available', NULL, 0, 5)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_tabrez', 3, 'available', NULL, 0, 6)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_moin', 3, 'available', NULL, 0, 7)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_zuhair', 3, 'available', NULL, 0, 8)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_zabi', 3, 'available', NULL, 4, 9)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_rumaan', 3, 'available', NULL, 0, 10)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_arhan', 3, 'available', NULL, 0, 11)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_adeen', 3, 'available', NULL, 0, 12)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_anzar', 3, 'available', NULL, 0, 13)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_farhan_batter', 3, 'available', NULL, 0, 14)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_kaif', 3, 'available', NULL, 0, 15)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('default_auction', 'master_rayyan', 3, 'available', NULL, 0, 16)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_unais', 3, 'available', NULL, 15, 1)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_rumaan', 3, 'available', NULL, 3, 2)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_zaid', 3, 'available', NULL, 3, 3)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_haseeb', 3, 'available', NULL, 5, 4)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_zaki', 3, 'available', NULL, 3, 5)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_moin', 3, 'available', NULL, 9, 6)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_adeen', 3, 'available', NULL, 20, 7)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_farhan_allrounder', 3, 'available', NULL, 17, 8)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_loony', 3, 'available', NULL, 10, 9)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_zuhair', 3, 'available', NULL, 10, 10)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_razi', 3, 'available', NULL, 13, 11)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_zabi', 3, 'available', NULL, 19, 12)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_nabeel', 3, 'available', NULL, 3, 13)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_omar', 3, 'available', NULL, 5.5, 14)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_sami', 3, 'available', NULL, 9.5, 15)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;
INSERT INTO public.auction_participants (auction_id, player_id, base_price, status, winning_team, sold_price, lot_order)
VALUES ('kkr_vs_srm', 'master_tabrez', 3, 'available', NULL, 3, 16)
ON CONFLICT (auction_id, player_id) DO UPDATE SET
  status = EXCLUDED.status,
  winning_team = EXCLUDED.winning_team,
  sold_price = EXCLUDED.sold_price;

-- ─── 13. Initialize Live Auction State ────────────────────────
INSERT INTO public.auction_state (id, active_auction_id, state_json, auction_status)
VALUES (
  1,
  'default_auction',
  '{"view":"auction","auctionStatus":"upcoming","teamA":{"teamName":"Team A","captain":"Captain A","purse":96,"players":["uj61gs34"]},"teamB":{"teamName":"Team B","captain":"Captain B","purse":100,"players":[]},"playerPool":[{"id":"8o1smdxe","name":"zaid","role":"Wicket Keeper","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zaid.jpeg","status":"available","masterPlayerId":"master_zaid"},{"id":"dvlsv37l","name":"razi","role":"Wicket Keeper","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_razi.jpeg","status":"available","masterPlayerId":"master_razi"},{"id":"uyuedg7m","name":"unais","role":"All Rounder","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_unais.jpeg","status":"available","masterPlayerId":"master_unais"},{"id":"ui1dgr6s","name":"ayaan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_ayaan.jpeg","status":"available","masterPlayerId":"master_ayaan"},{"id":"jusl84dn","name":"farhan","role":"All Rounder","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_farhan_allrounder.jpeg","status":"available","masterPlayerId":"master_farhan_allrounder"},{"id":"oepi6ize","name":"tabrez","role":"Wicket Keeper","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_tabrez.jpeg","status":"available","masterPlayerId":"master_tabrez"},{"id":"693ml8qs","name":"moin","role":"Bowler","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_moin.jpeg","status":"available","masterPlayerId":"master_moin"},{"id":"7yf5xe77","name":"zuhair","role":"All Rounder","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zuhair.jpeg","status":"available","masterPlayerId":"master_zuhair"},{"id":"uj61gs34","name":"zabi","role":"Bowler","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_zabi.jpeg","status":"sold","soldTo":"A","soldPrice":4,"masterPlayerId":"master_zabi"},{"id":"wqu1gvzl","name":"rumaan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_rumaan.jpeg","status":"available","masterPlayerId":"master_rumaan"},{"id":"yuvqh05j","name":"arhan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_arhan.jpeg","status":"available","masterPlayerId":"master_arhan"},{"id":"rng5uxa0","name":"adeen","role":"All Rounder","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_adeen.jpeg","status":"available","masterPlayerId":"master_adeen"},{"id":"wwmz6b29","name":"anzar","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_anzar.jpeg","status":"available","masterPlayerId":"master_anzar"},{"id":"b4rstv5z","name":"farhan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_farhan_batter.jpeg","status":"available","masterPlayerId":"master_farhan_batter"},{"id":"4b0miih9","name":"kaif","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_kaif.jpeg","status":"available","masterPlayerId":"master_kaif"},{"id":"shsd5lkk","name":"rayyan","role":"Batter","basePrice":3,"image":"https://jsuegqbknolxiwmfppfl.supabase.co/storage/v1/object/public/player-photos/players/master_rayyan.jpeg","status":"available","masterPlayerId":"master_rayyan"}],"activePlayerId":null,"currentBid":0,"currentBidder":null,"auctionHistory":[{"id":"3faeeb87","playerId":"uj61gs34","playerName":"zabi","team":"A","amount":4,"ts":1794092304971}],"trades":[],"bidLog":[],"lastSale":{"id":"3faeeb87","playerId":"uj61gs34","playerName":"zabi","team":"A","amount":4,"ts":1794092304971},"setupDone":true}'::jsonb,
  'upcoming'
)
ON CONFLICT (id) DO UPDATE SET
  active_auction_id = EXCLUDED.active_auction_id,
  state_json = EXCLUDED.state_json,
  auction_status = EXCLUDED.auction_status;
