import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AUCTION_ROW_ID = 1
const STORAGE_KEY = 'auction_nexus_v1'

function getLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {}
  return null
}

function defaultState() {
  const local = getLocalState()

  return {
    view: local?.view || 'setup',
    auctionStatus: local?.auctionStatus || 'upcoming', // upcoming | live | paused | completed
    teamA: local?.teamA || { teamName: 'Team A', captain: 'Captain A', purse: 100, players: [] },
    teamB: local?.teamB || { teamName: 'Team B', captain: 'Captain B', purse: 100, players: [] },
    playerPool: Array.isArray(local?.playerPool) ? local.playerPool : [],
    activePlayerId: local?.activePlayerId || null,
    currentBid: local?.currentBid || 0,
    currentBidder: local?.currentBidder || null,
    auctionHistory: Array.isArray(local?.auctionHistory) ? local.auctionHistory : [],
    trades: Array.isArray(local?.trades) ? local.trades : [],
    bidLog: Array.isArray(local?.bidLog) ? local.bidLog : [],
    lastSale: local?.lastSale || null,
    setupDone: Boolean(local?.setupDone),
  }
}

export function useAuctionState(isAdmin = false) {
  const [state, setStateLocal] = useState(defaultState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const channelRef = useRef(null)
  const broadcastRef = useRef(null)
  const latestStateRef = useRef(state)

  useEffect(() => {
    latestStateRef.current = state
  }, [state])

  // BroadcastChannel for instant 0ms sync across tabs and windows
  useEffect(() => {
    let bc = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('auction_nexus_sync')
        bc.onmessage = (event) => {
          if (event.data && typeof event.data === 'object') {
            setStateLocal(prev => ({
              ...prev,
              ...event.data,
              // Never erase local player pool if incoming has none
              playerPool: (event.data.playerPool && event.data.playerPool.length > 0)
                ? event.data.playerPool
                : (prev.playerPool && prev.playerPool.length > 0 ? prev.playerPool : event.data.playerPool || []),
            }))
          }
        }
        broadcastRef.current = bc
      }
    } catch {}

    return () => {
      bc?.close()
    }
  }, [])

  // Load state from DB
  const fetchDbState = useCallback(async (isInitial = false) => {
    if (!isSupabaseConfigured) {
      if (isInitial) setLoading(false)
      return
    }

    try {
      const { data, error: dbError } = await supabase
        .from('auction_state')
        .select('state_json, auction_status')
        .eq('id', AUCTION_ROW_ID)
        .single()

      if (dbError) {
        if (dbError.code === 'PGRST116') {
          // Row doesn't exist yet: if admin, persist current local state
          if (isAdmin) {
            persistState(latestStateRef.current).catch(() => {})
          }
        } else {
          console.warn('DB load warning:', dbError.message)
        }
      } else if (data) {
        const dbJson = data.state_json || {}
        const local = getLocalState()

        // PRESERVE PLAYER POOL: If local has players and DB has none, keep local
        const mergedPool = (dbJson.playerPool && dbJson.playerPool.length > 0)
          ? dbJson.playerPool
          : (local?.playerPool && local.playerPool.length > 0 ? local.playerPool : [])

        const incoming = {
          ...defaultState(),
          ...dbJson,
          playerPool: mergedPool,
          auctionStatus: data.auction_status || 'upcoming',
        }

        setStateLocal(incoming)

        // Save local backup
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming))
        } catch {}

        // If admin and DB was missing the player pool that we had locally, sync it up to DB now
        if (isAdmin && (!dbJson.playerPool || dbJson.playerPool.length === 0) && mergedPool.length > 0) {
          persistState(incoming).catch(() => {})
        }
      }
    } catch (err) {
      console.warn('Error loading auction state:', err)
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [isAdmin])

  // Initial load
  useEffect(() => {
    fetchDbState(true)
  }, [fetchDbState])

  // Real-time subscription (Supabase WebSocket)
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
            const dbJson = payload.new.state_json
            setStateLocal(prev => {
              const incoming = {
                ...prev,
                ...dbJson,
                auctionStatus: payload.new.auction_status || prev.auctionStatus,
                playerPool: (dbJson.playerPool && dbJson.playerPool.length > 0)
                  ? dbJson.playerPool
                  : prev.playerPool,
              }
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming))
              } catch {}
              return incoming
            })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Supabase realtime status:', status)
        }
      })

    channelRef.current = channel

    // Polling safety net for audience (every 2.5s) to guarantee zero desync
    let pollInterval = null
    if (!isAdmin) {
      pollInterval = setInterval(() => {
        fetchDbState(false)
      }, 2500)
    }

    return () => {
      supabase.removeChannel(channel)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [isAdmin, fetchDbState])

  // Persist state to Supabase DB and BroadcastChannel
  const persistState = useCallback(async (newState) => {
    // 1. Immediately broadcast to any open tabs on this browser
    try {
      broadcastRef.current?.postMessage(newState)
    } catch {}

    // 2. Persist to local storage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    } catch {}

    // 3. Persist to Supabase DB
    if (!isSupabaseConfigured) return

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

      if (upsertError) {
        console.error('Failed to sync state to Supabase:', upsertError.message)
      }
    } catch (err) {
      console.error('Network error persisting state:', err)
    }
  }, [])

  // Admin setState
  const setState = useCallback(async (updater) => {
    if (!isAdmin) return

    setStateLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      persistState(next).catch(() => {})
      return next
    })
  }, [isAdmin, persistState])

  return { state, setState, loading, error, isConfigured: isSupabaseConfigured }
}
