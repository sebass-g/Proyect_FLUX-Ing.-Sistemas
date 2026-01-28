import { useState } from 'react'
import { supabase } from '../config/supabaseClient' 
import '../estilos/flux.css' 

function Registro() {
  // --- ESTADOS ---
  const [esLogin, setEsLogin] = useState(true) // true = Iniciar Sesión, false = Crear Cuenta
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  // --- LÓGICA PRINCIPAL ---
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
          // Si el error es "Invalid login credentials", asumimos que no existe o clave errada
          if (error.message.includes("Invalid login")) {
            setMensaje({ 
              texto: '❌ Usuario no encontrado o contraseña incorrecta. ¿Quieres crear una cuenta?', 
              tipo: 'error' 
            })
          } else {
            throw error
          }
        }
        // Si no hay error, App.jsx detectará la sesión automáticamente

      } else {
        // === MODO CREAR CUENTA (REGISTRO) ===
        
        // 1. Validar Correo UNIMET
        if (!email.endsWith('@correo.unimet.edu.ve')) {
          throw new Error('Solo se permiten correos @correo.unimet.edu.ve')
        }

        // 2. Validar Contraseña Segura
        const regex = /^(?=.*\d)(?=.*[A-Z]).{8,}$/
        if (!regex.test(password)) {
          throw new Error('La contraseña debe tener: 8 caracteres, 1 mayúscula y 1 número.')
        }

        // 3. Crear usuario en Supabase
        const { error } = await supabase.auth.signUp({
          email,
          password
        })

        if (error) throw error

        setMensaje({ 
          texto: '✅ ¡Cuenta creada! Hemos enviado un enlace de verificación a tu correo Unimet.', 
          tipo: 'exito' 
        })
      }

    } catch (error) {
      setMensaje({ texto: '⚠️ ' + error.message, tipo: 'error' })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="auth-layout">
      
      {/* HEADER: Logo y Título dinámico */}
      <div className="auth-header">
        <div className="brand">
          <div className="logoDot"></div>
          <span className="brandTitle" style={{ fontSize: '28px' }}>FLUX</span>
        </div>
        <span className="brandSubtitle" style={{ fontSize: '16px' }}>
          {esLogin ? 'Bienvenido de nuevo' : 'Únete a la comunidad'}
        </span>
      </div>

      {/* TARJETA CENTRADA Y GRANDE */}
      <div className="card auth-card-width">
        <h2 className="text-center mb-4" style={{marginTop: 0}}>
          {esLogin ? 'Iniciar Sesión' : 'Crear Usuario'}
        </h2>
        
        <form onSubmit={manejarAuth}>
          
          <div className="mb-4">
            <label className="label">Correo Institucional</label>
            <input 
              className="input" 
              type="email" 
              placeholder="usuario@correo.unimet.edu.ve"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mb-4">
            <label className="label">Contraseña</label>
            <input 
              className="input" 
              type="password" 
              placeholder={esLogin ? "Tu contraseña" : "Mín. 8 carácteres, 1 Mayúscula, 1 Número"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Botón Principal (Cambia de color o texto según el modo) */}
          <button 
            type="submit" 
            className="btn btnPrimary" 
            disabled={cargando}
          >
            {cargando ? 'Procesando...' : (esLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </button>

        </form>

        {/* Separador */}
        <div style={{ margin: '20px 0', borderTop: '1px solid var(--borde)' }}></div>

        {/* Botón para cambiar de modo */}
        <p className="text-center label">
          {esLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
        </p>
        <button 
          type="button" 
          className="btn btn-secundario"
          onClick={() => {
            setEsLogin(!esLogin)
            setMensaje({ text: '', tipo: '' }) // Limpiar errores al cambiar
          }}
        >
          {esLogin ? 'Crear Usuario Nuevo' : 'Volver a Iniciar Sesión'}
        </button>

        {/* Alertas / Notificaciones */}
        {mensaje.texto && (
          <div className={mensaje.tipo === 'error' ? 'alert' : 'preview'} style={{ marginTop: '20px' }}>
            <span className="label" style={{marginBottom: 0, color: 'var(--texto)', textAlign: 'center', display: 'block'}}>
              {mensaje.texto}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default Registro