import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { obtenerVistaPreviaPorCodigo } from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";

export default function GrupoDetalle() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState(null);

  useEffect(() => {
    (async () => {
      // Si no hay código en URL, no hacemos petición
      if (!codigo) {
        setGrupo(null);
        return;
      }
      // Cargar datos del grupo para renderizar miembros/actividad
      const g = await obtenerVistaPreviaPorCodigo(codigo);
      setGrupo(g);
    })();
  }, [codigo]);

  // Estado cuando el código no existe o no se encontró el grupo
  if (!grupo) {
    return (
      <div className="container">
        <div className="card">
          <strong>Grupo no encontrado</strong>
          <p>Verifique el código e intente nuevamente.</p>
          <button className="btn" onClick={() => navigate("/grupos")}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Encabezado con acciones de navegación */}
      <div className="topbar">
        <div className="brand">
          <div className="logoDot" />
          <div>
            <div className="brandTitle">FLUX</div>
            <div className="brandSubtitle">Detalle del grupo</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={{ width: "auto" }} onClick={() => navigate("/grupos")}>
            {/* Botón para volver a la lista de grupos */}
            Volver
          </button>
          <button
            className="btn"
            style={{ width: "auto", background: "#333", fontSize: "12px" }}
            onClick={() => supabase.auth.signOut()}
          >
            {/* Botón para cerrar sesión */}
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Resumen del grupo */}
      <div className="card">
        <h1>{grupo.nombre}</h1>
        <p>
          Código del grupo: <strong>{grupo.codigo}</strong>
        </p>
      </div>

      <div style={{ height: 16 }} />

      {/* Listas paralelas: miembros y actividad */}
      <div className="grid2">
        <div className="card">
          <strong>Miembros</strong>
          {/* Lista de miembros con scroll */}
          <ul className="miembros-scroll">
            {grupo.miembros.map(m => (
              <li key={m.id}>{m.nombre}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <strong>Actividad</strong>
          {/* Lista de actividad con scroll */}
          <div className="actividad-scroll">
            {grupo.actividad.map((a, i) => (
              <div key={i} className="feedItem">
                <div>{a.mensaje}</div>
                <small>{new Date(a.fecha).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
