import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabaseClient' 
import '../estilos/flux.css' 

function Registro() {
  const navigate = useNavigate()
  const [esLogin, setEsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [username, setUsername] = useState('')
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  const manejarAuth = async (e) => {
    e.preventDefault()
    setMensaje({ texto: '', tipo: '' })
    setCargando(true)

    try {
      if (esLogin) {
        // === MODO INICIAR SESIÓN ===
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) {
          if (error.message.includes("Invalid login")) {
            setMensaje({ 
              texto: '❌ Usuario no encontrado o contraseña incorrecta. ¿Quieres crear una cuenta?', 
              tipo: 'error' 
            })
          } else {
            throw error
          }
        }

      } else {
        // === MODO CREAR CUENTA (REGISTRO) ===

        if (!username.trim()) {
          throw new Error('El username es obligatorio.')
        }
        if (!telefono.trim()) {
          throw new Error('El teléfono es obligatorio.')
        }
        if (!nombre.trim()) {
          throw new Error('El nombre es obligatorio.')
        }
        if (!apellido.trim()) {
          throw new Error('El apellido es obligatorio.')
        }

        if (!email.endsWith('@correo.unimet.edu.ve')) {
          throw new Error('Solo se permiten correos @correo.unimet.edu.ve')
        }

        const regex = /^(?=.*\d)(?=.*[A-Z]).{8,}$/
        if (!regex.test(password)) {
          throw new Error('La contraseña debe tener: 8 caracteres, 1 mayúscula y 1 número.')
        }

        if (password !== passwordConfirm) {
          throw new Error('Las contraseñas no coinciden.')
        }

        const displayName = `${nombre.trim()} ${apellido.trim()}`.trim()
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              username: username.trim(),
              phone: telefono.trim(),
              first_name: nombre.trim(),
              last_name: apellido.trim()
            }
          }
        })

        if (error) throw error

        const userId = data?.user?.id
        if (userId) {
          const { error: perfilError } = await supabase
            .from('profiles')
            .upsert(
              {
                id: userId,
                username: username.trim(),
                telefono: telefono.trim(),
                nombre: nombre.trim(),
                apellido: apellido.trim(),
                career: ''
              },
              { onConflict: 'id' }
            )
          if (perfilError) throw perfilError
        }

        setMensaje({ 
          texto: '✅ ¡Cuenta creada! Hemos enviado un enlace de verificación a tu correo Unimet.', 
          tipo: 'exito' 
        })

        setTimeout(() => {
          setEsLogin(true)
          setMensaje({ texto: '', tipo: '' })
        }, 2000)
      }

    } catch (error) {
      setMensaje({ texto: '⚠️ ' + error.message, tipo: 'error' })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="auth-layout">
      
      {/* HEADER: marca y subtítulo dinámico */}
      <div className="auth-header">
        <div className="brand">
          <div className="logoDot"></div>
          <span className="brandTitle" style={{ fontSize: '32px' }}>FLUX</span>
        </div>
        <span className="brandSubtitle" style={{ fontSize: '15px' }}>
          {esLogin ? 'Bienvenido de nuevo' : 'Únete a la comunidad'}
        </span>
      </div>

      {/* TARJETA CENTRADA */}
      <div className="card auth-card-width">
        <h2 className="text-center" style={{ marginBottom: '24px' }}>
          {esLogin ? 'Iniciar Sesión' : 'Crear Usuario'}
        </h2>
        
        <form onSubmit={manejarAuth}>
          
          {/* Input: correo institucional */}
          <div className="mb-4">
            <label className="label">Correo Institucional</label>
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

          {/* Input: username (solo registro) */}
          {!esLogin && (
            <div className="mb-4">
              <label className="label">Username</label>
              <input
                className="input"
                type="text"
                placeholder="Tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ marginTop: 0 }}
              />
            </div>
          )}

          {/* Input: teléfono (solo registro) */}
          {!esLogin && (
            <div className="mb-4">
              <label className="label">Teléfono</label>
              <input
                className="input"
                type="tel"
                placeholder="Tu número de teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                style={{ marginTop: 0 }}
              />
            </div>
          )}

          {/* Input: nombre (solo registro) */}
          {!esLogin && (
            <div className="mb-4">
              <label className="label">Nombre</label>
              <input
                className="input"
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                style={{ marginTop: 0 }}
              />
            </div>
          )}

          {/* Input: apellido (solo registro) */}
          {!esLogin && (
            <div className="mb-4">
              <label className="label">Apellido</label>
              <input
                className="input"
                type="text"
                placeholder="Tu apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                required
                style={{ marginTop: 0 }}
              />
            </div>
          )}

          {/* Input: contraseña */}
          <div className="mb-4">
            <label className="label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input 
                className="input" 
                type={mostrarPassword ? "text" : "password"} 
                placeholder={esLogin ? "Tu contraseña" : "Mín. 8 caracteres, 1 Mayúscula, 1 Número"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ marginTop: 0 }}
              />
              <button
                type="button"
                className="password-eye"
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={mostrarPassword}
                onClick={() => setMostrarPassword(v => !v)}
              >
                {mostrarPassword ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6 0 10 8 10 8a21.79 21.79 0 0 1-3.17 4.26" />
                    <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                    <path d="M1 1l22 22" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Input: confirmar contraseña (solo registro) */}
          {!esLogin && (
            <div className="mb-4">
              <label className="label">Confirmar contraseña</label>
              <input
                className="input"
                type={mostrarPassword ? "text" : "password"}
                placeholder="Repite tu contraseña"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                style={{ marginTop: 0 }}
              />
            </div>
          )}

          {/* Botón Principal */}
          <button 
            type="submit" 
            className="btn btnPrimary" 
            disabled={cargando}
          >
            {cargando ? 'Procesando...' : (esLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </button>

        </form>

        {/* Separador */}
        <div style={{ 
          margin: '24px 0', 
          borderTop: '1px solid rgba(37, 52, 63, 0.12)' 
        }}></div>

        {/* Botón para cambiar de modo */}
        <p className="text-center label">
          {esLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
        </p>
        <button 
          type="button" 
          className="btn btn-secundario"
          onClick={() => {
            setEsLogin(!esLogin)
            setMensaje({ text: '', tipo: '' })
          }}
        >
          {esLogin ? 'Crear Usuario Nuevo' : 'Iniciar Sesión'}
        </button>

        <button
          type="button"
          className="btn"
          style={{ marginTop: '12px' }}
          onClick={() => navigate('/grupos')}
        >
          Volver al Home
        </button>

        {/* Alertas / Notificaciones */}
        {mensaje.texto && (
          <div className={mensaje.tipo === 'error' ? 'alert' : 'preview'} style={{ marginTop: '20px' }}>
            <span className="label" style={{
              marginBottom: 0, 
              color: 'var(--texto)', 
              textAlign: 'center', 
              display: 'block',
              fontWeight: 500
            }}>
              {mensaje.texto}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default Registro
