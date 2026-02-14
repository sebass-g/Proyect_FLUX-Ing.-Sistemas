import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  actualizarVisibilidadGrupo,
  actualizarNombreGrupo,
  abandonarGrupo,
  eliminarArchivoGrupo,
  eliminarGrupo,
  expulsarMiembro,
  obtenerVistaPreviaPorCodigo
} from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";
import { obtenerColorGrupo } from "../utils/groupColors";
import "../estilos/flux.css";

export default function GrupoDetalle() {
  const { codigo } = useParams();
  const navigate = useNavigate();

  const [grupo, setGrupo] = useState(null);
  const [cargandoGrupo, setCargandoGrupo] = useState(true);
  const [userId, setUserId] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);

  const [tabActiva, setTabActiva] = useState("stream");
  const [nuevoNombreGrupo, setNuevoNombreGrupo] = useState("");
  const [nuevoAnuncio, setNuevoAnuncio] = useState("");
  const [guardandoVisibilidad, setGuardandoVisibilidad] = useState(false);
  const [error, setError] = useState("");

  const [archivosSeleccionados, setArchivosSeleccionados] = useState([]);
  const [archivosSubidos, setArchivosSubidos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [mensajeSubida, setMensajeSubida] = useState("");
  const inputRef = useRef(null);

  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [miembroActivo, setMiembroActivo] = useState(null);
  const [perfilMiembro, setPerfilMiembro] = useState(null);
  const [avatarMiembroUrl, setAvatarMiembroUrl] = useState("");
  const [avatarFallbackTried, setAvatarFallbackTried] = useState(false);
  const [horarioMiembro, setHorarioMiembro] = useState([]);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState("");

  const DIAS = [
    { value: 1, label: "Lun" },
    { value: 2, label: "Mar" },
    { value: 3, label: "Mie" },
    { value: 4, label: "Jue" },
    { value: 5, label: "Vie" },
    { value: 6, label: "Sab" },
    { value: 0, label: "Dom" }
  ];

  const puedePublicarAnuncio = useMemo(
    () => Boolean(userId && grupo?.creadorId && userId === grupo.creadorId),
    [userId, grupo]
  );

  const anuncios = useMemo(() => {
    const items = grupo?.actividad || [];
    return items
      .filter(a => `${a.mensaje || ""}`.startsWith("ANUNCIO::"))
      .map(a => ({
        ...a,
        texto: `${a.mensaje || ""}`.replace("ANUNCIO::", "")
      }));
  }, [grupo]);

  const streamItems = useMemo(() => {
    const items = grupo?.actividad || [];

    return items
      .filter(a => {
        const msg = `${a.mensaje || ""}`;
        return (
          msg.startsWith("ANUNCIO::") ||
          msg.startsWith("ARCHIVO::") ||
          msg.startsWith("RENOMBRE::") ||
          msg.startsWith("VISIBILIDAD::") ||
          msg.includes("se ha unido") ||
          msg.includes("creo el grupo") ||
          msg.includes("creó el grupo")
        );
      })
      .map(a => {
        const msg = `${a.mensaje || ""}`;
        const autorPorId = grupo?.miembros?.find(m => m.user_id === a.actor_id)?.nombre;

        if (msg.startsWith("ANUNCIO::")) {
          return {
            tipo: "anuncio",
            autor: autorPorId || "Creador",
            fecha: a.fecha,
            texto: msg.replace("ANUNCIO::", "")
          };
        }

        if (msg.startsWith("ARCHIVO::")) {
          return {
            tipo: "archivo",
            autor: autorPorId || "Sistema",
            fecha: a.fecha,
            texto: msg.replace("ARCHIVO::", "")
          };
        }

        if (msg.startsWith("RENOMBRE::")) {
          return {
            tipo: "renombre",
            autor: autorPorId || "Sistema",
            fecha: a.fecha,
            texto: msg.replace("RENOMBRE::", "")
          };
        }

        if (msg.startsWith("VISIBILIDAD::")) {
          return {
            tipo: "visibilidad",
            autor: autorPorId || "Sistema",
            fecha: a.fecha,
            texto: msg.replace("VISIBILIDAD::", "")
          };
        }

        const autorPorTexto = msg.match(/^(.+?)\sse ha unido/i)?.[1]?.trim();
        const autor = autorPorId || autorPorTexto || "Sistema";
        if (msg.includes("se ha unido")) {
          return {
            tipo: "union",
            autor,
            fecha: a.fecha,
            texto: `${autor} se unió al grupo`
          };
        }

        return {
          tipo: "sistema",
          autor,
          fecha: a.fecha,
          texto: msg
        };
      });
  }, [grupo]);

  async function recargarGrupo() {
    if (!codigo) return;
    const g = await obtenerVistaPreviaPorCodigo(codigo);
    setGrupo(g);
    setNuevoNombreGrupo(g?.nombre || "");
    const miembro = g?.miembros?.find(m => m.user_id === userId);
    setEsAdmin(Boolean(miembro?.is_admin));
  }

  async function listarArchivos() {
    try {
      if (!grupo?.id) {
        setArchivosSubidos([]);
        return;
      }
      const { data, error: listError } = await supabase
        .from("grupo_archivos")
        .select("path, nombre, created_at")
        .eq("grupo_id", grupo.id)
        .order("created_at", { ascending: false });
      if (listError) throw listError;
      setArchivosSubidos(data || []);
    } catch (e) {
      setMensajeSubida(`Error al listar archivos: ${e.message}`);
    }
  }

  useEffect(() => {
    (async () => {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();
      if (sessionError) {
        setError("No se pudo leer la sesión.");
        return;
      }
      setUserId(session?.user?.id || null);
      setAvatarUrl(session?.user?.user_metadata?.avatar_url?.trim() || "");
      setDisplayName(session?.user?.user_metadata?.display_name?.trim() || "");
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!codigo) {
        setGrupo(null);
        setCargandoGrupo(false);
        return;
      }
      setCargandoGrupo(true);
      await recargarGrupo();
      await listarArchivos();
      setCargandoGrupo(false);
    })();
  }, [codigo, userId]);

  const manejarArchivos = files => {
    const archivosValidos = Array.from(files).filter(file => {
      const tipos = [
        "application/pdf",
        "image/png",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];
      return tipos.includes(file.type) && file.size <= 20 * 1024 * 1024;
    });
    setArchivosSeleccionados(archivosValidos);
  };

  const manejarDrop = e => {
    e.preventDefault();
    manejarArchivos(e.dataTransfer.files);
  };

  const manejarDragOver = e => e.preventDefault();

  async function subirArchivos() {
    if (!archivosSeleccionados.length) {
      setMensajeSubida("Selecciona archivos primero");
      return;
    }

    setSubiendo(true);
    setMensajeSubida("");

    try {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const uploaderId = session?.user?.id || null;

      for (const archivo of archivosSeleccionados) {
        const safeName = archivo.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `archivos/${codigo}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("Flux_repositorioGrupos")
          .upload(path, archivo);
        if (uploadError) throw uploadError;

        if (grupo?.id) {
          const { error: metaError } = await supabase.from("grupo_archivos").insert({
            grupo_id: grupo.id,
            path,
            nombre: archivo.name,
            mime_type: archivo.type,
            size_bytes: archivo.size,
            uploader_id: uploaderId
          });
          if (metaError) throw metaError;
        }
      }

      setMensajeSubida(`${archivosSeleccionados.length} archivo(s) subido(s) exitosamente.`);
      setArchivosSeleccionados([]);
      if (grupo?.id && userId) {
        await supabase.from("grupo_actividad").insert({
          grupo_id: grupo.id,
          actor_id: userId,
          mensaje: `ARCHIVO::${displayName || "Usuario"} subió ${archivosSeleccionados.length} archivo(s).`
        });
      }
      await recargarGrupo();
      await listarArchivos();
    } catch (e) {
      setMensajeSubida(`Error al subir: ${e.message}`);
    } finally {
      setSubiendo(false);
    }
  }

  async function manejarEliminarArchivo(fullPath) {
    if (!grupo) return;
    const { error: removeError } = await supabase.storage
      .from("Flux_repositorioGrupos")
      .remove([fullPath]);
    if (removeError && !`${removeError.message}`.includes("22P02")) {
      setMensajeSubida(`Error al eliminar archivo: ${removeError.message}`);
      return;
    }

    await eliminarArchivoGrupo({ grupoId: grupo.id, path: fullPath });
    if (userId) {
      await supabase.from("grupo_actividad").insert({
        grupo_id: grupo.id,
        actor_id: userId,
        mensaje: `ARCHIVO::${displayName || "Usuario"} eliminó un archivo del grupo.`
      });
    }
    await recargarGrupo();
    await listarArchivos();
  }

  async function publicarAnuncio() {
    setError("");
    if (!grupo?.id) return;
    if (!puedePublicarAnuncio) {
      setError("Solo el creador del grupo puede publicar anuncios.");
      return;
    }
    if (!nuevoAnuncio.trim()) {
      setError("Escribe un anuncio antes de publicar.");
      return;
    }

    const { error: insertError } = await supabase.from("grupo_actividad").insert({
      grupo_id: grupo.id,
      actor_id: userId,
      mensaje: `ANUNCIO::${nuevoAnuncio.trim()}`
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNuevoAnuncio("");
    await recargarGrupo();
  }

  async function manejarGuardarNombre() {
    if (!grupo) return;
    if (!nuevoNombreGrupo.trim()) return;
    await actualizarNombreGrupo({
      grupoId: grupo.id,
      nombre: nuevoNombreGrupo,
      actorId: userId,
      actorNombre: displayName,
      nombreAnterior: grupo.nombre
    });
    setGrupo(prev => ({ ...prev, nombre: nuevoNombreGrupo.trim() }));
    await recargarGrupo();
  }

  async function manejarCambiarVisibilidad(esPublico) {
    if (!grupo || !esAdmin) return;
    setError("");
    setGuardandoVisibilidad(true);
    try {
      await actualizarVisibilidadGrupo({
        grupoId: grupo.id,
        esPublico,
        actorId: userId,
        actorNombre: displayName
      });
      await recargarGrupo();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoVisibilidad(false);
    }
  }

  async function manejarExpulsar(miembroId) {
    if (!grupo) return;
    await expulsarMiembro({ grupoId: grupo.id, miembroId });
    await recargarGrupo();
  }

  async function manejarEliminarGrupo() {
    if (!grupo) return;
    const ok = window.confirm("Eliminar este grupo? Esta acción no se puede deshacer.");
    if (!ok) return;
    await eliminarGrupo({ grupoId: grupo.id });
    navigate("/grupos");
  }

  async function manejarAbandonarGrupo() {
    if (!grupo) return;
    const ok = window.confirm("Abandonar este grupo? Si eres el último miembro, se eliminará.");
    if (!ok) return;
    await abandonarGrupo({ grupoId: grupo.id });
    navigate("/grupos");
  }

  const buscarAvatarPorCarpeta = async miembroId => {
    const { data: files } = await supabase.storage
      .from("Flux_repositorioGrupos")
      .list(`avatars/${miembroId}`, {
        limit: 1,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" }
      });

    const file = (files || [])[0];
    if (!file) return "";

    const { data: urlData } = supabase.storage
      .from("Flux_repositorioGrupos")
      .getPublicUrl(`avatars/${miembroId}/${file.name}`);

    return urlData?.publicUrl || "";
  };

  const cargarPerfilMiembro = async miembro => {
    if (!miembro?.user_id) return;
    setMiembroActivo(miembro);
    setPerfilMiembro(null);
    setHorarioMiembro([]);
    setAvatarMiembroUrl("");
    setAvatarFallbackTried(false);
    setErrorPerfil("");
    setCargandoPerfil(true);
    setMostrarPerfil(true);

    let perfil = null;
    const { data: perfilData, error: perfilError } = await supabase
      .from("profiles")
      .select("nombre, apellido, career")
      .eq("id", miembro.user_id)
      .maybeSingle();
    if (perfilError) {
      setErrorPerfil("No se pudo cargar el perfil.");
    } else {
      perfil = perfilData;
    }

    const { data: bloquesData, error: bloquesError } = await supabase
      .from("bloques_horario")
      .select("id, day_of_week, start_time, end_time, type")
      .eq("user_id", miembro.user_id);

    if (bloquesError) {
      setErrorPerfil("No se pudo cargar el horario del miembro.");
    }

    const { data: avatarData } = supabase.storage
      .from("Flux_repositorioGrupos")
      .getPublicUrl(`avatars/${miembro.user_id}`);

    setAvatarMiembroUrl(avatarData?.publicUrl || "");
    setPerfilMiembro(perfil);
    setHorarioMiembro(
      (bloquesData || []).map(b => ({
        id: b.id,
        dayOfWeek: b.day_of_week,
        startTime: b.start_time,
        endTime: b.end_time,
        type: b.type || ""
      }))
    );
    setCargandoPerfil(false);
  };

  if (cargandoGrupo) {
    return (
      <div className="container">
        <div className="card">Cargando grupo...</div>
      </div>
    );
  }

  if (!grupo) {
    return (
      <div className="container">
        <div className="card">
          <strong>Grupo no encontrado</strong>
          <p>Verifique el código e intente nuevamente.</p>
          <button className="btn arrow-back" onClick={() => navigate("/grupos")} aria-label="Atrás">
            <svg
              className="arrow-back-icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M15 6L9 12L15 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const colorGrupo = obtenerColorGrupo(grupo.codigo || grupo.nombre || "");
  return (
    <div className="container">
      <div
        className="group-banner"
        style={{ "--banner-a": colorGrupo.a, "--banner-b": colorGrupo.b }}
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
              <path
                d="M15 6L9 12L15 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="group-banner-main">
            <div className="group-banner-title">{grupo.nombre}</div>
            <div className="group-banner-subtitle">Código: {grupo.codigo}</div>
          </div>

          <button className="avatar-button home-avatar-lg" onClick={() => navigate("/perfil/editar")}>
            {avatarUrl ? (
              <img className="avatar-img" src={avatarUrl} alt="Perfil" />
            ) : (
              <div className="avatar-fallback">
                {(displayName || "U")
                  .split(" ")
                  .map(p => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="group-tabs">
        <button className={`group-tab ${tabActiva === "stream" ? "active" : ""}`} onClick={() => setTabActiva("stream")}>Stream</button>
        <button className={`group-tab ${tabActiva === "archivos" ? "active" : ""}`} onClick={() => setTabActiva("archivos")}>Archivos</button>
        <button className={`group-tab ${tabActiva === "people" ? "active" : ""}`} onClick={() => setTabActiva("people")}>People</button>
      </div>

      {tabActiva === "stream" && (
        <div className="group-tab-content">
          {esAdmin && (
            <div className="card">
              <strong>Visibilidad del repositorio</strong>
              <div className="label" style={{ marginTop: 6 }}>
                Cuando está en público, aparece en el buscador de repositorios.
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(grupo.esPublico)}
                  disabled={guardandoVisibilidad}
                  onChange={e => manejarCambiarVisibilidad(e.target.checked)}
                />
                <span>Repositorio público</span>
              </label>
            </div>
          )}

          {puedePublicarAnuncio && (
            <div className="card">
              <strong>Nuevo anuncio</strong>
              <textarea
                className="input"
                rows={4}
                value={nuevoAnuncio}
                onChange={e => setNuevoAnuncio(e.target.value)}
                placeholder="Escribe un anuncio para los integrantes..."
              />
              <button className="btn btnPrimary" onClick={publicarAnuncio}>Publicar anuncio</button>
            </div>
          )}

          <div className="group-feed">
            {streamItems.map((item, i) => {
              return (
                <article key={`${item.fecha}-${i}`} className="feed-card">
                  <div className="feed-card-header">
                    <div className="feed-avatar">{item.autor.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <div className="feed-author">
                        {item.autor}
                        {item.tipo === "union" ? " · Se unió" : ""}
                      </div>
                      <div className="feed-date">{new Date(item.fecha).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="feed-text">{item.texto}</div>
                </article>
              );
            })}
            {streamItems.length === 0 && (
              <div className="card">
                <div className="label" style={{ marginBottom: 0 }}>
                  Aún no hay actividad en el stream.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tabActiva === "archivos" && (
        <div className="group-tab-content">
          <div className="card repo-card" style={{ maxWidth: "none" }}>
            <strong className="repo-title">Subir archivos</strong>
            <p className="label repo-subtitle">PDF, DOCX, PNG (Máx. 20MB)</p>

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

            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.png,.docx"
              style={{ display: "none" }}
              onChange={e => manejarArchivos(e.target.files)}
            />

            {archivosSeleccionados.length > 0 && (
              <ul className="repo-files">
                {archivosSeleccionados.map((file, idx) => (
                  <li key={idx} className="label repo-file">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </li>
                ))}
              </ul>
            )}

            <div className="repo-actions">
              <button className="btn btnPrimary" onClick={subirArchivos} disabled={subiendo}>
                {subiendo ? "Subiendo..." : "Subir al repositorio"}
              </button>
              <button className="btn" onClick={listarArchivos}>Refrescar archivos</button>
            </div>

            {mensajeSubida && <p className="repo-message">{mensajeSubida}</p>}
          </div>

          <div className="archivos-grid">
            {archivosSubidos.map((file, idx) => {
              const fullPath = file.path;
              const { data } = supabase.storage.from("Flux_repositorioGrupos").getPublicUrl(fullPath);
              const nombre = file.nombre || fullPath?.split("/").pop() || "archivo";
              const extension = nombre.split(".").pop().toLowerCase();
              const icono = extension === "pdf" ? "📄" : extension === "docx" ? "📝" : extension === "png" ? "🖼️" : "📎";

              return (
                <div key={idx} className="archivo-card">
                  <a href={data.publicUrl} target="_blank" rel="noopener noreferrer" className="archivo-link">
                    <div className="archivo-icon">{icono}</div>
                    <div className="archivo-info">
                      <div className="archivo-nombre">{nombre}</div>
                      <div className="archivo-meta">
                        {file.created_at ? new Date(file.created_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </a>
                  {esAdmin && (
                    <button className="btn" style={{ marginTop: 8 }} onClick={() => manejarEliminarArchivo(fullPath)}>
                      Eliminar archivo
                    </button>
                  )}
                </div>
              );
            })}
            {!archivosSubidos.length && <p className="no-archivos">No hay archivos subidos aún.</p>}
          </div>
        </div>
      )}

      {tabActiva === "people" && (
        <div className="group-tab-content">
          <div className="card">
            <strong>Integrantes</strong>
            <ul className="miembros-scroll" style={{ maxHeight: "none" }}>
              {grupo.miembros.map(m => (
                <li key={m.id} className="member-row">
                  <button className="member-item" onClick={() => cargarPerfilMiembro(m)}>
                    <span className="member-item-name">
                      {m.nombre}
                      {m.is_admin ? " (admin)" : ""}
                    </span>
                    <span className="member-item-hint">Ver perfil</span>
                  </button>

                  {esAdmin && m.user_id !== userId && (
                    <button
                      className="btn member-kick"
                      onClick={e => {
                        e.stopPropagation();
                        manejarExpulsar(m.id);
                      }}
                    >
                      Expulsar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {mostrarPerfil && (
        <div className="modal-overlay" onClick={() => setMostrarPerfil(false)}>
          <div className="modal-content member-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Perfil del integrante</h3>
              <button className="modal-close" onClick={() => setMostrarPerfil(false)}>✕</button>
            </div>
            <div className="modal-body">
              {cargandoPerfil && <div className="card" style={{ margin: 0 }}><strong>Cargando perfil...</strong></div>}

              {!cargandoPerfil && (
                <div className="member-card">
                  <div className="member-info">
                    <div className="member-name">
                      {miembroActivo?.nombre || "Miembro"}
                      {miembroActivo?.is_admin ? " (admin)" : ""}
                    </div>
                    <div className="member-field">
                      <span className="label">Nombre</span>
                      <div>{(perfilMiembro?.nombre || "-")} {(perfilMiembro?.apellido || "")}</div>
                    </div>
                    <div className="member-field">
                      <span className="label">Carrera</span>
                      <div>{perfilMiembro?.career || "No especificada"}</div>
                    </div>
                    {errorPerfil && <div className="alert" style={{ marginTop: 8 }}>{errorPerfil}</div>}
                  </div>

                  <div className="member-avatar">
                    {avatarMiembroUrl ? (
                      <img
                        className="member-avatar-img"
                        src={avatarMiembroUrl}
                        alt=""
                        onError={async () => {
                          if (avatarFallbackTried) {
                            setAvatarMiembroUrl("");
                            return;
                          }
                          setAvatarFallbackTried(true);
                          const fallback = await buscarAvatarPorCarpeta(miembroActivo?.user_id);
                          setAvatarMiembroUrl(fallback);
                        }}
                      />
                    ) : (
                      <div className="member-avatar-fallback">
                        {(miembroActivo?.nombre || "U")
                          .split(" ")
                          .map(p => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!cargandoPerfil && (
                <div className="member-schedule">
                  <strong>Horario</strong>
                  {horarioMiembro.length === 0 ? (
                    <div className="label" style={{ marginTop: 8 }}>Este miembro aún no tiene bloques guardados.</div>
                  ) : (
                    <div className="schedule-list">
                      {horarioMiembro
                        .slice()
                        .sort((a, b) =>
                          a.dayOfWeek === b.dayOfWeek
                            ? a.startTime.localeCompare(b.startTime)
                            : a.dayOfWeek - b.dayOfWeek
                        )
                        .map(b => (
                          <div key={b.id} className="schedule-item">
                            <div>
                              <strong>{DIAS.find(d => d.value === b.dayOfWeek)?.label}</strong> {b.startTime} - {b.endTime}
                              {b.type ? ` · ${b.type}` : ""}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert">{error}</div>}
    </div>
  );
}
