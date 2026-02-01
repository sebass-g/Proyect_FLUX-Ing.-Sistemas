import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  crearGrupo,
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

  async function manejarCrearGrupo() {
    // Valida inputs y crea el grupo con código único
    setError("");
    if (!nombreUsuario.trim()) return setError("Ingrese su nombre.");
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
    if (!nombreUsuario.trim()) return setError("Ingrese su nombre.");
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
        <strong>Tu perfil (MVP)</strong>
        <label className="label">Nombre visible</label>
        <input
          className="input"
          value={nombreUsuario}
          onChange={e => setNombreUsuario(e.target.value)}
          placeholder="Ej: Enrique"
        />
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
