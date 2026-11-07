/**
 * AdminAuctionNexus.jsx
 *
 * Wraps the existing AuctionNexus app logic for admin use.
 * Adds: Auction Status control bar (Start / Pause / Resume / End / Reset)
 * All existing AuctionNexus views and functionality are preserved exactly.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Re-export all shared constants / helpers from original ──────────────────

const ROLES = ['Batter', 'Bowler', 'All Rounder', 'Wicket Keeper']
const ROLE_COLORS = {
  Batter: '#38BDF8',
  Bowler: '#4ADE80',
  'All Rounder': '#F59E0B',
  'Wicket Keeper': '#F472B6',
}
const ROLE_SHORT = {
  Batter: 'BAT',
  Bowler: 'BWL',
  'All Rounder': 'AR',
  'Wicket Keeper': 'WK',
}
const BID_INCREMENTS = [0.5, 1, 2, 5, 10]

function genId() {
  return Math.random().toString(36).slice(2, 10)
}
function formatCr(val) {
  return `₹${Number(val).toFixed(1)} Cr`
}

const AVATAR_BG = ['#6D28D9','#7C3AED','#8B5CF6','#A855F7','#6366F1','#3B82F6','#0EA5E9','#06B6D4']

function PlayerAvatar({ player, size = 64 }) {
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
      fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em'
    }}>
      {initials}
    </div>
  )
}

function RoleBadge({ role, small }) {
  const color = ROLE_COLORS[role] || '#8B5CF6'
  return (
    <span style={{
      background: `${color}22`, border: `1px solid ${color}55`,
      color, borderRadius: 4, padding: small ? '1px 5px' : '2px 8px',
      fontSize: small ? 10 : 11, fontWeight: 700, letterSpacing: '0.08em',
      fontFamily: "'Rajdhani', sans-serif", whiteSpace: 'nowrap'
    }}>
      {small ? ROLE_SHORT[role] : role?.toUpperCase()}
    </span>
  )
}

function GlassCard({ children, style, className, onClick }) {
  return (
    <div onClick={onClick} className={className} style={{
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
      color: '#8B5CF6', textTransform: 'uppercase', marginBottom: 8,
      fontFamily: "'Rajdhani', sans-serif"
    }}>{children}</div>
  )
}

function Btn({ children, onClick, variant = 'primary', small, disabled, style, title }) {
  const base = {
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 6, fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700, letterSpacing: '0.05em',
    padding: small ? '4px 10px' : '8px 16px',
    fontSize: small ? 12 : 13,
    transition: 'all 0.15s', opacity: disabled ? 0.4 : 1,
    ...style
  }
  const variants = {
    primary: { background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)', color: '#fff', boxShadow: '0 0 16px rgba(139,92,246,0.3)' },
    secondary: { background: 'rgba(139,92,246,0.12)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' },
    danger: { background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' },
    success: { background: 'rgba(34,197,94,0.15)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.3)' },
    accent: { background: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)' },
    ghost: { background: 'transparent', color: '#6B7280', border: '1px solid rgba(107,114,128,0.3)' },
    teamA: { background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)', color: '#fff', boxShadow: '0 0 16px rgba(59,130,246,0.3)' },
    teamB: { background: 'linear-gradient(135deg,#BE185D,#EC4899)', color: '#fff', boxShadow: '0 0 16px rgba(236,72,153,0.3)' },
  }
  return (
    <button disabled={disabled} onClick={onClick} title={title} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  )
}

function Input({ value, onChange, placeholder, type = 'text', style }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: 6, color: '#E5E7EB', padding: '7px 11px', fontSize: 13,
        fontFamily: "'Rajdhani', sans-serif", outline: 'none', width: '100%',
        ...style
      }}
    />
  )
}

// ─── Auction Status Control Bar (new component) ──────────────────────────────

function AuctionStatusBar({ state, setState, notify }) {
  const status = state.auctionStatus || 'upcoming'

  async function setStatus(newStatus) {
    await setState(s => ({ ...s, auctionStatus: newStatus }))
    const labels = { live: '🔴 Auction is now LIVE!', paused: '⏸ Auction Paused', completed: '✓ Auction Ended', upcoming: 'Reset to Upcoming' }
    notify(labels[newStatus] || newStatus, newStatus === 'live' ? 'success' : 'info')
  }

  async function fullReset() {
    if (!window.confirm('⚠️ FULL RESET — This will erase EVERYTHING including all players, teams, and history. This will also update for all viewers. Are you sure?')) return
    await setState({
      view: 'setup',
      auctionStatus: 'upcoming',
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
    })
    notify('Full reset complete', 'info')
  }

  const statusConfig = {
    upcoming: { color: '#6B7280', label: 'UPCOMING' },
    live: { color: '#4ADE80', label: '● LIVE', glow: true },
    paused: { color: '#F59E0B', label: '⏸ PAUSED' },
    completed: { color: '#8B5CF6', label: '✓ COMPLETED' },
  }
  const sc = statusConfig[status] || statusConfig.upcoming

  return (
    <div style={{
      background: 'rgba(8,0,20,0.9)', borderBottom: '1px solid rgba(139,92,246,0.25)',
      padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0
    }}>
      <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '0.15em', fontFamily: "'Rajdhani', sans-serif" }}>AUCTION STATUS</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center',
        background: `${sc.color}22`, border: `1px solid ${sc.color}44`,
        borderRadius: 20, padding: '3px 12px',
        color: sc.color, fontSize: 11, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif",
        letterSpacing: '0.1em',
        boxShadow: sc.glow ? `0 0 16px ${sc.color}44` : 'none'
      }}>
        {sc.label}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {status === 'upcoming' && (
          <Btn onClick={() => setStatus('live')} variant="success" small>▶ Start Auction</Btn>
        )}
        {status === 'live' && (
          <>
            <Btn onClick={() => setStatus('paused')} variant="secondary" small>⏸ Pause</Btn>
            <Btn onClick={() => setStatus('completed')} variant="ghost" small>■ End Auction</Btn>
          </>
        )}
        {status === 'paused' && (
          <>
            <Btn onClick={() => setStatus('live')} variant="success" small>▶ Resume</Btn>
            <Btn onClick={() => setStatus('completed')} variant="ghost" small>■ End Auction</Btn>
          </>
        )}
        {status === 'completed' && (
          <Btn onClick={() => setStatus('upcoming')} variant="secondary" small>↺ Reset Status</Btn>
        )}
      </div>
      <div style={{ marginLeft: 'auto' }}>
        <Btn onClick={fullReset} variant="danger" small style={{ borderColor: 'rgba(239,68,68,0.6)', background: 'rgba(239,68,68,0.25)' }}>
          ⚠ Full Reset
        </Btn>
      </div>
    </div>
  )
}

// ─── SetupView ───────────────────────────────────────────────────────────────

function SetupView({ state, setState }) {
  const [teamNameA, setTeamNameA] = useState(state.teamA.teamName || 'Team A')
  const [captainA, setCaptainA]   = useState(state.teamA.captain || 'Captain A')
  const [purseA, setPurseA]       = useState(state.teamA.purse)
  const [teamNameB, setTeamNameB] = useState(state.teamB.teamName || 'Team B')
  const [captainB, setCaptainB]   = useState(state.teamB.captain || 'Captain B')
  const [purseB, setPurseB]       = useState(state.teamB.purse)

  async function save() {
    await setState(s => ({
      ...s,
      teamA: { ...s.teamA, teamName: teamNameA || 'Team A', captain: captainA, purse: parseFloat(purseA) || 100 },
      teamB: { ...s.teamB, teamName: teamNameB || 'Team B', captain: captainB, purse: parseFloat(purseB) || 100 },
      setupDone: true,
      view: 'pool'
    }))
  }

  const teamCardStyle = (color) => ({
    background: `linear-gradient(135deg, ${color}18, ${color}08)`,
    border: `1px solid ${color}44`,
    borderRadius: 12, padding: 20,
  })

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', color: '#8B5CF6', marginBottom: 8, fontFamily: "'Rajdhani', sans-serif" }}>WELCOME TO</div>
        <h1 style={{ fontSize: 52, fontWeight: 900, color: '#fff', margin: 0, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em', textShadow: '0 0 40px rgba(139,92,246,0.4)' }}>
          AUCTION <span style={{ color: '#8B5CF6' }}>NEXUS</span>
        </h1>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>IPL-Style Fantasy Cricket Auction System</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={teamCardStyle('#3B82F6')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 10px #3B82F6' }} />
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 14, color: '#93C5FD', letterSpacing: '0.1em' }}>TEAM A</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 5, letterSpacing: '0.08em' }}>TEAM NAME</div>
            <Input value={teamNameA} onChange={e => setTeamNameA(e.target.value)} placeholder="e.g. Mumbai Indians" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 5, letterSpacing: '0.08em' }}>CAPTAIN NAME</div>
            <Input value={captainA} onChange={e => setCaptainA(e.target.value)} placeholder="e.g. Rohit Sharma" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 5, letterSpacing: '0.08em' }}>PURSE (CR)</div>
            <Input type="number" value={purseA} onChange={e => setPurseA(e.target.value)} placeholder="100" />
          </div>
        </div>

        <div style={teamCardStyle('#EC4899')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EC4899', boxShadow: '0 0 10px #EC4899' }} />
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 14, color: '#F9A8D4', letterSpacing: '0.1em' }}>TEAM B</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 5, letterSpacing: '0.08em' }}>TEAM NAME</div>
            <Input value={teamNameB} onChange={e => setTeamNameB(e.target.value)} placeholder="e.g. Chennai Super Kings" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 5, letterSpacing: '0.08em' }}>CAPTAIN NAME</div>
            <Input value={captainB} onChange={e => setCaptainB(e.target.value)} placeholder="e.g. MS Dhoni" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 5, letterSpacing: '0.08em' }}>PURSE (CR)</div>
            <Input type="number" value={purseB} onChange={e => setPurseB(e.target.value)} placeholder="100" />
          </div>
        </div>
      </div>

      <GlassCard style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Fill in team details above, then continue to add players.</div>
          <Btn onClick={save} variant="primary">Continue to Player Pool →</Btn>
        </div>
      </GlassCard>
    </div>
  )
}

// ─── PlayerPoolView ──────────────────────────────────────────────────────────

function PlayerPoolView({ state, setState }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'Batter', basePrice: 1, image: '' })
  const imageInputRef = useRef(null)

  const filtered = state.playerPool.filter(p =>
    (roleFilter === 'All' || p.role === roleFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()))
  )

  function openAdd() {
    setForm({ name: '', role: 'Batter', basePrice: 1, image: '' })
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(p) {
    setForm({ name: p.name, role: p.role, basePrice: p.basePrice, image: p.image || '' })
    setEditing(p.id)
    setShowForm(true)
  }

  function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, image: ev.target.result }))
    reader.readAsDataURL(file)
  }

  async function savePlayer() {
    if (!form.name.trim()) return
    if (editing) {
      await setState(s => ({ ...s, playerPool: s.playerPool.map(p => p.id === editing ? { ...p, ...form, basePrice: parseFloat(form.basePrice) } : p) }))
    } else {
      await setState(s => ({ ...s, playerPool: [...s.playerPool, { id: genId(), ...form, basePrice: parseFloat(form.basePrice) || 1, status: 'available' }] }))
    }
    setShowForm(false)
  }

  async function deletePlayer(id) {
    await setState(s => ({ ...s, playerPool: s.playerPool.filter(p => p.id !== id) }))
  }

  async function importPool() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = e => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const data = JSON.parse(ev.target.result)
          if (Array.isArray(data)) {
            await setState(s => ({ ...s, playerPool: data.map(p => ({ ...p, id: p.id || genId(), status: p.status || 'available' })) }))
          }
        } catch {}
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const byRole = ROLES.reduce((acc, r) => {
    acc[r] = state.playerPool.filter(p => p.role === r).length
    return acc
  }, {})

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontFamily: "'Rajdhani', sans-serif", fontWeight: 800 }}>Player Pool</h2>
          <div style={{ fontSize: 12, color: '#6B7280' }}>{state.playerPool.length} players total</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={importPool} variant="ghost" small>Import JSON</Btn>
          <Btn onClick={openAdd} variant="primary" small>+ Add Player</Btn>
          {state.playerPool.length > 0 && (
            <Btn onClick={() => setState(s => ({ ...s, view: 'auction' }))} variant="success" small>Start Auction →</Btn>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players..." style={{ width: 200 }} />
        {['All', ...ROLES].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)} style={{
            background: roleFilter === r ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${roleFilter === r ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.15)'}`,
            color: roleFilter === r ? '#C4B5FD' : '#9CA3AF', borderRadius: 6,
            padding: '5px 12px', cursor: 'pointer', fontSize: 12,
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 600
          }}>
            {r} {r !== 'All' ? `(${byRole[r] || 0})` : `(${state.playerPool.length})`}
          </button>
        ))}
      </div>

      {showForm && (
        <GlassCard style={{ padding: 20, marginBottom: 16 }}>
          <SectionTitle>{editing ? 'Edit Player' : 'Add Player'}</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 10, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Name</div>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Player name" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Role</div>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.25)',
                borderRadius: 6, color: '#E5E7EB', padding: '7px 11px', fontSize: 13, width: '100%',
                fontFamily: "'Rajdhani', sans-serif"
              }}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Base Price (Cr)</div>
              <Input type="number" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>Player Photo (optional)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {form.image ? (
                <img src={form.image} alt="preview" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(139,92,246,0.4)' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, background: 'rgba(139,92,246,0.1)', border: '1px dashed rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                <Btn onClick={() => imageInputRef.current?.click()} variant="secondary" small>Upload Photo</Btn>
                {form.image && <Btn onClick={() => setForm(f => ({ ...f, image: '' }))} variant="danger" small>Remove</Btn>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Btn onClick={savePlayer} variant="primary" small>Save</Btn>
            <Btn onClick={() => setShowForm(false)} variant="ghost" small>Cancel</Btn>
          </div>
        </GlassCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 10 }}>
        {filtered.map(p => (
          <GlassCard key={p.id} style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <PlayerAvatar player={p} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#E5E7EB', fontWeight: 700, fontSize: 14, fontFamily: "'Rajdhani', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                <RoleBadge role={p.role} small />
                <span style={{ fontSize: 11, color: '#8B5CF6' }}>{formatCr(p.basePrice)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Btn onClick={() => openEdit(p)} variant="ghost" small>✏️</Btn>
              <Btn onClick={() => deletePlayer(p.id)} variant="danger" small>✕</Btn>
            </div>
          </GlassCard>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6B7280', padding: 40, fontSize: 14 }}>
            {state.playerPool.length === 0 ? 'No players yet. Add players to start.' : 'No players match your search.'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SquadList ───────────────────────────────────────────────────────────────

function SquadList({ players, playerPool }) {
  if (!players.length) return <div style={{ color: '#4B5563', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>No players yet</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {players.map(pid => {
        const p = playerPool.find(x => x.id === pid)
        if (!p) return null
        return (
          <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
            <PlayerAvatar player={p} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#D1D5DB', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Rajdhani', sans-serif" }}>{p.name}</div>
            </div>
            <RoleBadge role={p.role} small />
            <div style={{ fontSize: 10, color: '#8B5CF6', whiteSpace: 'nowrap' }}>{formatCr(p.soldPrice || p.basePrice)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── DraftBoardView ──────────────────────────────────────────────────────────

function DraftBoardView({ state, selectPlayer, setActiveTab }) {
  const [search, setSearch] = useState('')

  const grouped = ROLES.reduce((acc, role) => {
    acc[role] = state.playerPool.filter(p =>
      p.role === role && p.name.toLowerCase().includes(search.toLowerCase())
    )
    return acc
  }, {})

  const statusStyle = {
    available: { border: 'rgba(139,92,246,0.3)', glow: '' },
    sold: { border: 'rgba(34,197,94,0.4)', glow: 'rgba(34,197,94,0.08)' },
    unsold: { border: 'rgba(107,114,128,0.3)', glow: '' },
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 24px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 20 }}>Draft Board</h2>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: 200 }} />
        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 11 }}>
          {[{ color: '#8B5CF6', label: 'Available' }, { color: '#4ADE80', label: 'Sold' }, { color: '#6B7280', label: 'Unsold' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
              <span style={{ color: '#9CA3AF' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      {ROLES.map(role => (
        <div key={role} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLORS[role], letterSpacing: '0.15em', fontFamily: "'Rajdhani', sans-serif" }}>{role.toUpperCase()}S</div>
            <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, ${ROLE_COLORS[role]}44, transparent)` }} />
            <div style={{ fontSize: 11, color: '#6B7280' }}>{grouped[role]?.length || 0}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 8 }}>
            {grouped[role]?.map(p => {
              const st = statusStyle[p.status] || statusStyle.available
              const soldTeam = p.soldTo
              return (
                <div key={p.id} onClick={() => { if (p.status !== 'sold') { selectPlayer(p.id); setActiveTab('auction') } }} style={{
                  background: p.status === 'sold' ? 'rgba(34,197,94,0.05)' : 'rgba(18,9,31,0.7)',
                  border: `1px solid ${st.border}`,
                  borderRadius: 8, padding: 12, cursor: p.status === 'sold' ? 'default' : 'pointer',
                  opacity: p.status === 'unsold' ? 0.5 : 1,
                  transition: 'all 0.15s', position: 'relative', overflow: 'hidden'
                }}>
                  {p.status === 'sold' && <div style={{ position: 'absolute', top: 0, right: 0, background: '#4ADE80', color: '#000', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: '0 0 0 6px' }}>SOLD</div>}
                  {p.status === 'unsold' && <div style={{ position: 'absolute', top: 0, right: 0, background: '#6B7280', color: '#000', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: '0 0 0 6px' }}>UNSOLD</div>}
                  {p.id === state.activePlayerId && <div style={{ position: 'absolute', top: 0, right: 0, background: '#8B5CF6', color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: '0 0 0 6px' }}>LIVE</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PlayerAvatar player={p} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#E5E7EB', fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#8B5CF6' }}>{formatCr(p.soldPrice || p.basePrice)}</div>
                    </div>
                  </div>
                  {p.status === 'sold' && (
                    <div style={{ marginTop: 6, fontSize: 10, color: '#4ADE80' }}>
                      → {soldTeam === 'A' ? (state.teamA.teamName || state.teamA.captain) : (state.teamB.teamName || state.teamB.captain)}
                    </div>
                  )}
                </div>
              )
            })}
            {(!grouped[role] || grouped[role].length === 0) && (
              <div style={{ color: '#4B5563', fontSize: 12, padding: '8px 0' }}>No players</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── TradeView ───────────────────────────────────────────────────────────────

function TradeView({ state, setState, tradeTeamA, setTradeTeamA, tradeTeamB, setTradeTeamB, tradeCash, setTradeCash, tradeCashDir, setTradeCashDir, confirmTrade, tradeTab, setTradeTab, notify }) {
  function toggleTradePlayer(team, pid) {
    if (team === 'A') {
      setTradeTeamA(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid])
    } else {
      setTradeTeamB(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid])
    }
  }

  function getPlayerObj(id) {
    return state.playerPool.find(p => p.id === id)
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 24px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['new', 'history'].map(t => (
          <button key={t} onClick={() => setTradeTab(t)} style={{
            background: tradeTab === t ? 'rgba(139,92,246,0.25)' : 'transparent',
            border: `1px solid ${tradeTab === t ? 'rgba(139,92,246,0.5)' : 'transparent'}`,
            color: tradeTab === t ? '#C4B5FD' : '#6B7280',
            borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 12,
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 700
          }}>{t === 'new' ? 'New Trade' : 'Trade History'}</button>
        ))}
      </div>

      {tradeTab === 'new' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 20, marginBottom: 20 }}>
            <GlassCard style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6' }} />
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, color: '#93C5FD', fontSize: 14 }}>{state.teamA.teamName || state.teamA.captain}</div>
                <div style={{ fontSize: 10, color: '#6B7280' }}>gives away</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {state.teamA.players.map(pid => {
                  const p = getPlayerObj(pid)
                  if (!p) return null
                  const selected = tradeTeamA.includes(pid)
                  return (
                    <div key={pid} onClick={() => toggleTradePlayer('A', pid)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                      background: selected ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selected ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 6, cursor: 'pointer'
                    }}>
                      <PlayerAvatar player={p} size={28} />
                      <div>
                        <div style={{ fontSize: 12, color: '#D1D5DB', fontWeight: 600, fontFamily: "'Rajdhani', sans-serif" }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: '#8B5CF6' }}>{formatCr(p.soldPrice || p.basePrice)}</div>
                      </div>
                      {selected && <div style={{ marginLeft: 'auto', color: '#3B82F6', fontSize: 14 }}>✓</div>}
                    </div>
                  )
                })}
                {state.teamA.players.length === 0 && <div style={{ color: '#4B5563', fontSize: 12 }}>No players</div>}
              </div>
            </GlassCard>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontSize: 24, color: '#8B5CF6' }}>⇄</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>CASH ADJUSTMENT</div>
                <Input type="number" value={tradeCash} onChange={e => setTradeCash(e.target.value)} placeholder="0" style={{ width: 80, textAlign: 'center' }} />
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4, marginBottom: 6 }}>Cr transfer direction:</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button onClick={() => setTradeCashDir('AtoB')} style={{ background: tradeCashDir === 'AtoB' ? 'rgba(59,130,246,0.3)' : 'transparent', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4, color: '#93C5FD', cursor: 'pointer', padding: '2px 6px', fontSize: 10 }}>A→B</button>
                  <button onClick={() => setTradeCashDir('BtoA')} style={{ background: tradeCashDir === 'BtoA' ? 'rgba(236,72,153,0.3)' : 'transparent', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 4, color: '#F9A8D4', cursor: 'pointer', padding: '2px 6px', fontSize: 10 }}>B→A</button>
                </div>
              </div>
            </div>

            <GlassCard style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EC4899' }} />
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, color: '#F9A8D4', fontSize: 14 }}>{state.teamB.teamName || state.teamB.captain}</div>
                <div style={{ fontSize: 10, color: '#6B7280' }}>gives away</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {state.teamB.players.map(pid => {
                  const p = getPlayerObj(pid)
                  if (!p) return null
                  const selected = tradeTeamB.includes(pid)
                  return (
                    <div key={pid} onClick={() => toggleTradePlayer('B', pid)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                      background: selected ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selected ? 'rgba(236,72,153,0.5)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 6, cursor: 'pointer'
                    }}>
                      <PlayerAvatar player={p} size={28} />
                      <div>
                        <div style={{ fontSize: 12, color: '#D1D5DB', fontWeight: 600, fontFamily: "'Rajdhani', sans-serif" }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: '#8B5CF6' }}>{formatCr(p.soldPrice || p.basePrice)}</div>
                      </div>
                      {selected && <div style={{ marginLeft: 'auto', color: '#EC4899', fontSize: 14 }}>✓</div>}
                    </div>
                  )
                })}
                {state.teamB.players.length === 0 && <div style={{ color: '#4B5563', fontSize: 12 }}>No players</div>}
              </div>
            </GlassCard>
          </div>

          {(tradeTeamA.length > 0 || tradeTeamB.length > 0) && (
            <GlassCard style={{ padding: 16, marginBottom: 16, border: '1px solid rgba(139,92,246,0.4)' }}>
              <SectionTitle>Trade Preview</SectionTitle>
              <div style={{ fontSize: 13, color: '#E5E7EB', lineHeight: 1.7 }}>
                <span style={{ color: '#93C5FD', fontWeight: 700 }}>{state.teamA.teamName || state.teamA.captain}</span> gives:{' '}
                {tradeTeamA.length ? tradeTeamA.map(id => getPlayerObj(id)?.name).join(', ') : 'nothing'}
                {parseFloat(tradeCash) > 0 && tradeCashDir === 'AtoB' && ` + ${formatCr(tradeCash)}`}
              </div>
              <div style={{ fontSize: 13, color: '#E5E7EB', lineHeight: 1.7 }}>
                <span style={{ color: '#F9A8D4', fontWeight: 700 }}>{state.teamB.teamName || state.teamB.captain}</span> gives:{' '}
                {tradeTeamB.length ? tradeTeamB.map(id => getPlayerObj(id)?.name).join(', ') : 'nothing'}
                {parseFloat(tradeCash) > 0 && tradeCashDir === 'BtoA' && ` + ${formatCr(tradeCash)}`}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Btn onClick={confirmTrade} variant="success">Confirm Trade ✓</Btn>
                <Btn onClick={() => { setTradeTeamA([]); setTradeTeamB([]); setTradeCash(0) }} variant="ghost">Cancel</Btn>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {tradeTab === 'history' && (
        <div>
          {state.trades.length === 0 && <div style={{ color: '#4B5563', fontSize: 14, textAlign: 'center', padding: 40 }}>No trades yet</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {state.trades.map(t => (
              <GlassCard key={t.id} style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{new Date(t.ts).toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: '#E5E7EB' }}>
                      <span style={{ color: '#93C5FD', fontWeight: 700 }}>{state.teamA.teamName || state.teamA.captain}</span> gave: {t.teamAPlayers?.join(', ') || 'nothing'}
                      {t.cashAmount > 0 && t.cashDir === 'AtoB' && ` + ${formatCr(t.cashAmount)}`}
                    </div>
                    <div style={{ fontSize: 13, color: '#E5E7EB' }}>
                      <span style={{ color: '#F9A8D4', fontWeight: 700 }}>{state.teamB.teamName || state.teamB.captain}</span> gave: {t.teamBPlayers?.join(', ') || 'nothing'}
                      {t.cashAmount > 0 && t.cashDir === 'BtoA' && ` + ${formatCr(t.cashAmount)}`}
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AuctionMainView ─────────────────────────────────────────────────────────

function AuctionMainView({ state, setState, activePlayer, bid, undoBid, sellPlayer, markUnsold, undoLastSale, nextPlayer, resetCurrentAuction, selectPlayer, customBid, setCustomBid, customBidFn, bidIncrement, setBidIncrement, editPurse, movePlayer, available, sold, unsold, totalA, totalB }) {
  const [editingPurse, setEditingPurse] = useState(null)
  const [purseVal, setPurseVal] = useState('')
  const [editingTeam, setEditingTeam] = useState(null)
  const [teamNameVal, setTeamNameVal] = useState('')

  function startEditPurse(team) {
    setEditingPurse(team)
    setPurseVal(team === 'A' ? state.teamA.purse : state.teamB.purse)
  }
  async function savePurse() {
    editPurse(editingPurse, purseVal)
    setEditingPurse(null)
  }
  function startEditTeam(team) {
    setEditingTeam(team)
    setTeamNameVal(team === 'A' ? (state.teamA.teamName || state.teamA.captain) : (state.teamB.teamName || state.teamB.captain))
  }
  async function saveTeamName() {
    const key = editingTeam === 'A' ? 'teamA' : 'teamB'
    await setState(s => ({ ...s, [key]: { ...s[key], teamName: teamNameVal || s[key].teamName } }))
    setEditingTeam(null)
  }

  const bidderColor = state.currentBidder === 'A' ? '#3B82F6' : state.currentBidder === 'B' ? '#EC4899' : '#8B5CF6'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 260px', gridTemplateRows: '1fr auto', height: '100%', gap: 0 }}>
      {/* Left Panel - Team A */}
      <div style={{ background: 'rgba(8,0,20,0.7)', borderRight: '1px solid rgba(139,92,246,0.15)', padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(29,78,216,0.2),rgba(59,130,246,0.08))', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 8px #3B82F6' }} />
            {editingTeam === 'A' ? (
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                <input value={teamNameVal} onChange={e => setTeamNameVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTeamName(); if (e.key === 'Escape') setEditingTeam(null) }} autoFocus style={{ flex: 1, background: 'transparent', border: '1px solid #3B82F6', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 14, fontFamily: "'Rajdhani', sans-serif", fontWeight: 800 }} />
                <button onClick={saveTeamName} style={{ background: '#3B82F6', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 8px', fontSize: 12 }}>✓</button>
              </div>
            ) : (
              <div onClick={() => startEditTeam('A')} title="Click to rename" style={{ flex: 1, cursor: 'pointer' }}>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 15, color: '#93C5FD', lineHeight: 1 }}>{state.teamA.teamName || state.teamA.captain} ✎</div>
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>Capt: {state.teamA.captain}</div>
              </div>
            )}
            <div style={{ fontSize: 10, color: '#6B7280', marginLeft: 2 }}>TEAM A</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>PURSE</div>
              {editingPurse === 'A' ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input value={purseVal} onChange={e => setPurseVal(e.target.value)} style={{ width: 60, background: 'transparent', border: '1px solid #3B82F6', borderRadius: 4, color: '#fff', padding: '2px 4px', fontSize: 13 }} autoFocus />
                  <button onClick={savePurse} style={{ background: '#3B82F6', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>✓</button>
                </div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif" }} onClick={() => startEditPurse('A')}>{formatCr(state.teamA.purse)}</div>
              )}
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>SPENT</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#93C5FD', fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(totalA)}</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#4B7BA6', marginBottom: 6 }}>{state.teamA.players.length} PLAYERS ACQUIRED</div>
        </div>
        <div style={{ flex: 1 }}>
          <SectionTitle>Squad</SectionTitle>
          <SquadList players={state.teamA.players} playerPool={state.playerPool} />
        </div>
      </div>

      {/* Center Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {/* Active Player */}
          <GlassCard style={{ padding: 0, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: activePlayer ? 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.22), transparent 65%)' : 'none', pointerEvents: 'none' }} />
            {activePlayer ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 24px 18px' }}>
                {activePlayer.image ? (
                  <div style={{ width: 200, height: 200, borderRadius: 16, overflow: 'hidden', border: '3px solid rgba(139,92,246,0.6)', background: '#12091F', boxShadow: '0 0 50px rgba(139,92,246,0.35), 0 0 120px rgba(139,92,246,0.12)', marginBottom: 16, flexShrink: 0 }}>
                    <img src={activePlayer.image} alt={activePlayer.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ marginBottom: 16 }}><PlayerAvatar player={activePlayer} size={180} /></div>
                )}
                <div style={{ fontSize: 9, letterSpacing: '0.25em', color: '#8B5CF6', marginBottom: 4, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>NOW AUCTIONING</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', fontFamily: "'Rajdhani', sans-serif", lineHeight: 1, marginBottom: 8, textAlign: 'center' }}>{activePlayer.name}</div>
                <div style={{ marginBottom: 14 }}><RoleBadge role={activePlayer.role} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, width: '100%' }}>
                  <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: '10px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#6B7280', letterSpacing: '0.1em', marginBottom: 4 }}>BASE PRICE</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#A78BFA', fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(activePlayer.basePrice)}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: '10px 0', textAlign: 'center', border: `1px solid ${bidderColor}44` }}>
                    <div style={{ fontSize: 9, color: '#6B7280', letterSpacing: '0.1em', marginBottom: 4 }}>CURRENT BID</div>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Rajdhani', sans-serif", color: bidderColor, textShadow: `0 0 16px ${bidderColor}88` }}>{formatCr(state.currentBid)}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: '10px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#6B7280', letterSpacing: '0.1em', marginBottom: 4 }}>HIGHEST BIDDER</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: bidderColor, fontFamily: "'Rajdhani', sans-serif", padding: '0 4px' }}>
                      {state.currentBidder ? (state.currentBidder === 'A' ? (state.teamA.teamName || state.teamA.captain) : (state.teamB.teamName || state.teamB.captain)) : '—'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#4B5563' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🏏</div>
                <div style={{ fontSize: 15, fontFamily: "'Rajdhani', sans-serif" }}>Select a player to begin auction</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Click a player from the draft board or use quick pick below</div>
                <div style={{ marginTop: 12 }}><Btn onClick={nextPlayer} variant="primary" small>Quick Pick Next Player [N]</Btn></div>
              </div>
            )}
          </GlassCard>

          {/* Bid Controls */}
          <GlassCard style={{ padding: 18, marginBottom: 12 }}>
            <SectionTitle>Auction Controls</SectionTitle>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <Btn onClick={() => bid('A')} variant="teamA" disabled={!activePlayer} style={{ flex: 1, minWidth: 100 }}>
                {state.teamA.teamName || state.teamA.captain} [A]<br /><span style={{ fontSize: 11, opacity: 0.8 }}>{formatCr((state.currentBid || 0) + bidIncrement)}</span>
              </Btn>
              <Btn onClick={() => bid('B')} variant="teamB" disabled={!activePlayer} style={{ flex: 1, minWidth: 100 }}>
                {state.teamB.teamName || state.teamB.captain} [B]<br /><span style={{ fontSize: 11, opacity: 0.8 }}>{formatCr((state.currentBid || 0) + bidIncrement)}</span>
              </Btn>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>BID INCREMENT</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {BID_INCREMENTS.map(inc => (
                  <button key={inc} onClick={() => setBidIncrement(inc)} style={{
                    background: bidIncrement === inc ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${bidIncrement === inc ? 'rgba(139,92,246,0.7)' : 'rgba(139,92,246,0.2)'}`,
                    color: bidIncrement === inc ? '#C4B5FD' : '#9CA3AF',
                    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                    fontFamily: "'Rajdhani', sans-serif", fontWeight: 700
                  }}>+{inc}Cr</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <Input value={customBid} onChange={e => setCustomBid(e.target.value)} placeholder="Custom bid (Cr)" type="number" style={{ flex: 1 }} />
              <Btn onClick={() => customBidFn('A')} variant="accent" small>A</Btn>
              <Btn onClick={() => customBidFn('B')} variant="accent" small>B</Btn>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn onClick={sellPlayer} variant="success" disabled={!activePlayer || !state.currentBidder}>🔨 Sell [S]</Btn>
              <Btn onClick={markUnsold} variant="ghost" disabled={!activePlayer}>Unsold</Btn>
              <Btn onClick={undoBid} variant="secondary" disabled={!state.bidLog.length}>Undo Bid [U]</Btn>
              <Btn onClick={undoLastSale} variant="danger" disabled={!state.lastSale}>Undo Sale</Btn>
              <Btn onClick={nextPlayer} variant="accent">Next [N]</Btn>
              <Btn onClick={resetCurrentAuction} variant="ghost">Reset</Btn>
            </div>
          </GlassCard>

          {/* Bid Log */}
          {state.bidLog.length > 0 && (
            <GlassCard style={{ padding: 14, marginBottom: 12 }}>
              <SectionTitle>Bid Log</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflow: 'auto' }}>
                {[...state.bidLog].reverse().map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: b.team === 'A' ? '#93C5FD' : '#F9A8D4', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
                      {b.team === 'A' ? (state.teamA.teamName || state.teamA.captain) : (state.teamB.teamName || state.teamB.captain)}
                    </span>
                    <span style={{ color: '#8B5CF6', fontWeight: 700, fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(b.amount)}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { label: 'Available', val: available.length, color: '#8B5CF6' },
              { label: 'Sold', val: sold.length, color: '#4ADE80' },
              { label: 'Unsold', val: unsold.length, color: '#6B7280' },
            ].map(s => (
              <GlassCard key={s.label} style={{ padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Rajdhani', sans-serif" }}>{s.val}</div>
                <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '0.1em' }}>{s.label.toUpperCase()}</div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Bottom History Bar */}
        <div style={{ background: 'rgba(8,0,20,0.8)', borderTop: '1px solid rgba(139,92,246,0.15)', padding: '10px 20px', maxHeight: 160, overflow: 'auto' }}>
          <SectionTitle>Auction History</SectionTitle>
          {state.auctionHistory.length === 0 && <div style={{ color: '#4B5563', fontSize: 12 }}>No transactions yet</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {state.auctionHistory.slice(0, 20).map(h => (
              <div key={h.id} style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'center' }}>
                <span style={{ color: '#4B5563', fontSize: 10, minWidth: 50 }}>{new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ color: '#D1D5DB', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>{h.playerName}</span>
                {h.unsold ? (
                  <span style={{ color: '#6B7280', fontSize: 10 }}>UNSOLD</span>
                ) : (
                  <>
                    <span style={{ color: '#6B7280' }}>→</span>
                    <span style={{ color: h.team === 'A' ? '#93C5FD' : '#F9A8D4', fontWeight: 600 }}>{h.team === 'A' ? (state.teamA.teamName || state.teamA.captain) : (state.teamB.teamName || state.teamB.captain)}</span>
                    <span style={{ color: '#8B5CF6', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>{formatCr(h.amount)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Team B */}
      <div style={{ background: 'rgba(8,0,20,0.7)', borderLeft: '1px solid rgba(139,92,246,0.15)', padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(190,24,93,0.2),rgba(236,72,153,0.08))', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EC4899', boxShadow: '0 0 8px #EC4899' }} />
            {editingTeam === 'B' ? (
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                <input value={teamNameVal} onChange={e => setTeamNameVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTeamName(); if (e.key === 'Escape') setEditingTeam(null) }} autoFocus style={{ flex: 1, background: 'transparent', border: '1px solid #EC4899', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 14, fontFamily: "'Rajdhani', sans-serif", fontWeight: 800 }} />
                <button onClick={saveTeamName} style={{ background: '#EC4899', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 8px', fontSize: 12 }}>✓</button>
              </div>
            ) : (
              <div onClick={() => startEditTeam('B')} title="Click to rename" style={{ flex: 1, cursor: 'pointer' }}>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 15, color: '#F9A8D4', lineHeight: 1 }}>{state.teamB.teamName || state.teamB.captain} ✎</div>
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>Capt: {state.teamB.captain}</div>
              </div>
            )}
            <div style={{ fontSize: 10, color: '#6B7280', marginLeft: 2 }}>TEAM B</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>PURSE</div>
              {editingPurse === 'B' ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input value={purseVal} onChange={e => setPurseVal(e.target.value)} style={{ width: 60, background: 'transparent', border: '1px solid #EC4899', borderRadius: 4, color: '#fff', padding: '2px 4px', fontSize: 13 }} autoFocus />
                  <button onClick={savePurse} style={{ background: '#EC4899', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>✓</button>
                </div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif" }} onClick={() => startEditPurse('B')}>{formatCr(state.teamB.purse)}</div>
              )}
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>SPENT</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F9A8D4', fontFamily: "'Rajdhani', sans-serif" }}>{formatCr(totalB)}</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#7A3A5A', marginBottom: 6 }}>{state.teamB.players.length} PLAYERS ACQUIRED</div>
        </div>
        <div style={{ flex: 1 }}>
          <SectionTitle>Squad</SectionTitle>
          <SquadList players={state.teamB.players} playerPool={state.playerPool} />
        </div>
      </div>
    </div>
  )
}

// ─── Main AuctionView (admin) ─────────────────────────────────────────────────

function AuctionView({ state, setState }) {
  const [bidIncrement, setBidIncrement] = useState(1)
  const [customBid, setCustomBid] = useState('')
  const [activeTab, setActiveTab] = useState('auction')
  const [notification, setNotification] = useState(null)
  const [tradeTab, setTradeTab] = useState('new')
  const [tradeTeamA, setTradeTeamA] = useState([])
  const [tradeTeamB, setTradeTeamB] = useState([])
  const [tradeCash, setTradeCash] = useState(0)
  const [tradeCashDir, setTradeCashDir] = useState('AtoB')
  const notifTimeout = useRef(null)

  const activePlayer = state.playerPool.find(p => p.id === state.activePlayerId)

  function notify(msg, type = 'info') {
    if (notifTimeout.current) clearTimeout(notifTimeout.current)
    setNotification({ msg, type })
    notifTimeout.current = setTimeout(() => setNotification(null), 2800)
  }

  async function selectPlayer(id) {
    const p = state.playerPool.find(x => x.id === id)
    if (!p || p.status === 'sold') return
    await setState(s => ({ ...s, activePlayerId: id, currentBid: p.basePrice, currentBidder: null, bidLog: [] }))
  }

  async function bid(team) {
    if (!activePlayer) return notify('No player selected', 'error')
    if (activePlayer.status === 'sold') return notify('Player already sold', 'error')
    const bidAmt = state.currentBid + bidIncrement
    const purse = team === 'A' ? state.teamA.purse : state.teamB.purse
    if (bidAmt > purse) return notify(`${team === 'A' ? state.teamA.captain : state.teamB.captain} cannot afford this bid!`, 'error')
    await setState(s => ({
      ...s,
      currentBid: bidAmt,
      currentBidder: team,
      bidLog: [...s.bidLog, { team, amount: bidAmt, ts: Date.now() }]
    }))
    notify(`Team ${team} bids ${formatCr(bidAmt)}`, team === 'A' ? 'teamA' : 'teamB')
  }

  async function customBidFn(team) {
    const amt = parseFloat(customBid)
    if (isNaN(amt) || amt <= 0) return notify('Invalid bid amount', 'error')
    if (!activePlayer) return notify('No player selected', 'error')
    const purse = team === 'A' ? state.teamA.purse : state.teamB.purse
    if (amt > purse) return notify(`Cannot afford ${formatCr(amt)}!`, 'error')
    if (amt < state.currentBid) return notify('Bid must be higher than current bid', 'error')
    await setState(s => ({
      ...s,
      currentBid: amt,
      currentBidder: team,
      bidLog: [...s.bidLog, { team, amount: amt, ts: Date.now() }]
    }))
    setCustomBid('')
    notify(`Team ${team} custom bids ${formatCr(amt)}`, team === 'A' ? 'teamA' : 'teamB')
  }

  async function undoBid() {
    if (!state.bidLog.length) return notify('Nothing to undo', 'error')
    const newLog = [...state.bidLog]
    newLog.pop()
    const prev = newLog[newLog.length - 1]
    await setState(s => ({
      ...s,
      bidLog: newLog,
      currentBid: prev ? prev.amount : activePlayer.basePrice,
      currentBidder: prev ? prev.team : null,
    }))
    notify('Last bid undone', 'info')
  }

  async function sellPlayer() {
    if (!activePlayer) return notify('No player selected', 'error')
    if (!state.currentBidder) return notify('No bidder set', 'error')
    const team = state.currentBidder
    const purseKey = team === 'A' ? 'teamA' : 'teamB'
    const teamObj = state[purseKey]
    if (state.currentBid > teamObj.purse) return notify('Insufficient purse!', 'error')

    const saleRecord = {
      id: genId(),
      playerId: activePlayer.id,
      playerName: activePlayer.name,
      team,
      amount: state.currentBid,
      ts: Date.now(),
    }

    await setState(s => ({
      ...s,
      playerPool: s.playerPool.map(p => p.id === activePlayer.id ? { ...p, status: 'sold', soldTo: team, soldPrice: s.currentBid } : p),
      [purseKey]: { ...teamObj, purse: teamObj.purse - s.currentBid, players: [...teamObj.players, activePlayer.id] },
      auctionHistory: [saleRecord, ...s.auctionHistory],
      lastSale: saleRecord,
      activePlayerId: null,
      currentBid: 0,
      currentBidder: null,
      bidLog: [],
    }))
    notify(`${activePlayer.name} SOLD to Team ${team} for ${formatCr(state.currentBid)}! 🔨`, 'success')
  }

  async function markUnsold() {
    if (!activePlayer) return notify('No player selected', 'error')
    await setState(s => ({
      ...s,
      playerPool: s.playerPool.map(p => p.id === activePlayer.id ? { ...p, status: 'unsold' } : p),
      auctionHistory: [{ id: genId(), playerId: activePlayer.id, playerName: activePlayer.name, team: null, amount: 0, ts: Date.now(), unsold: true }, ...s.auctionHistory],
      activePlayerId: null, currentBid: 0, currentBidder: null, bidLog: [],
    }))
    notify(`${activePlayer.name} marked unsold`, 'info')
  }

  async function undoLastSale() {
    if (!state.lastSale) return notify('No sale to undo', 'error')
    const { playerId, team, amount } = state.lastSale
    const purseKey = team === 'A' ? 'teamA' : 'teamB'
    await setState(s => ({
      ...s,
      playerPool: s.playerPool.map(p => p.id === playerId ? { ...p, status: 'available', soldTo: null, soldPrice: null } : p),
      [purseKey]: {
        ...s[purseKey],
        purse: s[purseKey].purse + amount,
        players: s[purseKey].players.filter(id => id !== playerId),
      },
      auctionHistory: s.auctionHistory.filter(x => x.id !== s.lastSale?.id),
      lastSale: null,
    }))
    notify('Last sale undone', 'info')
  }

  async function nextPlayer() {
    const available = state.playerPool.filter(p => p.status === 'available')
    if (!available.length) return notify('No more available players', 'info')
    const idx = Math.floor(Math.random() * available.length)
    await selectPlayer(available[idx].id)
  }

  async function resetCurrentAuction() {
    await setState(s => ({ ...s, activePlayerId: null, currentBid: 0, currentBidder: null, bidLog: [] }))
  }

  function editPurse(team, val) {
    const key = team === 'A' ? 'teamA' : 'teamB'
    setState(s => ({ ...s, [key]: { ...s[key], purse: parseFloat(val) || 0 } }))
  }

  function movePlayer(playerId, fromTeam, toTeam) {
    const fromKey = fromTeam === 'A' ? 'teamA' : 'teamB'
    const toKey = toTeam === 'A' ? 'teamA' : 'teamB'
    setState(s => ({
      ...s,
      [fromKey]: { ...s[fromKey], players: s[fromKey].players.filter(id => id !== playerId) },
      [toKey]: { ...s[toKey], players: [...s[toKey].players, playerId] },
    }))
  }

  async function confirmTrade() {
    if (!tradeTeamA.length && !tradeTeamB.length) return notify('Select players to trade', 'error')
    const cashAmt = parseFloat(tradeCash) || 0

    let newTeamA = { ...state.teamA, players: [...state.teamA.players] }
    let newTeamB = { ...state.teamB, players: [...state.teamB.players] }

    tradeTeamA.forEach(pid => {
      newTeamA.players = newTeamA.players.filter(id => id !== pid)
      newTeamB.players = [...newTeamB.players, pid]
    })
    tradeTeamB.forEach(pid => {
      newTeamB.players = newTeamB.players.filter(id => id !== pid)
      newTeamA.players = [...newTeamA.players, pid]
    })

    if (cashAmt > 0) {
      if (tradeCashDir === 'AtoB') { newTeamA.purse -= cashAmt; newTeamB.purse += cashAmt }
      else { newTeamB.purse -= cashAmt; newTeamA.purse += cashAmt }
    }

    const tradeRecord = {
      id: genId(), ts: Date.now(),
      teamAPlayers: tradeTeamA.map(id => state.playerPool.find(p => p.id === id)?.name),
      teamBPlayers: tradeTeamB.map(id => state.playerPool.find(p => p.id === id)?.name),
      cashAmount: cashAmt, cashDir: tradeCashDir,
    }

    await setState(s => ({
      ...s,
      teamA: newTeamA, teamB: newTeamB,
      trades: [tradeRecord, ...s.trades],
    }))

    setTradeTeamA([]); setTradeTeamB([]); setTradeCash(0)
    notify('Trade completed! ✅', 'success')
  }

  async function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'auction-nexus-backup.json'
    a.click(); URL.revokeObjectURL(url)
  }

  async function importData() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const data = JSON.parse(ev.target.result)
          await setState(s => ({ ...s, ...data }))
          notify('Data imported!', 'success')
        } catch { notify('Invalid file', 'error') }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  async function newMatch() {
    if (!window.confirm('Start a new match? This will reset squads and purses but keep the player pool.')) return
    await setState(s => ({
      ...s,
      teamA: { ...s.teamA, purse: 100, players: [] },
      teamB: { ...s.teamB, purse: 100, players: [] },
      playerPool: s.playerPool.map(p => ({ ...p, status: 'available', soldTo: null, soldPrice: null })),
      activePlayerId: null, currentBid: 0, currentBidder: null,
      auctionHistory: [], bidLog: [], trades: [], lastSale: null,
    }))
    notify('New match started! 🏏', 'success')
  }

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.key === 'a' || e.key === 'A') bid('A')
      if (e.key === 'b' || e.key === 'B') bid('B')
      if (e.key === 's' || e.key === 'S') sellPlayer()
      if (e.key === 'u' || e.key === 'U') undoBid()
      if (e.key === 'n' || e.key === 'N') nextPlayer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const available = state.playerPool.filter(p => p.status === 'available')
  const sold = state.playerPool.filter(p => p.status === 'sold')
  const unsold = state.playerPool.filter(p => p.status === 'unsold')
  const totalA = state.teamA.players.reduce((acc, id) => { const p = state.playerPool.find(x => x.id === id); return acc + (p?.soldPrice || 0) }, 0)
  const totalB = state.teamB.players.reduce((acc, id) => { const p = state.playerPool.find(x => x.id === id); return acc + (p?.soldPrice || 0) }, 0)

  return (
    <div style={{ height: 'calc(100vh - 88px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {notification && (
        <div style={{
          position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '10px 24px', borderRadius: 8, fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700, fontSize: 14, letterSpacing: '0.05em',
          background: notification.type === 'error' ? 'rgba(239,68,68,0.9)' :
            notification.type === 'success' ? 'rgba(34,197,94,0.9)' :
            notification.type === 'teamA' ? 'rgba(59,130,246,0.9)' :
            notification.type === 'teamB' ? 'rgba(236,72,153,0.9)' :
            'rgba(139,92,246,0.9)',
          color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease', pointerEvents: 'none'
        }}>
          {notification.msg}
        </div>
      )}

      {/* Top Bar */}
      <div style={{ background: 'rgba(8,0,16,0.95)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '0.05em' }}>
          AUCTION <span style={{ color: '#8B5CF6' }}>NEXUS</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
          {[{ key: 'auction', label: 'Auction' }, { key: 'board', label: 'Draft Board' }, { key: 'trade', label: 'Trade Center' }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              background: activeTab === t.key ? 'rgba(139,92,246,0.25)' : 'transparent',
              border: `1px solid ${activeTab === t.key ? 'rgba(139,92,246,0.5)' : 'transparent'}`,
              color: activeTab === t.key ? '#C4B5FD' : '#6B7280',
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12,
              fontFamily: "'Rajdhani', sans-serif", fontWeight: 700
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Btn onClick={() => setState(s => ({ ...s, view: 'pool' }))} variant="ghost" small>Edit Pool</Btn>
          <Btn onClick={exportData} variant="ghost" small>Export</Btn>
          <Btn onClick={importData} variant="ghost" small>Import</Btn>
          <Btn onClick={newMatch} variant="danger" small>New Match</Btn>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'auction' && (
          <AuctionMainView
            state={state} setState={setState}
            activePlayer={activePlayer}
            bid={bid} undoBid={undoBid} sellPlayer={sellPlayer} markUnsold={markUnsold}
            undoLastSale={undoLastSale} nextPlayer={nextPlayer} resetCurrentAuction={resetCurrentAuction}
            selectPlayer={selectPlayer} customBid={customBid} setCustomBid={setCustomBid}
            customBidFn={customBidFn} bidIncrement={bidIncrement} setBidIncrement={setBidIncrement}
            editPurse={editPurse} movePlayer={movePlayer}
            available={available} sold={sold} unsold={unsold}
            totalA={totalA} totalB={totalB}
          />
        )}
        {activeTab === 'board' && (
          <DraftBoardView state={state} selectPlayer={selectPlayer} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'trade' && (
          <TradeView
            state={state} setState={setState}
            tradeTeamA={tradeTeamA} setTradeTeamA={setTradeTeamA}
            tradeTeamB={tradeTeamB} setTradeTeamB={setTradeTeamB}
            tradeCash={tradeCash} setTradeCash={setTradeCash}
            tradeCashDir={tradeCashDir} setTradeCashDir={setTradeCashDir}
            confirmTrade={confirmTrade} tradeTab={tradeTab} setTradeTab={setTradeTab}
            notify={notify}
          />
        )}
      </div>
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function AdminAuctionNexus({ state, setState }) {
  const [notification, setNotification] = useState(null)
  const notifTimeout = useRef(null)

  function notify(msg, type = 'info') {
    if (notifTimeout.current) clearTimeout(notifTimeout.current)
    setNotification({ msg, type })
    notifTimeout.current = setTimeout(() => setNotification(null), 2800)
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 32px)', background: '#080010',
      color: '#E5E7EB', fontFamily: "'Rajdhani', sans-serif",
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
        input::placeholder { color: #4B5563 !important; }
        select option { background: #12091F; color: #E5E7EB; }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        button:hover:not(:disabled) { filter: brightness(1.15); }
        button:active:not(:disabled) { transform: scale(0.97); }
      `}</style>

      <AuctionStatusBar state={state} setState={setState} notify={notify} />

      {state.view === 'setup' && <SetupView state={state} setState={setState} />}
      {state.view === 'pool' && (
        <div>
          <div style={{ background: 'rgba(8,0,16,0.95)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: 20, color: '#fff' }}>
              AUCTION <span style={{ color: '#8B5CF6' }}>NEXUS</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Btn onClick={() => setState(s => ({ ...s, view: 'setup' }))} variant="ghost" small>← Setup</Btn>
              {state.setupDone && <Btn onClick={() => setState(s => ({ ...s, view: 'auction' }))} variant="success" small>Go to Auction →</Btn>}
            </div>
          </div>
          <PlayerPoolView state={state} setState={setState} />
        </div>
      )}
      {state.view === 'auction' && <AuctionView state={state} setState={setState} />}
    </div>
  )
}

