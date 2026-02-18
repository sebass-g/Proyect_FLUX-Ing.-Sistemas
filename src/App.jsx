import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { supabase } from "./config/supabaseClient"; // Importamos Supabase
import "./App.css"; 
import "./estilos/flux.css"; // Importamos los estilos globales de FLUX

// Importamos las páginas
import Registro from "./pages/Registro";
import Home from "./pages/Home";
import GrupoDetalle from "./pages/GrupoDetalle";
import EditarPerfil from "./pages/EditarPerfil";
import DetallesRepositorio from "./pages/DetallesRepositorio";
import RepositorioPublicoDetalle from "./pages/RepositorioPublicoDetalle";

// Bloquea rutas privadas: si no hay sesión, manda al login
function RequireAuth({ session, loading, children }) {
  const location = useLocation();

  // Espera a que Supabase resuelva la sesión inicial
  if (loading) {
    return (
      <div className="container">
        {/* Estado de carga mientras se valida la sesión */}
        <div className="card">Cargando...</div>
      </div>
    );
  }

  // Usuario no autenticado: redirigir a login y guardar destino
  if (!session) {
    // Usuario no autenticado: redirigir a login
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return children;
}

// Bloquea el login si ya hay sesión activa
function GuestOnly({ session, loading, children }) {
  const location = useLocation();

  // Espera a que Supabase resuelva la sesión inicial
  if (loading) {
    return (
      <div className="container">
        {/* Estado de carga mientras se valida la sesión */}
        <div className="card">Cargando...</div>
      </div>
    );
  }

  // Si ya hay sesión, regresamos al destino original o al home
  if (session) {
    // Usuario autenticado: evitar volver al login
    const destino = location.state?.from?.pathname || "/grupos";
    return <Navigate to={destino} replace />;
  }

  return children;
}

export default function App() {
  // Estado global de autenticación
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    // 1) Revisar si ya había una sesión guardada al abrir la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    // 2) Escuchar cambios: login/logout/refresh de token
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Rutas públicas/privadas
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <GuestOnly session={session} loading={loadingSession}>
            {/* Pantalla de registro/login */}
            <Registro />
          </GuestOnly>
        }
      />
      <Route
        path="/grupos"
        element={
          <Home />
        }
      />
      <Route
        path="/grupos/:codigo"
        element={
          <GrupoDetalle />
        }
      />
      <Route
        path="/perfil/editar"
        element={
          <RequireAuth session={session} loading={loadingSession}>
            {/* Pantalla de edición de perfil */}
            <EditarPerfil />
          </RequireAuth>
        }
      />
      <Route
        path="/repos/:codigo"
        element={
          <DetallesRepositorio />
        }
      />
      <Route
        path="/repos-publicos/:id"
        element={
          <RepositorioPublicoDetalle />
        }
      />
      {/* Redirecciones por defecto */}
      <Route path="/" element={<Navigate to="/grupos" replace />} />
      <Route path="*" element={<Navigate to="/grupos" replace />} />
    </Routes>
  );
}
