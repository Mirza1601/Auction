import { useAuctionState } from '../hooks/useAuctionState'

const ROLE_COLORS = {
  'Batter': '#38BDF8',
  'Bowler': '#4ADE80',
  'All Rounder': '#F59E0B',
  'Wicket Keeper': '#F472B6',
}

const ROLE_SHORT = {
  'Batter': 'BAT',
  'Bowler': 'BWL',
  'All Rounder': 'AR',
  'Wicket Keeper': 'WK',
}

const AVATAR_BG = ['#6D28D9','#7C3AED','#8B5CF6','#A855F7','#6366F1','#3B82F6','#0EA5E9','#06B6D4']

function formatCr(val) {
  return `₹${Number(val).toFixed(1)} Cr`
}

function PlayerAvatar({ player, size = 48 }) {
  const color = AVATAR_BG[player.name.charCodeAt(0) % AVATAR_BG.length]
  const initials = player.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
  if (player.image) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid rgba(139,92,246,0.5)', flexShrink: 0, overflow: 'hidden', background: '#12091F' }}>
        <img src={player.image} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 35%, ${color}cc, ${color})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 700, color: '#fff',
      border: '2px solid rgba(139,92,246,0.5)', flexShrink: 0,
      fontFamily: "'Rajdhani', sans-serif"
    }}>
      {initials}
    </div>
  )
}

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || '#8B5CF6'
  return (
    <span style={{
      background: `${color}22`, border: `1px solid ${color}55`,
      color, borderRadius: 4, padding: '2px 8px',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      fontFamily: "'Rajdhani', sans-serif", whiteSpace: 'nowrap'
    }}>
      {ROLE_SHORT[role] || role?.toUpperCase()}
    </span>
  )
}

function StatusBadge({ status }) {
  const configs = {
    upcoming: { label: 'UPCOMING', color: '#6B7280', bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.3)', glow: false },
    live: { label: '● LIVE', color: '#4ADE80', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', glow: true },
    paused: { label: '⏸ PAUSED', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', glow: false },
    completed: { label: '✓ COMPLETED', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)', glow: false },
  }
  const cfg = configs[status] || configs.upcoming
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '5px 14px',
      color: cfg.color, fontSize: 12, fontWeight: 700,
      fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.1em',
      boxShadow: cfg.glow ? `0 0 20px ${cfg.border}` : 'none',
      animation: status === 'live' ? 'livePulse 2s infinite' : 'none'
    }}>
      {cfg.label}
    </div>
  )
}

function GlassCard({ children, style }) {
  return (
    <div style={{
      background: 'rgba(18,9,31,0.85)', border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: 12, backdropFilter: 'blur(12px)',
      boxShadow: '0 0 30px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.03)',
      ...style
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
      color: '#8B5CF6', textTransform: 'uppercase', marginBottom: 10,
      fontFamily: "'Rajdhani', sans-serif"
    }}>{children}</div>
  )
}

export default function AudiencePage() {
  const { state, loading, error, isConfigured } = useAuctionState(false) // read-only, no isAdmin

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#080010', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏏</div>
        <div style={{ color: '#8B5CF6', fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: '0.1em' }}>
          LOADING AUCTION...
        </div>
        <div style={{ color: '#4B5563', fontSize: 13 }}>Connecting to live feed</div>
      </div>
    )
  }

  const auctionStatus = state.auctionStatus || 'upcoming'
  const activePlayer = state.playerPool?.find(p => p.id === state.activePlayerId)
  const available = state.playerPool?.filter(p => p.status === 'available') || []
  const sold = state.playerPool?.filter(p => p.status === 'sold') || []
  const unsold = state.playerPool?.filter(p => p.status === 'unsold') || []

  const totalA = state.teamA?.players?.reduce((acc, id) => {
    const p = state.playerPool?.find(x => x.id === id)
    return acc + (p?.soldPrice || 0)
  }, 0) || 0

  const totalB = state.teamB?.players?.reduce((acc, id) => {
    const p = state.playerPool?.find(x => x.id === id)
    return acc + (p?.soldPrice || 0)
  }, 0) || 0

  const bidderColor = state.currentBidder === 'A' ? '#3B82F6' : state.currentBidder === 'B' ? '#EC4899' : '#8B5CF6'

  const isPreStart = auctionStatus === 'upcoming' && !state.setupDone

  return (
    <div style={{
      minHeight: '100vh', background: '#080010', color: '#E5E7EB',
      fontFamily: "'Rajdhani', sans-serif",
      backgroundImage: `
        radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.06) 0%, transparent 40%),
        repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(139,92,246,0.02) 60px, rgba(139,92,246,0.02) 61px),
        repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(139,92,246,0.02) 60px, rgba(139,92,246,0.02) 61px)
      `
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 20px rgba(34,197,94,0.4); }
          50% { box-shadow: 0 0 40px rgba(34,197,94,0.6); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'rgba(8,0,16,0.95)', borderBottom: '1px solid rgba(139,92,246,0.2)',
        padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0
      }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '0.05em' }}>
          AUCTION <span style={{ color: '#8B5CF6' }}>NEXUS</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusBadge status={auctionStatus} />
          <a href="/admin/login" style={{
            color: '#4B5563', fontSize: 11, textDecoration: 'none',
            padding: '3px 8px', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 4,
            fontFamily: "'Rajdhani', sans-serif"
          }}>
            Admin
          </a>
        </div>
      </div>

      {/* Main Broadcast View */}
      <div style={{ padding: '20px 16px', maxWidth: 1400, margin: '0 auto' }}>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Available', val: available.length, color: '#8B5CF6' },
              { label: 'Sold', val: sold.length, color: '#4ADE80' },
              { label: 'Unsold', val: unsold.length, color: '#6B7280' },
              { label: 'Total Players', val: state.playerPool?.length || 0, color: '#38BDF8' },
            ].map(s => (
              <GlassCard key={s.label} style={{ padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color, fontFamily: "'Rajdhani', sans-serif" }}>{s.val}</div>
                <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '0.1em' }}>{s.label.toUpperCase()}</div>
              </GlassCard>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: 16 }}>

            {/* Team A */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <GlassCard style={{ padding: 16 }}>
                <div style={{ background: 'linear-gradient(135deg,rgba(29,78,216,0.2),rgba(59,130,246,0.08))', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 8px #3B82F6' }} />
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 15, color: '#93C5FD' }}>
                      {state.teamA?.teamName || state.teamA?.captain}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>PURSE LEFT</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(state.teamA?.purse || 0)}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>SPENT</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#93C5FD', fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(totalA)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#4B7BA6' }}>{state.teamA?.players?.length || 0} PLAYERS ACQUIRED</div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <SectionTitle>Squad</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(state.teamA?.players || []).map(pid => {
                      const p = state.playerPool?.find(x => x.id === pid)
                      if (!p) return null
                      return (
                        <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                          <PlayerAvatar player={p} size={26} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: '#D1D5DB', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Rajdhani', sans-serif" }}>{p.name}</div>
                          </div>
                          <RoleBadge role={p.role} />
                          <div style={{ fontSize: 10, color: '#8B5CF6', whiteSpace: 'nowrap' }}>{formatCr(p.soldPrice || p.basePrice)}</div>
                        </div>
                      )
                    })}
                    {!state.teamA?.players?.length && <div style={{ color: '#4B5563', fontSize: 12, textAlign: 'center', padding: 8 }}>No players yet</div>}
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Center: Active Player + Bid Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Active Player Card */}
              <GlassCard style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: activePlayer ? 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.22), transparent 65%)' : 'none', pointerEvents: 'none' }} />
                {activePlayer ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 24px 20px', animation: 'fadeInUp 0.3s ease' }}>
                    {activePlayer.image ? (
                      <div style={{ width: 180, height: 180, borderRadius: 16, overflow: 'hidden', border: '3px solid rgba(139,92,246,0.6)', background: '#12091F', boxShadow: '0 0 50px rgba(139,92,246,0.35)', marginBottom: 16 }}>
                        <img src={activePlayer.image} alt={activePlayer.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ marginBottom: 16 }}>
                        <PlayerAvatar player={activePlayer} size={160} />
                      </div>
                    )}
                    <div style={{ fontSize: 9, letterSpacing: '0.25em', color: '#8B5CF6', marginBottom: 4, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>NOW AUCTIONING</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: "'Rajdhani', sans-serif", lineHeight: 1, marginBottom: 10, textAlign: 'center' }}>{activePlayer.name}</div>
                    <div style={{ marginBottom: 16 }}><RoleBadge role={activePlayer.role} /></div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, width: '100%' }}>
                      <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: '12px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#6B7280', letterSpacing: '0.1em', marginBottom: 4 }}>BASE PRICE</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#A78BFA', fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(activePlayer.basePrice)}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: '12px 0', textAlign: 'center', border: `1px solid ${bidderColor}44` }}>
                        <div style={{ fontSize: 9, color: '#6B7280', letterSpacing: '0.1em', marginBottom: 4 }}>CURRENT BID</div>
                        <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "'Rajdhani', sans-serif", color: bidderColor, textShadow: `0 0 16px ${bidderColor}88` }}>{formatCr(state.currentBid)}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: '12px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#6B7280', letterSpacing: '0.1em', marginBottom: 4 }}>HIGHEST BIDDER</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: bidderColor, fontFamily: "'Rajdhani', sans-serif", padding: '0 6px' }}>
                          {state.currentBidder
                            ? (state.currentBidder === 'A' ? (state.teamA?.teamName || state.teamA?.captain) : (state.teamB?.teamName || state.teamB?.captain))
                            : '—'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#4B5563' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏏</div>
                    <div style={{ fontSize: 16, fontFamily: "'Rajdhani', sans-serif" }}>
                      {auctionStatus === 'paused' ? 'Auction Paused — Resuming soon...' :
                       auctionStatus === 'completed' ? 'Auction Complete!' :
                       'Waiting for next player...'}
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* Bid Log */}
              {state.bidLog?.length > 0 && (
                <GlassCard style={{ padding: 14 }}>
                  <SectionTitle>Live Bid Log</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflow: 'auto' }}>
                    {[...state.bidLog].reverse().map((b, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color: b.team === 'A' ? '#93C5FD' : '#F9A8D4', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
                          {b.team === 'A' ? (state.teamA?.teamName || state.teamA?.captain) : (state.teamB?.teamName || state.teamB?.captain)}
                        </span>
                        <span style={{ color: '#8B5CF6', fontWeight: 700, fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* Auction History */}
              <GlassCard style={{ padding: 14 }}>
                <SectionTitle>Auction History</SectionTitle>
                {!state.auctionHistory?.length ? (
                  <div style={{ color: '#4B5563', fontSize: 12 }}>No transactions yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflow: 'auto' }}>
                    {state.auctionHistory.slice(0, 30).map(h => (
                      <div key={h.id} style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'center' }}>
                        <span style={{ color: '#4B5563', fontSize: 10, minWidth: 44 }}>{new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span style={{ color: '#D1D5DB', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>{h.playerName}</span>
                        {h.unsold ? (
                          <span style={{ color: '#6B7280', fontSize: 10 }}>UNSOLD</span>
                        ) : (
                          <>
                            <span style={{ color: '#6B7280' }}>→</span>
                            <span style={{ color: h.team === 'A' ? '#93C5FD' : '#F9A8D4', fontWeight: 600 }}>
                              {h.team === 'A' ? (state.teamA?.teamName || state.teamA?.captain) : (state.teamB?.teamName || state.teamB?.captain)}
                            </span>
                            <span style={{ color: '#8B5CF6', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>{formatCr(h.amount)}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            {/* Team B */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <GlassCard style={{ padding: 16 }}>
                <div style={{ background: 'linear-gradient(135deg,rgba(190,24,93,0.2),rgba(236,72,153,0.08))', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EC4899', boxShadow: '0 0 8px #EC4899' }} />
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 15, color: '#F9A8D4' }}>
                      {state.teamB?.teamName || state.teamB?.captain}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>PURSE LEFT</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(state.teamB?.purse || 0)}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>SPENT</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#F9A8D4', fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(totalB)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#7A3A5A' }}>{state.teamB?.players?.length || 0} PLAYERS ACQUIRED</div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <SectionTitle>Squad</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(state.teamB?.players || []).map(pid => {
                      const p = state.playerPool?.find(x => x.id === pid)
                      if (!p) return null
                      return (
                        <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                          <PlayerAvatar player={p} size={26} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: '#D1D5DB', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Rajdhani', sans-serif" }}>{p.name}</div>
                          </div>
                          <RoleBadge role={p.role} />
                          <div style={{ fontSize: 10, color: '#8B5CF6', whiteSpace: 'nowrap' }}>{formatCr(p.soldPrice || p.basePrice)}</div>
                        </div>
                      )
                    })}
                    {!state.teamB?.players?.length && <div style={{ color: '#4B5563', fontSize: 12, textAlign: 'center', padding: 8 }}>No players yet</div>}
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Player Pool Grid */}
          <div style={{ marginTop: 20 }}>
            <GlassCard style={{ padding: 20 }}>
              <SectionTitle>Player Pool</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {(state.playerPool || []).map(p => {
                  const statusColors = {
                    available: { border: 'rgba(139,92,246,0.3)', bg: 'rgba(18,9,31,0.7)' },
                    sold: { border: 'rgba(34,197,94,0.4)', bg: 'rgba(34,197,94,0.05)' },
                    unsold: { border: 'rgba(107,114,128,0.3)', bg: 'rgba(18,9,31,0.5)' },
                  }
                  const sc = statusColors[p.status] || statusColors.available
                  return (
                    <div key={p.id} style={{
                      background: sc.bg, border: `1px solid ${sc.border}`,
                      borderRadius: 8, padding: 10, position: 'relative', overflow: 'hidden',
                      opacity: p.status === 'unsold' ? 0.55 : 1
                    }}>
                      {p.status === 'sold' && <div style={{ position: 'absolute', top: 0, right: 0, background: '#4ADE80', color: '#000', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: '0 0 0 6px' }}>SOLD</div>}
                      {p.status === 'unsold' && <div style={{ position: 'absolute', top: 0, right: 0, background: '#6B7280', color: '#000', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: '0 0 0 6px' }}>UNSOLD</div>}
                      {p.id === state.activePlayerId && <div style={{ position: 'absolute', top: 0, right: 0, background: '#8B5CF6', color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: '0 0 0 6px' }}>ON BLOCK</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PlayerAvatar player={p} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: '#E5E7EB', fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: '#8B5CF6' }}>{formatCr(p.soldPrice || p.basePrice)}</div>
                        </div>
                      </div>
                      {p.status === 'sold' && p.soldTo && (
                        <div style={{ marginTop: 5, fontSize: 10, color: '#4ADE80' }}>
                          → {p.soldTo === 'A' ? (state.teamA?.teamName || state.teamA?.captain) : (state.teamB?.teamName || state.teamB?.captain)}
                        </div>
                      )}
                    </div>
                  )
                })}
                {!state.playerPool?.length && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#4B5563', padding: 40, fontSize: 14 }}>
                    Auction pool not yet configured.
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
  )
}

