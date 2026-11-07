import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AUCTION_ROW_ID = 1

function defaultState() {
  return {
    view: 'setup',
    auctionStatus: 'upcoming', // upcoming | live | paused | completed
    teamA: { teamName: 'Team A', captain: 'Captain A', purse: 100, players: [] },
    teamB: { teamName: 'Team B', captain: 'Captain B', purse: 100, players: [] },
    playerPool: [],
    activePlayerId: null,
    currentBid: 0,
    currentBidder: null,
    auctionHistory: [],
    trades: [],
    bidLog: [],
    lastSale: null,
    setupDone: false,
  }
}

export function useAuctionState(isAdmin = false) {
  const [state, setStateLocal] = useState(defaultState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const channelRef = useRef(null)
  const latestStateRef = useRef(state)

  useEffect(() => {
    latestStateRef.current = state
  }, [state])

  // Load initial state from DB
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError('Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }

    async function loadInitial() {
      try {
        const { data, error: dbError } = await supabase
          .from('auction_state')
          .select('state_json, auction_status')
          .eq('id', AUCTION_ROW_ID)
          .single()

        if (dbError) {
          if (dbError.code === 'PGRST116') {
            setStateLocal(defaultState())
          } else {
            throw dbError
          }
        } else if (data) {
          const loaded = { ...defaultState(), ...data.state_json, auctionStatus: data.auction_status }
          setStateLocal(loaded)
        }
      } catch (err) {
        setError(err.message)
        setStateLocal(defaultState())
      } finally {
        setLoading(false)
      }
    }

    loadInitial()
  }, [])

  // Set up real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel('auction-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_state',
          filter: `id=eq.${AUCTION_ROW_ID}`,
        },
        (payload) => {
          if (payload.new && payload.new.state_json) {
            const incoming = {
              ...defaultState(),
              ...payload.new.state_json,
              auctionStatus: payload.new.auction_status,
            }
            setStateLocal(incoming)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Real-time connection lost. Reconnecting...')
          setTimeout(() => setError(null), 3000)
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Admin-only: persist state to Supabase DB
  const persistState = useCallback(async (newState) => {
    if (!isAdmin || !isSupabaseConfigured) return

    const { auctionStatus, ...stateWithoutStatus } = newState

    try {
      const { error: upsertError } = await supabase
        .from('auction_state')
        .upsert(
          {
            id: AUCTION_ROW_ID,
            state_json: stateWithoutStatus,
            auction_status: auctionStatus || 'upcoming',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )

      if (upsertError) throw upsertError
    } catch (err) {
      console.error('Failed to persist state:', err)
      throw err
    }
  }, [isAdmin])

  // Admin-only setState that also persists to DB
  const setState = useCallback(async (updater) => {
    if (!isAdmin) return

    setStateLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { localStorage.setItem('auction_nexus_v1', JSON.stringify(next)) } catch {}
      persistState(next).catch(console.error)
      return next
    })
  }, [isAdmin, persistState])

  return { state, setState, loading, error, isConfigured: isSupabaseConfigured }
}
