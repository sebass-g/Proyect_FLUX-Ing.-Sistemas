import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabaseClient'
import '../estilos/flux.css'

export default function OlvideContrasena() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  const enviarReset = async (e) => {
    e.preventDefault()
    setMensaje({ texto: '', tipo: '' })
    setCargando(true)

    try {
      const siteUrl = import.meta.env.VITE_SITE_URL ?? window.location.origin
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: siteUrl + '/auth/reset'
      })

      if (error) throw error

      setMensaje({ texto: '✅ Revisa tu correo para resetear la contraseña.', tipo: 'exito' })
    } catch (err) {
      setMensaje({ texto: '⚠️ ' + err.message, tipo: 'error' })
    } finally {
      setCargando(false)
    }
  }

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
        <h2 className="text-center" style={{ marginBottom: '24px' }}>Olvidé mi contraseña</h2>

        <form onSubmit={enviarReset}>
          <div className="mb-4">
            <label className="label">Correo electrónico</label>
            <input
              className="input"
              type="email"
              placeholder="usuario@correo.unimet.edu.ve"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ marginTop: 0 }}
            />
          </div>

          <button type="submit" className="btn btnPrimary" disabled={cargando}>
            {cargando ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>
        </form>

        <div style={{ margin: '24px 0', borderTop: '1px solid rgba(37, 52, 63, 0.12)'}}></div>

        <button
          type="button"
          className="btn"
          onClick={() => navigate('/auth')}
        >
          Volver al Login
        </button>

        {mensaje.texto && (
          <div className={mensaje.tipo === 'error' ? 'alert' : 'preview'} style={{ marginTop: '20px' }}>
            <span className="label" style={{ marginBottom: 0, color: 'var(--texto)', textAlign: 'center', display: 'block', fontWeight: 500 }}>
              {mensaje.texto}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
