import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { obtenerVistaPreviaPorCodigo } from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";
import '../estilos/flux.css';

export default function GrupoDetalle() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState(null);
  const [archivosSeleccionados, setArchivosSeleccionados] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [mensajeSubida, setMensajeSubida] = useState('');
  const [archivosSubidos, setArchivosSubidos] = useState([]);
  const [mostrarModalArchivos, setMostrarModalArchivos] = useState(false);
  const inputRef = useRef(null);

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

  // Funciones para manejar archivos
  const manejarArchivos = (files) => {
    const archivosValidos = Array.from(files).filter(file => {
      const tipos = ['application/pdf', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      return tipos.includes(file.type) && file.size <= 20 * 1024 * 1024; // 20MB
    });
    setArchivosSeleccionados(archivosValidos);
  };

  const manejarDrop = (e) => {
    e.preventDefault();
    manejarArchivos(e.dataTransfer.files);
  };

  const manejarDragOver = (e) => {
    e.preventDefault();
  };

  const manejarClick = () => {
    inputRef.current.click();
  };

  const manejarInputChange = (e) => {
    manejarArchivos(e.target.files);
  };

  // Función para subir archivos a Supabase Storage
  const subirArchivos = async () => {
    if (archivosSeleccionados.length === 0) {
      setMensajeSubida('Selecciona archivos primero');
      return;
    }

    setSubiendo(true);
    setMensajeSubida('');

    try {
      const urls = [];

      for (const archivo of archivosSeleccionados) {
        // Crear un path único para evitar conflictos, sanitizando el nombre del archivo
        const safeName = archivo.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `archivos/${codigo}/${Date.now()}-${safeName}`;

        // Subir archivo a Supabase Storage (bucket 'Flux_repositorioGrupos')
        const { data, error } = await supabase.storage
          .from('Flux_repositorioGrupos')
          .upload(path, archivo);

        if (error) throw error;

        // Obtener URL pública del archivo subido
        const { data: urlData } = supabase.storage
          .from('Flux_repositorioGrupos')
          .getPublicUrl(path);

        urls.push(urlData.publicUrl);
      }

      setMensajeSubida(`✅ ${archivosSeleccionados.length} archivo(s) subido(s) exitosamente!`);
      setArchivosSeleccionados([]); // Limpiar selección
      console.log('URLs de archivos:', urls); // Para debugging

    } catch (error) {
      setMensajeSubida(`❌ Error al subir: ${error.message}`);
    } finally {
      setSubiendo(false);
    }
  };

  // Función para listar archivos subidos
  const listarArchivos = async () => {
    try {
      const { data, error } = await supabase.storage.from('Flux_repositorioGrupos').list(`archivos/${codigo}`);
      if (error) throw error;
      setArchivosSubidos(data || []);
      setMostrarModalArchivos(true);
    } catch (error) {
      setMensajeSubida(`❌ Error al listar archivos: ${error.message}`);
    }
  };

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
            style={{ width: "auto", background: "#ffffff10", fontSize: "12px" }}
            onClick={() => supabase.auth.signOut()}
          >
            {/* Botón para cerrar sesión */}
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Resumen del grupo (Se mantiene tu diseño original) */}
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

      <div style={{ height: 24 }} />

      {/* === BANNER  PARA SUBIR ARCHIVOS === */}
      <div className="card" style={{ maxWidth: '300px', margin: '0 auto' }}>
        <strong style={{ fontSize: '14px' }}>Subir Archivos al Repositorio</strong>
        
        {/* Etiqueta informativa */}
        <p className="label" style={{ marginTop: '8px', marginBottom: '16px' }}>
          Formatos: PDF, DOCX, PNG (Máx. 20MB) • Arrastra y suelta o haz click
        </p>
        
        {/* Área de drop */}
        <div 
          className="drop-area"
          onClick={manejarClick}
          onDrop={manejarDrop}
          onDragOver={manejarDragOver}
        >
          <div className="drop-content">
            <p style={{ margin: '4px 0', fontWeight: '600', fontSize: '12px' }}>
              {archivosSeleccionados.length > 0 
                ? `${archivosSeleccionados.length} archivo(s) seleccionado(s)`
                : 'Arrastra archivos aquí o haz click para seleccionar'
              }
            </p>
            <small className="label">PDF, DOCX, PNG hasta 20MB</small>
          </div>
        </div>

        {/* Input oculto */}
        <input 
          ref={inputRef}
          type="file" 
          multiple 
          accept=".pdf, .png, .docx"
          style={{ display: 'none' }}
          onChange={manejarInputChange}
        />
        
        {/* Lista de archivos seleccionados */}
        {archivosSeleccionados.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <strong>Archivos seleccionados:</strong>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              {archivosSeleccionados.map((file, index) => (
                <li key={index} className="label" style={{ marginBottom: '4px' }}>
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* El botón para subir */}
        <button className="btn" style={{ marginTop: '12px' }} onClick={subirArchivos} disabled={subiendo}>
          {subiendo ? '⏳ Subiendo...' : '🚀 Subir al repositorio'}
        </button>

        {/* Botón para ver archivos subidos */}
        <button className="btn" style={{ marginTop: '8px' }} onClick={listarArchivos}>
          📂 Ver archivos subidos
        </button>

        {/* Modal para archivos subidos */}
        {mostrarModalArchivos && (
          <div className="modal-overlay" onClick={() => setMostrarModalArchivos(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>📂 Archivos en el Repositorio</h3>
                <button 
                  className="modal-close" 
                  onClick={() => setMostrarModalArchivos(false)}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                {archivosSubidos.length > 0 ? (
                  <div className="archivos-grid">
                    {archivosSubidos.map((file, index) => {
                      const fullPath = `archivos/${codigo}/${file.name}`;
                      const { data } = supabase.storage.from('Flux_repositorioGrupos').getPublicUrl(fullPath);
                      const extension = file.name.split('.').pop().toLowerCase();
                      const icono = extension === 'pdf' ? '📄' : extension === 'docx' ? '📝' : extension === 'png' ? '🖼️' : '📎';
                      
                      return (
                        <div key={index} className="archivo-card">
                          <a 
                            href={data.publicUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="archivo-link"
                          >
                            <div className="archivo-icon">{icono}</div>
                            <div className="archivo-info">
                              <div className="archivo-nombre">{file.name}</div>
                              <div className="archivo-meta">
                                {new Date(file.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="no-archivos">📂 No hay archivos subidos aún.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mensaje de subida */}
        {mensajeSubida && (
          <p style={{ marginTop: '8px', fontSize: '12px', color: mensajeSubida.startsWith('✅') ? 'green' : 'red' }}>
            {mensajeSubida}
          </p>
        )}
      </div>
    </div>
  );
}