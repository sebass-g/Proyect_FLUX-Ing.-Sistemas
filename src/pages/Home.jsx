import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  crearGrupo,
  listarGruposDelUsuario,
  obtenerVistaPreviaPorCodigo,
  unirseAGrupoPorCodigo
} from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";

export default function Home() {
  const navigate = useNavigate();
  // Datos que el usuario escribe en pantalla
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [nombreGrupo, setNombreGrupo] = useState("");

  // Estados para unirse por código
  const [codigoIngreso, setCodigoIngreso] = useState("");
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [error, setError] = useState("");
  const [gruposUsuario, setGruposUsuario] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function cargarDisplayName() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError("No se pudo leer la sesion.");
        return;
      }
      const user = data?.session?.user;
      const displayName = user?.user_metadata?.display_name?.trim();
      if (isMounted) {
        setNombreUsuario(displayName || "");
      }
    }

    async function cargarGrupos() {
      try {
        const grupos = await listarGruposDelUsuario();
        if (isMounted) {
          setGruposUsuario(grupos);
        }
      } catch (e) {
        setError(e.message);
      }
    }

    cargarDisplayName();
    cargarGrupos();
    return () => {
      isMounted = false;
    };
  }, []);

  async function manejarCrearGrupo() {
    // Valida inputs y crea el grupo con código único
    setError("");
    if (!nombreUsuario.trim()) return setError("No se encontro tu display name.");
    if (!nombreGrupo.trim()) return setError("Ingrese el nombre del grupo.");

    const grupo = await crearGrupo({
      nombreGrupo,
      nombreUsuario
    });

    navigate(`/grupos/${grupo.codigo}`);
  }

  async function manejarCambioCodigo(valor) {
    // Normaliza el código y busca una vista previa del grupo
    const codigo = valor.toUpperCase();
    setCodigoIngreso(codigo);

    if (codigo.length >= 4) {
      const grupo = await obtenerVistaPreviaPorCodigo(codigo);
      setVistaPrevia(grupo);
    } else {
      setVistaPrevia(null);
    }
  }

  async function manejarUnirse() {
    // Valida inputs y une al usuario al grupo
    setError("");
    if (!nombreUsuario.trim()) return setError("No se encontro tu display name.");
    if (!codigoIngreso.trim()) return setError("Ingrese el código del grupo.");

    try {
      const grupo = await unirseAGrupoPorCodigo({
        codigo: codigoIngreso,
        nombreUsuario
      });
      navigate(`/grupos/${grupo.codigo}`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="container">
      {/* Encabezado con marca y logout */}
      <div className="topbar">
        <div className="brand">
          <div className="logoDot" />
          <div>
            <div className="brandTitle">FLUX</div>
            <div className="brandSubtitle">
              Grupos de estudio · Coordinación sin caos
            </div>
          </div>
        </div>
        <button
          className="btn"
          style={{ width: "auto", background: "#f7f3f315", fontSize: "12px" }}
          onClick={() => supabase.auth.signOut()}
        >
          {/* Botón para cerrar sesión */}
          Cerrar Sesión
        </button>
      </div>

      {/* Perfil rápido (nombre visible usado en miembros/actividad) */}
      <div className="card">
        <strong>Bienvenido{nombreUsuario ? `, ${nombreUsuario}` : ""}</strong>
        <div className="label" style={{ marginBottom: 0 }}>
          Ya puedes crear tu grupo o unirte con un código.
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Grupos del usuario */}
      <div className="card">
        <strong>Mis grupos</strong>
        {gruposUsuario.length === 0 ? (
          <div className="label" style={{ marginBottom: 0 }}>
            Aun no perteneces a ningun grupo.
          </div>
        ) : (
          <div className="grupos-scroll">
            {gruposUsuario.map(grupo => (
              <button
                key={grupo.id}
                className="btn"
                style={{ textAlign: "left" }}
                onClick={() => navigate(`/grupos/${grupo.codigo}`)}
              >
                <div style={{ fontWeight: 800 }}>{grupo.nombre}</div>
                <div className="label" style={{ marginBottom: 0 }}>
                  Codigo: {grupo.codigo}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />

      {/* Bloques principales: crear grupo / unirse por código */}
      <div className="grid2">
        <div className="card">
          <strong>Crear grupo</strong>
          <label className="label">Nombre del grupo</label>
          <input
            className="input"
            value={nombreGrupo}
            onChange={e => setNombreGrupo(e.target.value)}
            placeholder="Ej: Cálculo II - Parcial 1"
          />
          <button className="btn btnPrimary" onClick={manejarCrearGrupo}>
            {/* Botón para crear grupo y generar código */}
            Crear y generar código
          </button>
        </div>

        <div className="card">
          <strong>Unirse por código</strong>
          <label className="label">Código del grupo</label>
          <input
            className="input"
            value={codigoIngreso}
            onChange={e => manejarCambioCodigo(e.target.value)}
            placeholder="Ej: A1B2C3"
            style={{ textTransform: "uppercase", fontWeight: 800 }}
          />

          {vistaPrevia && (
            <div className="preview">
              {/* Vista previa del grupo encontrado por código */}
              <div><strong>Vista previa</strong></div>
              <div>{vistaPrevia.nombre}</div>
              <div>
                Miembros: {vistaPrevia.miembros.map(m => m.nombre).join(", ")}
              </div>
            </div>
          )}

          <button className="btn" onClick={manejarUnirse}>
            {/* Botón para unirse al grupo usando el código */}
            Unirme al grupo
          </button>
        </div>
      </div>

      {/* Muestra errores de validación o API */}
      {error && <div className="alert">{error}</div>}
    </div>
    
  );
}
