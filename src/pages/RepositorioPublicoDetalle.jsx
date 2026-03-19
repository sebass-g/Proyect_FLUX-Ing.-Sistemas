import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  eliminarRepositorioPublico,
  eliminarArchivoRepositorioPublico,
  actualizarColorRepositorioPublico,
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
import Estrellas from "../components/Estrellas";
import ModalQR from "../components/ModalQR"; 
import { generarResumenRepositorio } from "../servicios/ia.api";
import {
  PALETA_BANNERS,
  guardarColorGuardado,
  obtenerColorEntidad,
  obtenerColorGuardado
} from "../utils/groupColors";
import "../estilos/flux.css";

export default function RepositorioPublicoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); // <- Aquí atrapamos la URL de React
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
  const [colorRepoSeleccionado, setColorRepoSeleccionado] = useState(PALETA_BANNERS[0].id);
  
  // ESTADOS PARA IA Y PREVIEWS (De Enrique)
  const [iaGenerando, setIaGenerando] = useState(false);
  const [iaError, setIaError] = useState("");
  const [iaResumen, setIaResumen] = useState("");
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [previewNombre, setPreviewNombre] = useState("");

  // ESTADOS PARA EL QR Y LA INVITACIÓN (Tuyos)
  const [mostrarQR, setMostrarQR] = useState(false);
  const [mostrarPopUpUnirse, setMostrarPopUpUnirse] = useState(false);

  const inputRef = useRef(null);
  const esEditor = esCreador || esColaborador;
  const [tabActiva, setTabActiva] = useState("info");

  // EFECTO ARREGLADO: Detectar si el usuario escaneó el QR (?invitacion=true)
  useEffect(() => {
    // Usamos location.search en lugar de window.location para que React no se lo salte
    const parametros = new URLSearchParams(location.search);
    if (parametros.get("invitacion") === "true") {
      setMostrarPopUpUnirse(true);
    }
  }, [location]); // <- Dependemos de location para que se ejecute si cambia

  async function cargarArchivos(repoId) {
    if (!repoId) {
      setArchivos([]);
      return;
    }
    const data = await listarArchivosRepositorioPublico({ repositorioId: repoId });
    setArchivos(data);
  }

  async function manejarResumirConIA() {
    setIaError("");
    setIaResumen("");
    setIaGenerando(true);
    try {
      const resumen = await generarResumenRepositorio({
        nombreRepo: repo.titulo,
        archivos
      });
      setIaResumen(resumen);

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from("ia_resumenes").insert({
          user_id: session.user.id,
          repositorio_tipo: "publico",
          repositorio_id: repo.id,
          resumen
        });
      }
    } catch (e) {
      setIaError(e.message);
    } finally {
      setIaGenerando(false);
    }
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
    if (!repoId || !uid) {
      setColaboradores([]);
      setEsColaborador(false);
      return;
    }
    try {
      const data = await listarColaboradoresRepositorioPublico({ repositorioId: repoId });
      setColaboradores(data);
      setEsColaborador(data.some(c => c.user_id === uid));
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
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id || null;
        setUserId(uid);
        setEsCreador(Boolean(uid && data?.creador_id && uid === data.creador_id));
        
        await Promise.all([
          cargarArchivos(data?.id),
          cargarRatings(data?.id),
          cargarColaboradores(data?.id, uid),
          cargarActividad(data?.id)
        ]);

        try {
          const fav = await isRepositorioFavorito(data?.id);
          setIsFavorito(Boolean(fav));
        } catch (e) {
          console.warn("Error checking favorite:", e.message);
        }
      } catch (e) {
        setError(e.message);
        setRepo(null);
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  async function cargarActividad(repoId) {
    if (!repoId) return;
    try {
      const { data, error } = await supabase
        .from("repositorio_publico_actividad")
        .select("mensaje, fecha, actor_id")
        .eq("repositorio_id", repoId)
        .order("fecha", { ascending: false });
      if (error) throw error;
      setActividad(data || []);
    } catch (e) {
      console.warn("No se pudo cargar actividad:", e.message);
    }
  }

  async function publicarAnuncio() {
    if (!repo?.id || !esCreador || !nuevoAnuncio.trim()) return;
    try {
      const { error } = await supabase.from("repositorio_publico_actividad").insert({
        repositorio_id: repo.id,
        actor_id: userId,
        mensaje: `ANUNCIO::${nuevoAnuncio.trim()}`
      });
      if (error) throw error;
      setNuevoAnuncio("");
      await cargarActividad(repo.id);
    } catch (e) {
      setMensaje(`Error: ${e.message}`);
    }
  }

  const manejarArchivos = files => {
    const tiposPermitidos = [
      "application/pdf",
      "image/png",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    const archivos = Array.from(files || []);
    const archivosValidos = archivos.filter(
      file => tiposPermitidos.includes(file.type) && file.size <= 20 * 1024 * 1024
    );
    if (archivos.length && !archivosValidos.length) {
      setMensaje("Solo se permiten archivos PDF, DOCX o PNG de hasta 20MB.");
    }
    setArchivosSeleccionados(archivosValidos);
  };

  const manejarDragOver = (e) => {
    e.preventDefault();
  };

  const manejarDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      manejarArchivos(e.dataTransfer.files);
    }
  };

  async function manejarSubirArchivos() {
    if (!repo?.id || !esEditor || !archivosSeleccionados.length) return;
    setSubiendo(true);
    try {
      for (const archivo of archivosSeleccionados) {
        await subirArchivoRepositorioPublico({ repositorioId: repo.id, archivo });
      }
      setArchivosSeleccionados([]);
      await cargarArchivos(repo.id);
      setMensaje("¡Subida completada!");
    } catch (e) {
      setMensaje(`Error: ${e.message}`);
    } finally {
      setSubiendo(false);
    }
  }

  async function manejarEliminarArchivo(archivo) {
    if (!repo?.id || !archivo?.id || !esEditor) return;
    try {
      await eliminarArchivoRepositorioPublico({
        repositorioId: repo.id,
        archivoId: archivo.id,
        path: archivo.path
      });
      await cargarArchivos(repo.id);
    } catch (e) {
      setMensaje(`Error: ${e.message}`);
    }
  }

  function abrirPreview(url, extension, nombre) {
    setPreviewUrl(url);
    setPreviewType(extension === "pdf" ? "pdf" : "image");
    setPreviewNombre(nombre || "");
    setMostrarPreview(true);
  }

  function cerrarPreview() {
    setMostrarPreview(false);
    setPreviewUrl("");
    setPreviewType("");
    setPreviewNombre("");
  }

  async function manejarAgregarColaborador() {
    const correo = emailColaborador.trim();
    if (!repo?.id || !esCreador || !correo) return;
    try {
      await agregarColaboradorPorEmail({ repositorioId: repo.id, email: correo });
      setEmailColaborador("");
      await cargarColaboradores(repo.id, userId);
    } catch (e) {
      setMensajeColaboradores(`Error: ${e.message}`);
    }
  }

  async function manejarUnirsePorInvitacion() {
    if (!repo?.id) return;
    if (!userId) {
      alert("Debes iniciar sesión para poder unirte a este repositorio.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const emailUsuario = session?.user?.email;

      const { error } = await supabase
        .from("repositorio_publico_colaboradores") 
        .insert({
          repositorio_id: repo.id,
          user_id: userId,
          email: emailUsuario
        });

      if (error && error.code !== '23505') throw error;

      setMostrarPopUpUnirse(false); 
      // Limpiamos la URL al terminar de unirse
      window.history.replaceState(null, "", location.pathname); 
      await cargarColaboradores(repo.id, userId); 
      setTabActiva("archivos"); 
      setMensajeColaboradores("¡Te has unido exitosamente!");

    } catch (e) {
      alert(`Aviso: ${e.message}`);
      setMostrarPopUpUnirse(false);
      window.history.replaceState(null, "", location.pathname);
    }
  }

  async function manejarCalificar(valorNota) {
    if (!repo?.id || !userId) return;
    setMiRating(valorNota);
    setGuardandoRating(true);
    try {
      await guardarCalificacionRepositorioPublico({ repositorioId: repo.id, rating: Number(valorNota) });
      await cargarRatings(repo.id);
    } finally {
      setGuardandoRating(false);
    }
  }

  async function manejarToggleFavorito() {
    if (!repo?.id) return;
    try {
      await toggleFavoritoRepositorio(repo.id);
      setIsFavorito(!isFavorito);
    } catch (error) {
      console.error("Error al togglear favorito:", error);
    }
  }

  async function manejarEliminarRepositorio() {
    if (!repo?.id || !esCreador) return;
    if (window.confirm("¿Seguro que deseas eliminar este repositorio?")) {
      try {
        await eliminarRepositorioPublico(repo.id);
        navigate("/grupos");
      } catch (error) {
        alert("Error al eliminar: " + error.message);
      }
    }
  }

  async function manejarGuardarColorRepositorio() {
    if (!repo?.id || !esCreador) return;
    try {
      await actualizarColorRepositorioPublico({ repositorioId: repo.id, colorId: colorRepoSeleccionado });
      alert("Color guardado exitosamente");
    } catch (error) {
      alert("Error al actualizar color: " + error.message);
    }
  }

  if (cargando) return <div className="container"><div className="card">Cargando...</div></div>;
  if (!repo) return <div className="container"><div className="card">No encontrado</div></div>;

  const colorRepo = obtenerColorEntidad({
    tipo: "repo_publico",
    entidadId: repo.id,
    identificador: repo.id || repo.titulo || "",
    colorId: repo.color_id || ""
  });

  return (
    <div className="container">
      {/* Banner Superior */}
      <div className="group-banner" style={{ "--banner-a": colorRepo?.a || "#6c757d", "--banner-b": colorRepo?.b || "#343a40" }}>
        <div className="group-banner-content group-banner-single">
          <button className="btn arrow-back group-back-btn" onClick={() => navigate("/grupos")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:20}}><path d="M15 6L9 12L15 18" /></svg>
          </button>
          <div className="group-banner-main">
            <div className="group-banner-title">{repo.titulo}</div>
            <div className="group-banner-subtitle">Público · {repo.creador_nombre}</div>
          </div>

          <div className="group-banner-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn" onClick={() => setMostrarQR(true)}>📱 QR</button>
            <button className="btn" onClick={manejarToggleFavorito} title={isFavorito ? "Quitar favorito" : "Agregar a favoritos"}>
              {isFavorito ? "⭐" : "☆"}
            </button>
          </div>
        </div>
      </div>

      <div className="group-tabs">
        <button className={`group-tab ${tabActiva === "info" ? "active" : ""}`} onClick={() => setTabActiva("info")}>Info</button>
        <button className={`group-tab ${tabActiva === "archivos" ? "active" : ""}`} onClick={() => setTabActiva("archivos")}>Archivos</button>
        <button className={`group-tab ${tabActiva === "people" ? "active" : ""}`} onClick={() => setTabActiva("people")}>Personas</button>
      </div>

      {/* Contenido Dinámico */}
      {tabActiva === "info" && (
        <div className="group-tab-content">
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
                ? `Calificación promedio: ${Number(ratingPromedio || 0).toFixed(1)}/5 (${ratingTotal} votos)`
                : "Calificación promedio: sin calificaciones"}
            </div>
            <div className="label" style={{ marginBottom: 0 }}>
              Este repositorio es público y no está vinculado a un grupo.
            </div>
            
            <div style={{ marginTop: 20, borderTop: "1px solid #eee", paddingTop: 10 }}>
              {userId ? (
                <>
                  <Estrellas alCalificar={manejarCalificar} />
                  {guardandoRating && <p style={{fontSize:"12px", color:"#999"}}>Guardando...</p>}
                </>
              ) : (
                <div className="label">Inicia sesión para calificar.</div>
              )}
            </div>

            {/* Botón IA */}
            <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 14 }}>
              <button
                className="btn btnPrimary"
                onClick={manejarResumirConIA}
                disabled={iaGenerando}
              >
                {iaGenerando ? "Generando resumen..." : "✨ Resumir con IA"}
              </button>
              {iaError && (
                <div className="alert alert-error" style={{ marginTop: 10 }}>
                  {iaError}
                </div>
              )}
              {iaResumen && (
                <div className="ia-resultado" style={{ marginTop: 14 }}>
                  <strong style={{ display: "block", marginBottom: 8 }}>Resumen IA</strong>
                  <pre className="ia-pre">{iaResumen}</pre>
                </div>
              )}
            </div>

            {esCreador && (
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={manejarEliminarRepositorio}>
                  Eliminar repositorio
                </button>
              </div>
            )}

            {esCreador && (
              <div style={{ marginTop: 12 }}>
                <label className="label">Color del repositorio</label>
                <div className="color-picker-row">
                  {PALETA_BANNERS.map(color => (
                    <button
                      key={color.id}
                      type="button"
                      className={`color-swatch ${colorRepoSeleccionado === color.id ? "selected" : ""}`}
                      style={{ background: `linear-gradient(135deg, ${color.a}, ${color.b})` }}
                      onClick={() => setColorRepoSeleccionado(color.id)}
                      aria-label={`Color ${color.id}`}
                    />
                  ))}
                </div>
                <button className="btn btnPrimary" onClick={manejarGuardarColorRepositorio} style={{marginTop: 10}}>
                  Guardar color
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
        <div className="group-tab-content">
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
                  <small className="label">PDF, DOCX, PNG hasta 20MB</small>
                </div>
              </div>
              <input ref={inputRef} type="file" multiple hidden onChange={e => manejarArchivos(e.target.files)} />
              <button className="btn btnPrimary" onClick={manejarSubirArchivos} disabled={subiendo} style={{marginTop:10}}>
                {subiendo ? "Subiendo..." : "Subir ahora"}
              </button>
            </div>
          )}

          <div className="archivos-grid" style={{ marginTop: 12 }}>
            {archivos.map((file, idx) => {
              const fullPath = file.path;
              const { data } = supabase.storage.from("Flux_repositorioGrupos").getPublicUrl(fullPath);
              const pubUrl = data?.publicUrl || data?.publicURL || data?.publicurl || "";
              const nombre = file.nombre || fullPath?.split("/").pop() || "archivo";
              const extension = nombre.split(".").pop().toLowerCase();
              const icono = extension === "pdf" ? "📄" : extension === "docx" ? "📝" : extension === "png" ? "🖼️" : "📎";
              return (
                <div key={`${file.id || idx}`} className="archivo-card">
                  <a href={pubUrl} target="_blank" rel="noopener noreferrer" className="archivo-link">
                    <div className="archivo-icon">{icono}</div>
                    <div className="archivo-info">
                      <div className="archivo-nombre">{nombre}</div>
                      <div className="archivo-meta">{file.created_at ? new Date(file.created_at).toLocaleDateString() : ""}</div>
                    </div>
                  </a>

                  <div className="archivo-actions">
                    {esEditor && (
                      <button type="button" className="btn" onClick={() => manejarEliminarArchivo(file)}>
                        Eliminar archivo
                      </button>
                    )}

                    {(extension === "pdf" || extension === "png") && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => abrirPreview(pubUrl, extension, nombre)}
                      >
                        Previsualizar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tabActiva === "people" && (
        <div className="group-tab-content">
          <div className="card">
            <strong>Integrantes</strong>
            <ul className="miembros-scroll">
              {colaboradores.map(c => (
                <li key={c.user_id} className="member-row">
                  <span className="member-item-name">{c.email}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* COMPONENTE MODAL DE PREVIEW */}
      {mostrarPreview && (
        <div
          className="preview-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 20
          }}
          onClick={cerrarPreview}
        >
          <div
            className="preview-content"
            style={{
              background: "#fff",
              borderRadius: 8,
              maxWidth: "100%",
              width: "900px",
              maxHeight: "90%",
              overflow: "auto",
              position: "relative",
              padding: 12
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={cerrarPreview}
              style={{ position: "absolute", right: 8, top: 8 }}
              className="btn"
            >
              Cerrar
            </button>
            <div style={{ marginTop: 32 }}>
              <strong style={{ display: "block", marginBottom: 8 }}>{previewNombre}</strong>
              {previewType === "pdf" ? (
                <iframe src={previewUrl} title={previewNombre} style={{ width: "100%", height: "70vh", border: "none" }} />
              ) : (
                <img src={previewUrl} alt={previewNombre} style={{ maxWidth: "100%", maxHeight: "70vh" }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* COMPONENTE MODAL DE QR Y POPUP INVITACIÓN */}
      <ModalQR 
        isOpen={mostrarQR} 
        onClose={() => setMostrarQR(false)} 
        // Aquí también usamos location.pathname para más seguridad
        url={`${window.location.origin}${location.pathname}?invitacion=true`} 
        titulo={repo.titulo} 
      />

      {mostrarPopUpUnirse && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ backgroundColor: "white", padding: 30, borderRadius: 12, textAlign: "center", maxWidth: 350 }}>
            <h3>¡Invitación Recibida!</h3>
            <p>¿Quieres unirte como colaborador a <b>{repo.titulo}</b>?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
              <button onClick={() => { setMostrarPopUpUnirse(false); window.history.replaceState(null, "", location.pathname); }} className="btn">Cancelar</button>
              <button onClick={manejarUnirsePorInvitacion} className="btn btnPrimary" style={{background: "#007bff", color: "white"}}>Sí, unirme</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}