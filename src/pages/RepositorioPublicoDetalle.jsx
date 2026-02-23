import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  eliminarRepositorioPublico,
  eliminarArchivoRepositorioPublico,
  guardarCalificacionRepositorioPublico,
  listarArchivosRepositorioPublico,
  obtenerMiCalificacionRepositorioPublico,
  obtenerPromedioRepositorioPublico,
  obtenerRepositorioPublicoPorId,
  subirArchivoRepositorioPublico
} from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";
import "../estilos/flux.css";

export default function RepositorioPublicoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [repo, setRepo] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [archivosSeleccionados, setArchivosSeleccionados] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [esCreador, setEsCreador] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);
  const [ratingPromedio, setRatingPromedio] = useState(0);
  const [ratingTotal, setRatingTotal] = useState(0);
  const [miRating, setMiRating] = useState("");
  const [guardandoRating, setGuardandoRating] = useState(false);
  const inputRef = useRef(null);

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
      } catch (e) {
        setError(e.message);
        setRepo(null);
        setArchivos([]);
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

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
    if (!esCreador) return setMensaje("Solo el creador puede subir archivos.");
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
    if (!esCreador) return setMensaje("Solo el creador puede eliminar archivos.");
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
      <div style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => navigate("/grupos")}>
          Volver al menú
        </button>
      </div>

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

      {esCreador && (
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

      <div className="group-tab-content">
        <div className="archivos-grid">
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
                {esCreador && (
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
    </div>
  );
}
