import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listarArchivosGrupoPorId, obtenerVistaPreviaPorCodigo } from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";
import { obtenerColorGrupo } from "../utils/groupColors";
import "../estilos/flux.css";

export default function DetallesRepositorio() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [tab, setTab] = useState("archivos");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const g = await obtenerVistaPreviaPorCodigo(codigo);
      setGrupo(g);
      if (g?.id) {
        const files = await listarArchivosGrupoPorId({ grupoId: g.id });
        setArchivos(files);
      } else {
        setArchivos([]);
      }
      const {
        data: { session }
      } = await supabase.auth.getSession();
      setAvatarUrl(session?.user?.user_metadata?.avatar_url?.trim() || "");
      setCargando(false);
    })();
  }, [codigo]);

  if (cargando) {
    return (
      <div className="container">
        <div className="card">Cargando repositorio...</div>
      </div>
    );
  }

  if (!grupo) {
    return (
      <div className="container">
        <div className="card">
          <strong>Repositorio no encontrado</strong>
          <button className="btn arrow-back" onClick={() => navigate("/grupos")} aria-label="Atrás">
            <svg className="arrow-back-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const colorGrupo = obtenerColorGrupo(grupo.codigo || grupo.nombre || "");

  return (
    <div className="container">
      <div className="group-banner" style={{ "--banner-a": colorGrupo.a, "--banner-b": colorGrupo.b }}>
        <div className="group-banner-content group-banner-single">
          <button className="btn arrow-back group-back-btn" onClick={() => navigate("/grupos")} aria-label="Atrás">
            <svg className="arrow-back-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="group-banner-main">
            <div className="group-banner-title">{grupo.nombre}</div>
            <div className="group-banner-subtitle">Código: {grupo.codigo}</div>
          </div>
          <button className="avatar-button home-avatar-lg" onClick={() => navigate("/perfil/editar")}>
            {avatarUrl ? <img className="avatar-img" src={avatarUrl} alt="Perfil" /> : <div className="avatar-fallback">U</div>}
          </button>
        </div>
      </div>

      <div className="group-tabs">
        <button className={`group-tab ${tab === "archivos" ? "active" : ""}`} onClick={() => setTab("archivos")}>
          Archivos
        </button>
        <button className={`group-tab ${tab === "people" ? "active" : ""}`} onClick={() => setTab("people")}>
          People
        </button>
      </div>

      {tab === "archivos" && (
        <div className="group-tab-content">
          <div className="archivos-grid">
            {archivos.map((file, idx) => {
              const fullPath = file.path;
              const { data } = supabase.storage.from("Flux_repositorioGrupos").getPublicUrl(fullPath);
              const nombre = file.nombre || fullPath?.split("/").pop() || "archivo";
              const extension = nombre.split(".").pop().toLowerCase();
              const icono = extension === "pdf" ? "📄" : extension === "docx" ? "📝" : extension === "png" ? "🖼️" : "📎";
              return (
                <a key={`${file.id || idx}`} href={data.publicUrl} target="_blank" rel="noopener noreferrer" className="archivo-card archivo-link">
                  <div className="archivo-icon">{icono}</div>
                  <div className="archivo-info">
                    <div className="archivo-nombre">{nombre}</div>
                    <div className="archivo-meta">{file.created_at ? new Date(file.created_at).toLocaleDateString() : ""}</div>
                  </div>
                </a>
              );
            })}
            {!archivos.length && <p className="no-archivos">No hay archivos subidos aún.</p>}
          </div>
        </div>
      )}

      {tab === "people" && (
        <div className="group-tab-content">
          <div className="card">
            <strong>Integrantes</strong>
            <ul className="miembros-scroll" style={{ maxHeight: "none" }}>
              {(grupo.miembros || []).map(m => (
                <li key={m.id} className="member-row">
                  <div className="member-item">
                    <span className="member-item-name">
                      {m.nombre}
                      {m.is_admin ? " (admin)" : ""}
                    </span>
                    <span className="member-item-hint">Integrante</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
