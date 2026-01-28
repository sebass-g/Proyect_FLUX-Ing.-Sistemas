import { useState, useEffect } from "react";
import { supabase } from "./config/supabaseClient"; // Importamos Supabase
import "./App.css"; 
import "./estilos/flux.css"; // Importamos los estilos globales de FLUX

// Importamos las páginas
import Registro from "./paginas/Registro";
import PaginaGrupos from "./paginas/PaginaGrupos";
import PaginaDetalleGrupo from "./paginas/PaginaDetalleGrupo";

export default function App() {
  // 1. Estado para saber si hay un usuario logueado (sesión)
  const [session, setSession] = useState(null);

  // 2. Estado para la navegación de grupos (el que ya tenías)
  const [codigoGrupoAbierto, setCodigoGrupoAbierto] = useState(null);

  useEffect(() => {
    // A. Revisar si ya había una sesión guardada al abrir la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // B. Escuchar cambios: si se loguea o se sale, actualizamos el estado
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- LÓGICA DE PANTALLAS ---

  // CASO 1: Si NO hay sesión, mostramos el Registro (Login/Registro)
  if (!session) {
    return <Registro />;
  }

  // CASO 2: Si SÍ hay sesión, mostramos la App de Grupos (tu código original)
  return codigoGrupoAbierto ? (
    <PaginaDetalleGrupo
      codigoGrupo={codigoGrupoAbierto}
      volver={() => setCodigoGrupoAbierto(null)}
    />
  ) : (
    <div className="container"> 
      {/* Botón temporal para Cerrar Sesión y probar que funciona */}
      <div style={{display: 'flex', justifyContent: 'flex-end', padding: '10px'}}>
        <button 
          className="btn" 
          style={{width: 'auto', background: '#333', fontSize: '12px'}}
          onClick={() => supabase.auth.signOut()}
        >
          Cerrar Sesión
        </button>
      </div>

      <PaginaGrupos abrirGrupo={(codigo) => setCodigoGrupoAbierto(codigo)} />
    </div>
  );
}