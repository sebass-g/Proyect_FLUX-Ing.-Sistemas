import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  eliminarRepositorioPublico,
  eliminarArchivoRepositorioPublico,
  guardarCalificacionRepositorioPublico,
  agregarColaboradorPorEmail,
  eliminarColaboradorRepositorioPublico,
  listarArchivosRepositorioPublico,
  listarColaboradoresRepositorioPublico,
  obtenerMiCalificacionRepositorioPublico,
  obtenerPromedioRepositorioPublico,
  obtenerRepositorioPublicoPorId,
  salirRepositorioPublico,
  subirArchivoRepositorioPublico,
  toggleFavoritoRepositorio,
  isRepositorioFavorito
} from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";
import "../estilos/flux.css";

export default function RepositorioPublicoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [repo, setRepo] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [isFavorito, setIsFavorito] = useState(false);
  const [actividad, setActividad] = useState([]);
  const [archivosSeleccionados, setArchivosSeleccionados] = useState([]);
  const [nuevoAnuncio, setNuevoAnuncio] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [mensajeColaboradores, setMensajeColaboradores] = useState("");
  const [esCreador, setEsCreador] = useState(false);
  const [esColaborador, setEsColaborador] = useState(false);
  const [colaboradores, setColaboradores] = useState([]);
  const [emailColaborador, setEmailColaborador] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);
  const [ratingPromedio, setRatingPromedio] = useState(0);
  const [ratingTotal, setRatingTotal] = useState(0);
  const [miRating, setMiRating] = useState("");
  const [guardandoRating, setGuardandoRating] = useState(false);
  const inputRef = useRef(null);
  const esEditor = esCreador || esColaborador;
  const [tabActiva, setTabActiva] = useState("info");

  async function cargarArchivos(repoId) {
    if (!repoId) {
      setArchivos([]);
      return;
    }
    const data = await listarArchivosRepositorioPublico({ repositorioId: repoId });
    setArchivos(data);
  }

  async function cargarRatings(repoId) {
    if (!repoId) {
      setRatingPromedio(0);
      setRatingTotal(0);
      setMiRating("");
      return;
    }
    const [promedio, miCalificacion] = await Promise.all([
      obtenerPromedioRepositorioPublico({ repositorioId: repoId }),
      obtenerMiCalificacionRepositorioPublico({ repositorioId: repoId })
    ]);
    setRatingPromedio(promedio?.ratingPromedio || 0);
    setRatingTotal(promedio?.ratingTotal || 0);
    setMiRating(miCalificacion ? String(miCalificacion) : "");
  }

  async function cargarColaboradores(repoId, uid) {
    if (!repoId) {
      setColaboradores([]);
      setEsColaborador(false);
      return;
    }
    if (!uid) {
      setColaboradores([]);
      setEsColaborador(false);
      return;
    }
    try {
      const data = await listarColaboradoresRepositorioPublico({ repositorioId: repoId });
      setColaboradores(data);
      if (uid) {
        setEsColaborador(data.some(c => c.user_id === uid));
      } else {
        setEsColaborador(false);
      }
    } catch (e) {
      console.warn("No se pudieron cargar colaboradores:", e.message);
      setColaboradores([]);
      setEsColaborador(false);
    }
  }

  useEffect(() => {
    (async () => {
      setCargando(true);
      setError("");
      try {
        const data = await obtenerRepositorioPublicoPorId(id);
        setRepo(data);
        const {
          data: { session }
        } = await supabase.auth.getSession();
        const uid = session?.user?.id || null;
        setUserId(uid);
        setEsCreador(Boolean(uid && data?.creador_id && uid === data.creador_id));
        await cargarArchivos(data?.id);
        await cargarRatings(data?.id);
        await cargarColaboradores(data?.id, uid);
        try {
          const fav = await isRepositorioFavorito(data?.id);
          setIsFavorito(Boolean(fav));
        } catch (e) {
          console.warn("Error checking favorite:", e.message);
        }
        await cargarActividad(data?.id);
      } catch (e) {
        setError(e.message);
        setRepo(null);
        setArchivos([]);
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  async function cargarActividad(repoId) {
    if (!repoId) {
      setActividad([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("repositorio_publico_actividad")
        .select("mensaje, fecha, actor_id")
        .eq("repositorio_id", repoId)
        .order("fecha", { ascending: false });
      if (error) throw error;
      setActividad(data || []);
    } catch (e) {
      // no bloquear la vista si no existe la tabla; mostrar vacío
      console.warn("No se pudo cargar actividad de repositorio:", e.message);
      setActividad([]);
    }
  }

  async function publicarAnuncio() {
    if (!repo?.id) return;
    if (!esCreador) return setMensaje("Solo el creador puede publicar anuncios.");
    if (!nuevoAnuncio.trim()) return setMensaje("Escribe un anuncio antes de publicar.");

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const uid = session?.user?.id || null;
      const { error } = await supabase.from("repositorio_publico_actividad").insert({
        repositorio_id: repo.id,
        actor_id: uid,
        mensaje: `ANUNCIO::${nuevoAnuncio.trim()}`
      });
      if (error) throw error;
      setNuevoAnuncio("");
      await cargarActividad(repo.id);
    } catch (e) {
      setMensaje(`Error al publicar anuncio: ${e.message}`);
    }
  }

  const manejarArchivos = files => {
    const archivosValidos = Array.from(files || []).filter(file => file.size <= 20 * 1024 * 1024);
    setArchivosSeleccionados(archivosValidos);
  };

  const manejarDrop = e => {
    e.preventDefault();
    manejarArchivos(e.dataTransfer.files);
  };

  const manejarDragOver = e => e.preventDefault();

  async function manejarSubirArchivos() {
    if (!repo?.id) return;
    if (!esEditor) return setMensaje("Solo el creador o colaboradores pueden subir archivos.");
    if (!archivosSeleccionados.length) return setMensaje("Selecciona archivos primero.");

    setSubiendo(true);
    setMensaje("");
    try {
      for (const archivo of archivosSeleccionados) {
        await subirArchivoRepositorioPublico({ repositorioId: repo.id, archivo });
      }
      setArchivosSeleccionados([]);
      setMensaje(`${archivosSeleccionados.length} archivo(s) subido(s).`);
      await cargarArchivos(repo.id);
    } catch (e) {
      setMensaje(`Error al subir: ${e.message}`);
    } finally {
      setSubiendo(false);
    }
  }

  async function manejarEliminarArchivo(archivo) {
    if (!repo?.id || !archivo?.id) return;
    if (!esEditor) return setMensaje("Solo el creador o colaboradores pueden eliminar archivos.");
    try {
      await eliminarArchivoRepositorioPublico({
        repositorioId: repo.id,
        archivoId: archivo.id,
        path: archivo.path
      });
      await cargarArchivos(repo.id);
    } catch (e) {
      setMensaje(`Error al eliminar: ${e.message}`);
    }
  }

  async function manejarAgregarColaborador() {
    if (!repo?.id) return;
    if (!esCreador) return;
    const correo = emailColaborador.trim();
    if (!correo) return setMensajeColaboradores("Ingresa un correo válido.");
    try {
      await agregarColaboradorPorEmail({ repositorioId: repo.id, email: correo });
      setEmailColaborador("");
      await cargarColaboradores(repo.id, userId);
      setMensajeColaboradores("Colaborador agregado.");
    } catch (e) {
      setMensajeColaboradores(`Error al agregar colaborador: ${e.message}`);
    }
  }

  async function manejarEliminarColaborador(colaborador) {
    if (!repo?.id || !colaborador?.user_id) return;
    if (!esCreador) return;
    try {
      await eliminarColaboradorRepositorioPublico({
        repositorioId: repo.id,
        userId: colaborador.user_id
      });
      await cargarColaboradores(repo.id, userId);
      setMensajeColaboradores("Colaborador eliminado.");
    } catch (e) {
      setMensajeColaboradores(`Error al eliminar colaborador: ${e.message}`);
    }
  }

  async function manejarSalirColaborador() {
    if (!repo?.id) return;
    try {
      await salirRepositorioPublico({ repositorioId: repo.id });
      await cargarColaboradores(repo.id, userId);
      setMensajeColaboradores("Has salido del repositorio.");
    } catch (e) {
      setMensajeColaboradores(`Error al salir: ${e.message}`);
    }
  }

  async function manejarToggleFavorito() {
    if (!repo?.id) return;
    try {
      const res = await toggleFavoritoRepositorio(repo.id);
      setIsFavorito(Boolean(res?.favorito));
      setMensaje(res?.favorito ? "Añadido a favoritos" : "Eliminado de favoritos");
    } catch (e) {
      setMensaje(`Error al cambiar favorito: ${e.message}`);
    }
  }

  async function manejarEliminarRepositorio() {
    if (!repo?.id || !esCreador) return;
    const ok = window.confirm("¿Eliminar este repositorio público? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      await eliminarRepositorioPublico({ repositorioId: repo.id });
      navigate("/grupos");
    } catch (e) {
      setMensaje(`Error al eliminar repositorio: ${e.message}`);
    }
  }

  async function manejarCalificar(event) {
    if (!repo?.id) return;
    if (!userId) {
      setMensaje("Inicia sesion para calificar.");
      return;
    }
    const valor = Number(event.target.value);
    setMiRating(event.target.value);
    if (!valor) return;

    setGuardandoRating(true);
    try {
      await guardarCalificacionRepositorioPublico({ repositorioId: repo.id, rating: valor });
      const promedio = await obtenerPromedioRepositorioPublico({ repositorioId: repo.id });
      setRatingPromedio(promedio?.ratingPromedio || 0);
      setRatingTotal(promedio?.ratingTotal || 0);
      setMensaje("Calificacion guardada.");
    } catch (e) {
      setMensaje(`Error al calificar: ${e.message}`);
    } finally {
      setGuardandoRating(false);
    }
  }

  if (cargando) {
    return (
      <div className="container">
        <div className="card">Cargando repositorio público...</div>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="container">
        <div className="card">
          <strong>Repositorio no encontrado</strong>
          {error && <p>{error}</p>}
          <button className="btn" onClick={() => navigate("/grupos")}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div
        className="group-banner"
        style={{ "--banner-a": "#6c757d", "--banner-b": "#343a40" }}
      >
        <div className="group-banner-content group-banner-single">
          <button
            className="btn arrow-back group-back-btn"
            onClick={() => navigate("/grupos")}
            aria-label="Atrás"
          >
            <svg
              className="arrow-back-icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="group-banner-main">
            <div className="group-banner-title">{repo.titulo}</div>
            <div className="group-banner-subtitle">Repositorio público · {repo.creador_nombre || "Usuario"}</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn" onClick={manejarToggleFavorito} title={isFavorito ? "Quitar favorito" : "Agregar a favoritos"}>
              {isFavorito ? "★ Favorito" : "☆ Favorito"}
            </button>
          </div>
        </div>
      </div>

      <div className="group-tabs">
        <button className={`group-tab ${tabActiva === "info" ? "active" : ""}`} onClick={() => setTabActiva("info")}>
          Info
        </button>
        <button className={`group-tab ${tabActiva === "archivos" ? "active" : ""}`} onClick={() => setTabActiva("archivos")}>
          Archivos
        </button>
        <button className={`group-tab ${tabActiva === "people" ? "active" : ""}`} onClick={() => setTabActiva("people")}>
          Personas
        </button>
      </div>

      {tabActiva === "info" && (
        <div className="group-tab-content" style={{ marginTop: 8 }}>
        <div className="card">
          <strong>{repo.titulo}</strong>
          <div className="label" style={{ marginTop: 8 }}>
            Creador: {repo.creador_nombre || "Usuario"}
          </div>
          <div className="label">
            Fecha de creación: {repo.created_at ? new Date(repo.created_at).toLocaleDateString() : "-"}
          </div>
          <div className="label">
            {ratingTotal
              ? `Calificacion promedio: ${Number(ratingPromedio || 0).toFixed(1)}/5 (${ratingTotal})`
              : "Calificacion promedio: sin calificaciones"}
          </div>
          <div className="label" style={{ marginBottom: 0 }}>
            Este repositorio es público y no está vinculado a un grupo.
          </div>
          <div style={{ marginTop: 8 }}>
            {userId ? (
              <>
                <label className="label">Tu calificacion</label>
                <select
                  className="input"
                  value={miRating}
                  onChange={manejarCalificar}
                  disabled={guardandoRating}
                >
                  <option value="">Selecciona (1-5)</option>
                  {Array.from({ length: 5 }, (_, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {idx + 1}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <div className="label">Inicia sesion para calificar.</div>
            )}
          </div>
          {esCreador && (
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={manejarEliminarRepositorio}>
                Eliminar repositorio
              </button>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="card">
            <strong>Anuncios</strong>
            {esCreador && (
              <div style={{ marginTop: 8 }}>
                <textarea
                  className="input"
                  rows={3}
                  value={nuevoAnuncio}
                  onChange={e => setNuevoAnuncio(e.target.value)}
                  placeholder="Escribe un anuncio para este repositorio público..."
                />
                <div style={{ marginTop: 8 }}>
                  <button className="btn btnPrimary" onClick={publicarAnuncio}>Publicar anuncio</button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              {actividad.length === 0 ? (
                <div className="label">Aún no hay anuncios.</div>
              ) : (
                actividad.map((a, i) => (
                  <div key={`${a.fecha}-${i}`} className="feed-card" style={{ marginBottom: 8 }}>
                    <div className="feed-card-header">
                      <div className="feed-avatar">{(a.actor_id || "U").slice(0,1).toUpperCase()}</div>
                      <div>
                        <div className="feed-author">Anuncio</div>
                        <div className="feed-date">{a.fecha ? new Date(a.fecha).toLocaleString() : ""}</div>
                      </div>
                    </div>
                    <div className="feed-text">{`${a.mensaje || ""}`.replace(/^ANUNCIO::/, "")}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {tabActiva === "archivos" && (
        <div className="group-tab-content" style={{ marginTop: 8 }}>
          {esEditor && (
            <div className="card repo-card" style={{ maxWidth: "none", marginTop: 12 }}>
              <strong className="repo-title">Subir archivos</strong>
              <p className="label repo-subtitle">Máximo 20MB por archivo</p>

              <div className="drop-area" onClick={() => inputRef.current?.click()} onDrop={manejarDrop} onDragOver={manejarDragOver}>
                <div className="drop-content">
                  <p className="repo-hint">
                    {archivosSeleccionados.length > 0
                      ? `${archivosSeleccionados.length} archivo(s) seleccionado(s)`
                      : "Arrastra archivos aquí o haz click para seleccionar"}
                  </p>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={e => manejarArchivos(e.target.files)}
              />

              <div className="repo-actions">
                <button className="btn btnPrimary" onClick={manejarSubirArchivos} disabled={subiendo}>
                  {subiendo ? "Subiendo..." : "Subir al repositorio"}
                </button>
              </div>
              {mensaje && <p className="repo-message">{mensaje}</p>}
            </div>
          )}

        <div className="archivos-grid" style={{ marginTop: 12 }}>
          {archivos.map((file, idx) => {
            const fullPath = file.path;
            const { data } = supabase.storage.from("Flux_repositorioGrupos").getPublicUrl(fullPath);
            const nombre = file.nombre || fullPath?.split("/").pop() || "archivo";
            const extension = nombre.split(".").pop().toLowerCase();
            const icono = extension === "pdf" ? "📄" : extension === "docx" ? "📝" : extension === "png" ? "🖼️" : "📎";
            return (
              <div key={`${file.id || idx}`} className="archivo-card">
                <a href={data.publicUrl} target="_blank" rel="noopener noreferrer" className="archivo-link">
                  <div className="archivo-icon">{icono}</div>
                  <div className="archivo-info">
                    <div className="archivo-nombre">{nombre}</div>
                    <div className="archivo-meta">{file.created_at ? new Date(file.created_at).toLocaleDateString() : ""}</div>
                  </div>
                </a>
                {esEditor && (
                  <button className="btn" style={{ marginTop: 8 }} onClick={() => manejarEliminarArchivo(file)}>
                    Eliminar archivo
                  </button>
                )}
              </div>
            );
          })}
          {!archivos.length && <p className="no-archivos">No hay archivos subidos aún.</p>}
        </div>
        </div>
      )}

      {tabActiva === "people" && (
        <div className="group-tab-content">
          <div className="card">
            <strong>Integrantes</strong>
            {esCreador && (
              <>
                <label className="label" style={{ marginTop: 8 }}>Agregar por correo</label>
                <input
                  className="input"
                  value={emailColaborador}
                  onChange={e => setEmailColaborador(e.target.value)}
                  placeholder="usuario@correo.unimet.edu.ve"
                />
                <div style={{ marginTop: 8 }}>
                  <button className="btn btnPrimary" onClick={manejarAgregarColaborador}>
                    Agregar colaborador
                  </button>
                </div>
              </>
            )}

            <ul className="miembros-scroll" style={{ maxHeight: "none", marginTop: 8 }}>
              {colaboradores.map(c => (
                <li key={`${c.repositorio_id}-${c.user_id}`} className="member-row">
                  <div className="member-item" style={{ cursor: "default" }}>
                    <span className="member-item-name">{c.email || "Colaborador"}</span>
                    <span className="member-item-hint">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>

                  {esCreador && (
                    <button
                      className="btn member-kick"
                      onClick={() => manejarEliminarColaborador(c)}
                    >
                      Quitar
                    </button>
                  )}
                </li>
              ))}
              {colaboradores.length === 0 && (
                <li className="label" style={{ marginTop: 8 }}>Aún no hay colaboradores.</li>
              )}
            </ul>

            {mensajeColaboradores && (
              <p className="repo-message" style={{ marginTop: 8 }}>
                {mensajeColaboradores}
              </p>
            )}

            {!esCreador && esColaborador && (
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={manejarSalirColaborador}>
                  Salir del repositorio
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
