import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuctionState } from '../../hooks/useAuctionState'
import AdminAuctionNexus from '../../components/AdminAuctionNexus'

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState(null)
  const { state, setState, loading, error } = useAuctionState(true)

  // Auth guard: verify session on mount and on auth state change
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate('/admin/login', { replace: true })
        return
      }

      // Verify admin role
      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut()
        navigate('/admin/login', { replace: true })
        return
      }

      setUser(session.user)
      setAuthChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/admin/login', { replace: true })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', background: '#080010', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#8B5CF6', fontFamily: "'Rajdhani', sans-serif", fontSize: 16
      }}>
        Verifying admin access...
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#080010', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#8B5CF6', fontFamily: "'Rajdhani', sans-serif", fontSize: 16
      }}>
        Loading auction state...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080010', color: '#E5E7EB', fontFamily: "'Rajdhani', sans-serif" }}>
      {/* Admin indicator bar */}
      <div style={{
        background: 'rgba(139,92,246,0.15)', borderBottom: '1px solid rgba(139,92,246,0.3)',
        padding: '4px 20px', display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 11, letterSpacing: '0.08em'
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6',
          boxShadow: '0 0 8px #8B5CF6', animation: 'pulse 2s infinite'
        }} />
        <span style={{ color: '#A78BFA', fontWeight: 700 }}>ADMIN MODE</span>
        <span style={{ color: '#4B5563' }}>|</span>
        <span style={{ color: '#6B7280' }}>{user?.email}</span>
        {error && (
          <>
            <span style={{ color: '#4B5563' }}>|</span>
            <span style={{ color: '#F87171' }}>⚠ {error}</span>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/" target="_blank" style={{
            color: '#6B7280', fontSize: 11, textDecoration: 'none',
            padding: '2px 8px', border: '1px solid rgba(107,114,128,0.3)', borderRadius: 4
          }}>
            View Audience →
          </a>
          <button onClick={handleLogout} style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#F87171', borderRadius: 4, padding: '2px 10px', cursor: 'pointer',
            fontSize: 11, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700
          }}>
            LOGOUT
          </button>
        </div>
      </div>

      <AdminAuctionNexus state={state} setState={setState} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

