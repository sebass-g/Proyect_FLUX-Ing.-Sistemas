import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  eliminarArchivoRepositorioPublico,
  listarArchivosRepositorioPublico,
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
  const inputRef = useRef(null);

  async function cargarArchivos(repoId) {
    if (!repoId) {
      setArchivos([]);
      return;
    }
    const data = await listarArchivosRepositorioPublico({ repositorioId: repoId });
    setArchivos(data);
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
        setEsCreador(Boolean(uid && data?.creador_id && uid === data.creador_id));
        await cargarArchivos(data?.id);
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
        <div className="label" style={{ marginBottom: 0 }}>
          Este repositorio es público y no está vinculado a un grupo.
        </div>
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
