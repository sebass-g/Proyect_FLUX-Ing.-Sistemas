import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabaseClient'
import '../estilos/flux.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  useEffect(() => {
    // Intentar obtener session desde la URL (link de recuperación)
    ;(async () => {
      try {
        // Parsear manualmente tokens en hash o query (compatible con cualquier versión de supabase-js)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const searchParams = new URLSearchParams(window.location.search)
        const access_token = hashParams.get('access_token') || searchParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token') || searchParams.get('refresh_token')

        console.debug('ResetPassword: parsed tokens', { access_token: !!access_token, refresh_token: !!refresh_token })

        if (access_token) {
          // Establecer la sesión manualmente para que supabase cliente tenga la sesión
          const { data: setData, error: setError } = await supabase.auth.setSession({ access_token, refresh_token })
          if (setError) {
            console.error('setSession error', setError)
          } else {
            setSession(setData.session ?? null)
          }
        } else {
          // Finalmente, comprobar si ya hay sesión activa
          const { data: current } = await supabase.auth.getSession()
          setSession(current?.session ?? null)
        }
      } catch (err) {
        console.error('reset: manual session handling', err)
      } finally {
        setReady(true)
        // Limpiar tokens de la URL por seguridad
        try {
          const cleanUrl = window.location.pathname + window.location.search
          window.history.replaceState({}, document.title, cleanUrl)
        } catch (e) {
          // no crítico
        }
      }
    })()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ text: '', type: '' })

    if (password.length < 8) {
      setMessage({ text: 'La contraseña debe tener al menos 8 caracteres.', type: 'error' })
      return
    }
    if (password !== passwordConfirm) {
      setMessage({ text: 'Las contraseñas no coinciden.', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setMessage({ text: '✅ Contraseña actualizada. Redirigiendo al login...', type: 'success' })
      // Cerrar sesión local y volver al login inmediatamente
      try {
        await supabase.auth.signOut()
      } catch (signOutErr) {
        console.error('signOut error', signOutErr)
      }
      navigate('/auth', { replace: true })
    } catch (err) {
      setMessage({ text: '⚠️ ' + err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Si aún no está listo mostramos un placeholder
  if (!ready) return <div className="container"><div className="card">Cargando...</div></div>

  // Si no hay session ni token en url, instruir al usuario
  if (!session) {
    return (
      <div className="auth-layout">
        <div className="auth-header">
          <div className="brand">
            <div className="logoDot"></div>
            <span className="brandTitle" style={{ fontSize: '32px' }}>FLUX</span>
          </div>
          <span className="brandSubtitle" style={{ fontSize: '15px' }}>Recuperar contraseña</span>
        </div>

        <div className="card auth-card-width">
          <h2 className="text-center">Enlace inválido o expirado</h2>
          <p className="label">El enlace de recuperación parece inválido o ya expiró. Solicita nuevamente el enlace de recuperación.</p>
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => navigate('/auth/forgot')}>Solicitar nuevo enlace</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={() => navigate('/auth')}>Volver al login</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-layout">
      <div className="auth-header">
        <div className="brand">
          <div className="logoDot"></div>
          <span className="brandTitle" style={{ fontSize: '32px' }}>FLUX</span>
        </div>
        <span className="brandSubtitle" style={{ fontSize: '15px' }}>Actualizar contraseña</span>
      </div>

      <div className="card auth-card-width">
        <h2 className="text-center" style={{ marginBottom: 24 }}>Elige una nueva contraseña</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label">Nueva contraseña</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="mb-4">
            <label className="label">Confirmar nueva contraseña</label>
            <input className="input" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
          </div>

          <button type="submit" className="btn btnPrimary" disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar contraseña'}</button>
        </form>

        {message.text && (
          <div className={message.type === 'error' ? 'alert' : 'preview'} style={{ marginTop: 20 }}>
            <span className="label" style={{ marginBottom: 0, color: 'var(--texto)', textAlign: 'center', display: 'block', fontWeight: 500 }}>{message.text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
