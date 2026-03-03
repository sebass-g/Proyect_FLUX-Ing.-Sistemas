import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  guardarCalificacionGrupoPublico,
  listarArchivosGrupoPorId,
  obtenerMiCalificacionGrupoPublico,
  obtenerPromedioGrupoPublico,
  obtenerRepositorioParaLecturaPorCodigo
} from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";
import { obtenerColorEntidad } from "../utils/groupColors";
import "../estilos/flux.css";
import Estrellas from "../components/Estrellas";

export default function DetallesRepositorio() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [tab, setTab] = useState("info");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);
  const [ratingPromedio, setRatingPromedio] = useState(0);
  const [ratingTotal, setRatingTotal] = useState(0);
  const [miRating, setMiRating] = useState("");
  const [guardandoRating, setGuardandoRating] = useState(false);
  const [mensajeRating, setMensajeRating] = useState("");

  async function cargarRatings(repoId) {
    if (!repoId) {
      setRatingPromedio(0);
      setRatingTotal(0);
      setMiRating("");
      return;
    }

    const [promedio, miCalificacion] = await Promise.all([
      obtenerPromedioGrupoPublico({ grupoId: repoId }),
      obtenerMiCalificacionGrupoPublico({ grupoId: repoId })
    ]);
    setRatingPromedio(promedio?.ratingPromedio || 0);
    setRatingTotal(promedio?.ratingTotal || 0);
    setMiRating(miCalificacion !== null && miCalificacion !== undefined ? String(miCalificacion) : "");
  }

  useEffect(() => {
    (async () => {
      setCargando(true);
      setError("");
      try {
        const g = await obtenerRepositorioParaLecturaPorCodigo(codigo);
        setGrupo(g);
        if (g?.id) {
          const files = await listarArchivosGrupoPorId({ grupoId: g.id });
          setArchivos(files);
          if (g.esPublico) {
            await cargarRatings(g.id);
          } else {
            setRatingPromedio(0);
            setRatingTotal(0);
            setMiRating("");
          }
        } else {
          setArchivos([]);
          setRatingPromedio(0);
          setRatingTotal(0);
          setMiRating("");
        }
      } catch (e) {
        setError(e.message);
        setGrupo(null);
        setArchivos([]);
      }
      const {
        data: { session }
      } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
      setAvatarUrl(session?.user?.user_metadata?.avatar_url?.trim() || "");
      setCargando(false);
    })();
  }, [codigo]);

  async function manejarCalificar(valorNota) {
    if (!grupo?.id || !grupo?.esPublico) return;
    if (!userId) {
      setMensajeRating("Inicia sesión para calificar.");
      return;
    }
    const valor = Number(valorNota);
    if (!Number.isFinite(valor)) return;

    setGuardandoRating(true);
    setMensajeRating("");
    try {
      await guardarCalificacionGrupoPublico({ grupoId: grupo.id, rating: valor });
      await cargarRatings(grupo.id);
      setMensajeRating("Calificación guardada.");
    } catch (e) {
      setMensajeRating(`Error al guardar calificación: ${e.message}`);
    } finally {
      setGuardandoRating(false);
    }
  }

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
          {error && <p>{error}</p>}
          <button className="btn arrow-back" onClick={() => navigate("/grupos")} aria-label="Atrás">
            <svg className="arrow-back-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const colorGrupo = obtenerColorEntidad({
    tipo: "grupo",
    entidadId: grupo.id,
    identificador: grupo.codigo || grupo.nombre || grupo.id || "",
    colorId: grupo.color_id || ""
  });
  const anuncios = (grupo?.actividad || [])
    .filter(a => `${a.mensaje || ""}`.startsWith("ANUNCIO::"))
    .map(a => ({
      ...a,
      texto: `${a.mensaje || ""}`.replace("ANUNCIO::", "")
    }));

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
        <button className={`group-tab ${tab === "info" ? "active" : ""}`} onClick={() => setTab("info")}>
          Info
        </button>
        <button className={`group-tab ${tab === "archivos" ? "active" : ""}`} onClick={() => setTab("archivos")}>
          Archivos
        </button>
        <button className={`group-tab ${tab === "people" ? "active" : ""}`} onClick={() => setTab("people")}>
          People
        </button>
      </div>

      {tab === "info" && (
        <div className="group-tab-content" style={{ marginTop: 8 }}>
          <div className="card">
            <strong>{grupo.nombre}</strong>
            <div className="label" style={{ marginTop: 8 }}>Código: {grupo.codigo}</div>
            <div className="label">Visibilidad: {grupo.esPublico ? "Público" : "Privado"}</div>
            {grupo.esPublico ? (
              <>
                <div className="label">
                  {ratingTotal
                    ? `Calificación promedio: ${Number(ratingPromedio || 0).toFixed(1)}/5 (${ratingTotal})`
                    : "Calificación promedio: sin calificaciones"}
                </div>
                <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 10 }}>
                  {userId ? (
                    <>
                      <Estrellas alCalificar={manejarCalificar} />
                      <div className="label">Tu calificación actual: {miRating || "sin calificar"}</div>
                      {guardandoRating && <div className="label">Guardando calificación...</div>}
                      {mensajeRating && <div className="label">{mensajeRating}</div>}
                    </>
                  ) : (
                    <div className="label">Inicia sesión para calificar.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="label">Este repositorio no acepta calificaciones porque es privado.</div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="card">
              <strong>Anuncios</strong>
              <div style={{ marginTop: 12 }}>
                {anuncios.length === 0 ? (
                  <div className="label">Aún no hay anuncios.</div>
                ) : (
                  anuncios.map((a, i) => (
                    <div key={`${a.fecha}-${i}`} className="feed-card" style={{ marginBottom: 8 }}>
                      <div className="feed-card-header">
                        <div className="feed-avatar">A</div>
                        <div>
                          <div className="feed-author">Anuncio</div>
                          <div className="feed-date">{a.fecha ? new Date(a.fecha).toLocaleString() : ""}</div>
                        </div>
                      </div>
                      <div className="feed-text">{a.texto}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
