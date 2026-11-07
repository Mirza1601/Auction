import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) throw authError

      // Verify this user has admin role
      const { data: profile, error: profileError } = await supabase
        .from('admin_profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profileError || !profile || profile.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error('Access denied. You do not have admin privileges.')
      }

      navigate('/admin/dashboard')
    } catch (err) {
      const msg = err.message || 'Login failed. Please try again.'
      if (msg.toLowerCase().includes('failed to fetch')) {
        setError(`Failed to fetch: Cannot connect to Supabase at ${import.meta.env.VITE_SUPABASE_URL || 'unknown URL'}. Please check if your project is Paused or still provisioning in Supabase.`)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#080010', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      backgroundImage: `
        radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.06) 0%, transparent 40%)
      `
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#8B5CF6', marginBottom: 8, fontFamily: "'Rajdhani', sans-serif" }}>
            ADMIN PORTAL
          </div>
          <h1 style={{
            fontSize: 42, fontWeight: 900, color: '#fff', margin: 0,
            fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em',
            textShadow: '0 0 40px rgba(139,92,246,0.4)'
          }}>
            AUCTION <span style={{ color: '#8B5CF6' }}>NEXUS</span>
          </h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>
            Auctioneer Control Center
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(18,9,31,0.85)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 12, backdropFilter: 'blur(12px)', padding: 32,
          boxShadow: '0 0 30px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.03)'
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#8B5CF6', marginBottom: 24, fontFamily: "'Rajdhani', sans-serif" }}>
            SECURE LOGIN
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              color: '#F87171', fontSize: 13, fontFamily: "'Rajdhani', sans-serif"
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6, letterSpacing: '0.08em' }}>
                EMAIL
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6,
                  color: '#E5E7EB', padding: '9px 12px', fontSize: 13,
                  fontFamily: "'Rajdhani', sans-serif", outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6, letterSpacing: '0.08em' }}>
                PASSWORD
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6,
                  color: '#E5E7EB', padding: '9px 12px', fontSize: 13,
                  fontFamily: "'Rajdhani', sans-serif", outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)',
                color: '#fff', border: 'none', borderRadius: 6, padding: '11px 20px',
                fontSize: 14, fontWeight: 700, letterSpacing: '0.08em',
                fontFamily: "'Rajdhani', sans-serif", cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 20px rgba(139,92,246,0.3)', opacity: loading ? 0.7 : 1,
                transition: 'all 0.15s'
              }}
            >
              {loading ? 'SIGNING IN...' : 'SIGN IN AS ADMIN'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <a href="/" style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none' }}>
              ← Back to Audience View
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

