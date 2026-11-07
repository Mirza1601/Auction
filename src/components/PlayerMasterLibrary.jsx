import { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const ROLES = ['Batter', 'Bowler', 'All Rounder', 'Wicket Keeper']
const ROLE_COLORS = {
  Batter: '#38BDF8',
  Bowler: '#4ADE80',
  'All Rounder': '#F59E0B',
  'Wicket Keeper': '#F472B6',
}

const CATEGORIES = ['Platinum', 'Gold', 'Silver', 'General']

function formatCr(val) {
  return `₹${Number(val).toFixed(1)} Cr`
}

export default function PlayerMasterLibrary({ state, setState, notify }) {
  const [masterPlayers, setMasterPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [catFilter, setCatFilter] = useState('ALL')
  const [showArchived, setShowArchived] = useState(false)
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState('All Rounder')
  const [formCategory, setFormCategory] = useState('General')
  const [formBasePrice, setFormBasePrice] = useState('3.0')
  const [formPhotoUrl, setFormPhotoUrl] = useState('')
  const [formBattingStyle, setFormBattingStyle] = useState('')
  const [formBowlingStyle, setFormBowlingStyle] = useState('')
  const fileInputRef = useRef(null)

  // Fetch master players from Supabase
  const loadMasterPlayers = async () => {
    setLoading(true)
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('master_players')
          .select('*')
          .order('name')
        
        if (!error && data && data.length > 0) {
          setMasterPlayers(data)
          setLoading(false)
          return
        }
      }
    } catch (e) {
      console.warn('Could not load from DB directly, falling back:', e)
    }

    // Fallback: derive master list from current state.playerPool + local cache
    const pool = state.playerPool || []
    const derived = pool.map(p => ({
      id: p.masterPlayerId || `master_${p.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: p.name,
      photo_url: p.image,
      role: p.role || 'All Rounder',
      category: p.category || 'General',
      default_base_price: p.basePrice || p.price || 3.0,
      stats: {
        matches: p.matches || 0,
        runs: p.runs || 0,
        wickets: p.wickets || 0,
        strikeRate: p.strikeRate || 0,
        economy: p.economy || 0,
        battingStyle: p.battingStyle || '',
        bowlingStyle: p.bowlingStyle || ''
      },
      is_archived: false
    }))
    setMasterPlayers(derived)
    setLoading(false)
  }

  useEffect(() => {
    loadMasterPlayers()

    // Realtime subscription for master_players table
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('master_players_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_players' }, () => {
        loadMasterPlayers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Handle Photo Upload directly to Supabase Storage
  async function handleFileUpload(file) {
    if (!file) return
    setUploadingPhoto(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const sanitizedName = formName ? formName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'player'
      const fileName = `${sanitizedName}_${Date.now()}.${ext}`
      const remotePath = `players/${fileName}`

      const { data, error } = await supabase.storage
        .from('player-photos')
        .upload(remotePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) throw error

      const { data: pubData } = supabase.storage
        .from('player-photos')
        .getPublicUrl(remotePath)

      setFormPhotoUrl(pubData.publicUrl)
      notify('Photo uploaded to Supabase Storage! 📸', 'success')
    } catch (err) {
      console.error('Storage upload error:', err)
      // Fallback: base64 data url if storage fails
      const reader = new FileReader()
      reader.onload = (e) => {
        setFormPhotoUrl(e.target.result)
        notify('Photo saved locally (Storage offline)', 'info')
      }
      reader.readAsDataURL(file)
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Open Add modal
  function openAddModal() {
    setEditingPlayer(null)
    setFormName('')
    setFormRole('All Rounder')
    setFormCategory('General')
    setFormBasePrice('3.0')
    setFormPhotoUrl('')
    setFormBattingStyle('')
    setFormBowlingStyle('')
    setShowAddModal(true)
  }

  // Open Edit modal
  function openEditModal(player) {
    setEditingPlayer(player)
    setFormName(player.name)
    setFormRole(player.role)
    setFormCategory(player.category || 'General')
    setFormBasePrice(String(player.default_base_price || 3.0))
    setFormPhotoUrl(player.photo_url)
    setFormBattingStyle(player.stats?.battingStyle || '')
    setFormBowlingStyle(player.stats?.bowlingStyle || '')
    setShowAddModal(true)
  }

  // Save Player (Insert or Update)
  async function savePlayer(e) {
    e.preventDefault()
    if (!formName.trim()) return notify('Player name is required', 'error')

    const playerId = editingPlayer
      ? editingPlayer.id
      : `master_${formName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).slice(2, 6)}`

    const playerRecord = {
      id: playerId,
      name: formName.trim(),
      role: formRole,
      category: formCategory,
      default_base_price: parseFloat(formBasePrice) || 3.0,
      photo_url: formPhotoUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
      stats: {
        ...(editingPlayer?.stats || {}),
        battingStyle: formBattingStyle,
        bowlingStyle: formBowlingStyle
      },
      is_archived: editingPlayer ? editingPlayer.is_archived : false,
      updated_at: new Date().toISOString()
    }

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('master_players')
          .upsert(playerRecord)
        
        if (error) throw error
      }
      
      notify(editingPlayer ? 'Player updated in Master Library! ✏️' : 'New Player registered permanently! 🏏', 'success')
      setShowAddModal(false)
      loadMasterPlayers()

      // Also update active playerPool in auction if this player is currently in it
      setState(s => ({
        ...s,
        playerPool: s.playerPool.map(p => {
          if (p.masterPlayerId === playerId || p.name.toLowerCase() === formName.toLowerCase()) {
            return {
              ...p,
              name: playerRecord.name,
              role: playerRecord.role,
              category: playerRecord.category,
              basePrice: playerRecord.default_base_price,
              image: playerRecord.photo_url,
              stats: playerRecord.stats
            }
          }
          return p
        })
      }))
    } catch (err) {
      console.error('Error saving master player:', err)
      notify('Failed to save to database: ' + err.message, 'error')
    }
  }

  // Toggle Archive
  async function toggleArchive(player) {
    const updatedStatus = !player.is_archived
    try {
      if (isSupabaseConfigured) {
        await supabase
          .from('master_players')
          .update({ is_archived: updatedStatus })
          .eq('id', player.id)
      }
      notify(updatedStatus ? `${player.name} archived` : `${player.name} restored to active library`, 'info')
      loadMasterPlayers()
    } catch (e) {
      notify('Error updating status', 'error')
    }
  }

  // Add / Remove from Active Auction Pool
  function toggleAuctionParticipation(player) {
    const isAlreadyInAuction = state.playerPool.some(
      p => p.masterPlayerId === player.id || p.name.toLowerCase() === player.name.toLowerCase()
    )

    if (isAlreadyInAuction) {
      if (!window.confirm(`Remove ${player.name} from the current auction?\n\nNOTE: ${player.name}'s profile and photograph will remain permanently safe in the Master Library.`)) {
        return
      }
      setState(s => ({
        ...s,
        playerPool: s.playerPool.filter(
          p => p.masterPlayerId !== player.id && p.name.toLowerCase() !== player.name.toLowerCase()
        )
      }))
      notify(`${player.name} removed from current auction (Profile preserved in Library)`, 'info')
    } else {
      const newParticipant = {
        id: Math.random().toString(36).slice(2, 10),
        masterPlayerId: player.id,
        name: player.name,
        role: player.role,
        category: player.category || 'General',
        basePrice: player.default_base_price || 3.0,
        price: player.default_base_price || 3.0,
        image: player.photo_url,
        status: 'available',
        soldTo: null,
        soldPrice: null,
        stats: player.stats || {}
      }

      setState(s => ({
        ...s,
        playerPool: [...s.playerPool, newParticipant]
      }))
      notify(`${player.name} added to current auction! 🏏`, 'success')
    }
  }

  // Filter players
  const filteredPlayers = masterPlayers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.role.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'ALL' || p.role === roleFilter
    const matchesCat = catFilter === 'ALL' || p.category === catFilter
    const matchesArchive = showArchived ? p.is_archived : !p.is_archived
    return matchesSearch && matchesRole && matchesCat && matchesArchive
  })

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, flexWrap: 'wrap', gap: 16
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.25em', color: '#8B5CF6', fontWeight: 800, marginBottom: 4 }}>
            PERMANENT CENTRALIZED REPOSITORY
          </div>
          <h1 style={{
            margin: 0, fontSize: 32, fontWeight: 900, color: '#fff',
            fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em'
          }}>
            PLAYER <span style={{ color: '#8B5CF6' }}>MASTER LIBRARY</span>
          </h1>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
            Every player and high-resolution photograph registered here is permanently saved in Supabase and reusable across unlimited auctions.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: showArchived ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showArchived ? 'rgba(239,68,68,0.4)' : 'rgba(139,92,246,0.25)'}`,
              color: showArchived ? '#F87171' : '#9CA3AF',
              borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif"
            }}
          >
            {showArchived ? '← Active Players' : '📦 Archived Players'}
          </button>

          <button
            onClick={openAddModal}
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
              color: '#fff', border: 'none', borderRadius: 6, padding: '9px 18px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.06em',
              boxShadow: '0 0 20px rgba(139,92,246,0.4)'
            }}
          >
            + ADD MASTER PLAYER
          </button>
        </div>
      </div>

      {/* Filter and Stats Toolbar */}
      <div style={{
        background: 'rgba(18,9,31,0.85)', border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 12, padding: '16px 20px', marginBottom: 24,
        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center'
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search master players by name or role..."
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6,
              color: '#fff', padding: '8px 14px', fontSize: 13,
              fontFamily: "'Rajdhani', sans-serif", outline: 'none'
            }}
          />
        </div>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{
            background: 'rgba(18,9,31,0.9)', border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 6, color: '#E5E7EB', padding: '8px 12px', fontSize: 12,
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, outline: 'none'
          }}
        >
          <option value="ALL">All Roles ({masterPlayers.length})</option>
          {ROLES.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{
            background: 'rgba(18,9,31,0.9)', border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 6, color: '#E5E7EB', padding: '8px 12px', fontSize: 12,
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, outline: 'none'
          }}
        >
          <option value="ALL">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 12, color: '#9CA3AF' }}>
          <div>Total Registered: <strong style={{ color: '#fff' }}>{masterPlayers.length}</strong></div>
          <div>In Current Auction: <strong style={{ color: '#8B5CF6' }}>{state.playerPool?.length || 0}</strong></div>
        </div>
      </div>

      {/* Players Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#8B5CF6', fontSize: 18 }}>
          Loading Master Library from Supabase...
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏏</div>
          <div style={{ fontSize: 16 }}>No players found matching current filters</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16
        }}>
          {filteredPlayers.map(p => {
            const inAuction = state.playerPool.some(
              poolP => poolP.masterPlayerId === p.id || poolP.name.toLowerCase() === p.name.toLowerCase()
            )
            const roleColor = ROLE_COLORS[p.role] || '#8B5CF6'

            return (
              <div
                key={p.id}
                style={{
                  background: 'rgba(18,9,31,0.85)',
                  border: `1px solid ${inAuction ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 12, padding: 16, position: 'relative',
                  display: 'flex', flexDirection: 'column', gap: 12,
                  boxShadow: inAuction ? '0 0 20px rgba(139,92,246,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Top Row: Photo + Identity */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{
                    width: 68, height: 68, borderRadius: 10, overflow: 'hidden',
                    border: `2px solid ${roleColor}55`, flexShrink: 0,
                    background: '#0d0417', position: 'relative'
                  }}>
                    {p.photo_url ? (
                      <img
                        src={p.photo_url}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 800, color: '#fff'
                      }}>
                        {p.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 18, fontWeight: 800, color: '#fff',
                      fontFamily: "'Rajdhani', sans-serif",
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {p.name}
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <span style={{
                        background: `${roleColor}22`, border: `1px solid ${roleColor}55`,
                        color: roleColor, borderRadius: 4, padding: '1px 6px',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em'
                      }}>
                        {p.role.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {p.category || 'General'}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', marginTop: 4 }}>
                      Base: {formatCr(p.default_base_price || 3.0)}
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div style={{
                  padding: '6px 10px', borderRadius: 6, fontSize: 11,
                  background: inAuction ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${inAuction ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.05)'}`,
                  color: inAuction ? '#4ADE80' : '#6B7280',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span>{inAuction ? '✓ In Current Auction Roster' : '○ Not in Active Auction'}</span>
                  {p.is_archived && <span style={{ color: '#F87171', fontWeight: 700 }}>ARCHIVED</span>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 6 }}>
                  <button
                    onClick={() => toggleAuctionParticipation(p)}
                    style={{
                      flex: 1,
                      background: inAuction ? 'rgba(239,68,68,0.15)' : 'rgba(139,92,246,0.25)',
                      border: `1px solid ${inAuction ? 'rgba(239,68,68,0.35)' : 'rgba(139,92,246,0.5)'}`,
                      color: inAuction ? '#F87171' : '#C4B5FD',
                      borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif"
                    }}
                  >
                    {inAuction ? '− Remove from Auction' : '+ Add to Auction'}
                  </button>

                  <button
                    onClick={() => openEditModal(p)}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E5E7EB', borderRadius: 6, padding: '6px 10px',
                      fontSize: 11, cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif"
                    }}
                    title="Edit Player Details"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() => toggleArchive(p)}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: p.is_archived ? '#4ADE80' : '#9CA3AF',
                      borderRadius: 6, padding: '6px 10px',
                      fontSize: 11, cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif"
                    }}
                    title={p.is_archived ? 'Restore' : 'Archive'}
                  >
                    {p.is_archived ? '♻️' : '📦'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Add / Edit Master Player */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#12091F', border: '1px solid rgba(139,92,246,0.4)',
            borderRadius: 14, width: '100%', maxWidth: 500, padding: 28,
            boxShadow: '0 0 50px rgba(139,92,246,0.25)', maxHeight: '90vh', overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: "'Rajdhani', sans-serif" }}>
                {editingPlayer ? 'EDIT MASTER PLAYER' : 'REGISTER NEW MASTER PLAYER'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#9CA3AF', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={savePlayer}>
              {/* Photo Preview & Upload */}
              <div style={{ marginBottom: 18, textAlign: 'center' }}>
                <div style={{
                  width: 100, height: 100, borderRadius: 12, margin: '0 auto 10px',
                  overflow: 'hidden', border: '2px solid rgba(139,92,246,0.5)',
                  background: '#0a0214', position: 'relative'
                }}>
                  {formPhotoUrl ? (
                    <img src={formPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 11 }}>
                      No Photo
                    </div>
                  )}
                  {uploadingPhoto && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#8B5CF6', fontSize: 11, fontWeight: 700
                    }}>
                      Uploading...
                    </div>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleFileUpload(e.target.files[0])}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                    color: '#C4B5FD', borderRadius: 6, padding: '6px 14px', fontSize: 12,
                    cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700
                  }}
                >
                  📁 Upload Photo to Supabase Storage
                </button>
              </div>

              {/* Player Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>PLAYER NAME</label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Adeen, Zabi, Virat Kohli"
                  required
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
                    color: '#fff', padding: '8px 12px', fontSize: 13, outline: 'none'
                  }}
                />
              </div>

              {/* Role & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>ROLE</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value)}
                    style={{
                      width: '100%', background: '#12091F',
                      border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
                      color: '#fff', padding: '8px 10px', fontSize: 12, outline: 'none'
                    }}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>CATEGORY</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    style={{
                      width: '100%', background: '#12091F',
                      border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
                      color: '#fff', padding: '8px 10px', fontSize: 12, outline: 'none'
                    }}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Default Base Price */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>DEFAULT BASE PRICE (₹ Cr)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formBasePrice}
                  onChange={e => setFormBasePrice(e.target.value)}
                  placeholder="3.0"
                  required
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
                    color: '#fff', padding: '8px 12px', fontSize: 13, outline: 'none'
                  }}
                />
              </div>

              {/* Batting & Bowling Style */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>BATTING STYLE</label>
                  <input
                    value={formBattingStyle}
                    onChange={e => setFormBattingStyle(e.target.value)}
                    placeholder="Right Hand Bat"
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
                      color: '#fff', padding: '8px 10px', fontSize: 12, outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>BOWLING STYLE</label>
                  <input
                    value={formBowlingStyle}
                    onChange={e => setFormBowlingStyle(e.target.value)}
                    placeholder="Right Arm Fast"
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
                      color: '#fff', padding: '8px 10px', fontSize: 12, outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                style={{
                  width: '100%', background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
                  color: '#fff', border: 'none', borderRadius: 6, padding: '12px',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.08em',
                  boxShadow: '0 0 20px rgba(139,92,246,0.3)'
                }}
              >
                {editingPlayer ? 'UPDATE MASTER RECORD' : 'SAVE TO PERMANENT MASTER LIBRARY'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
