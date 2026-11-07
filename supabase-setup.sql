-- ============================================================
-- AUCTION NEXUS — Supabase Database Setup
-- Run this entire script in: Supabase → SQL Editor → New Query
-- ============================================================

-- ─── 1. Admin Profiles Table ─────────────────────────────────
-- Stores role information for authenticated users.
-- This is separate from auth.users (which Supabase manages).

CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role  text NOT NULL DEFAULT 'admin',
  email text,
  created_at timestamptz DEFAULT now()
);

-- ─── 2. Auction State Table ──────────────────────────────────
-- Single-row table (id = 1) holding the entire auction state as JSONB.
-- This is the source of truth for all connected clients.

CREATE TABLE IF NOT EXISTS public.auction_state (
  id              integer PRIMARY KEY DEFAULT 1,
  state_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  auction_status  text NOT NULL DEFAULT 'upcoming',
  updated_at      timestamptz DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id)
);

-- Enforce single-row constraint
CREATE UNIQUE INDEX IF NOT EXISTS auction_state_single_row ON public.auction_state ((true));

-- Insert the initial row if it doesn't exist
INSERT INTO public.auction_state (id, state_json, auction_status)
VALUES (1, '{"view":"setup","setupDone":false,"teamA":{"teamName":"Team A","captain":"Captain A","purse":100,"players":[]},"teamB":{"teamName":"Team B","captain":"Captain B","purse":100,"players":[]},"playerPool":[],"activePlayerId":null,"currentBid":0,"currentBidder":null,"auctionHistory":[],"trades":[],"bidLog":[],"lastSale":null}'::jsonb, 'upcoming')
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Enable Row Level Security ────────────────────────────

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_state  ENABLE ROW LEVEL SECURITY;

-- ─── 4. RLS Policies: admin_profiles ─────────────────────────

-- Only the authenticated user themselves can read their own profile
DROP POLICY IF EXISTS "admin_profiles_read_own" ON public.admin_profiles;
CREATE POLICY "admin_profiles_read_own"
  ON public.admin_profiles FOR SELECT
  USING (auth.uid() = id);

-- Only the authenticated user themselves can update their own profile
DROP POLICY IF EXISTS "admin_profiles_update_own" ON public.admin_profiles;
CREATE POLICY "admin_profiles_update_own"
  ON public.admin_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ─── 5. RLS Policies: auction_state ──────────────────────────

-- PUBLIC READ: Anyone (including unauthenticated audience) can read auction state
DROP POLICY IF EXISTS "auction_state_public_read" ON public.auction_state;
CREATE POLICY "auction_state_public_read"
  ON public.auction_state FOR SELECT
  TO anon, authenticated
  USING (true);

-- ADMIN WRITE: Only authenticated users with role='admin' can update auction state
DROP POLICY IF EXISTS "auction_state_admin_write" ON public.auction_state;
CREATE POLICY "auction_state_admin_write"
  ON public.auction_state FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── 6. Enable Realtime on auction_state ─────────────────────
-- This enables Supabase Realtime to broadcast changes to subscribers.

ALTER TABLE public.auction_state REPLICA IDENTITY FULL;

-- Add auction_state to the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'auction_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_state;
  END IF;
END $$;

-- ─── 7. Function: auto-update updated_at timestamp ───────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_updated_at ON public.auction_state;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.auction_state
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── 8. GRANT ADMIN ROLE TO YOUR USER ────────────────────────
-- User ID provided: e5b0168a-68cf-49da-97b2-57d9ef6f3339

INSERT INTO public.admin_profiles (id, role)
VALUES ('e5b0168a-68cf-49da-97b2-57d9ef6f3339', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';



