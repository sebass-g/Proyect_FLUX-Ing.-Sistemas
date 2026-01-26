import { useState } from "react";
import {
  crearGrupo,
  obtenerVistaPreviaPorCodigo,
  unirseAGrupoPorCodigo
} from "../servicios/grupos.api";

export default function PaginaGrupos({ abrirGrupo }) {
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [nombreGrupo, setNombreGrupo] = useState("");

  const [codigoIngreso, setCodigoIngreso] = useState("");
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [error, setError] = useState("");

  async function manejarCrearGrupo() {
    setError("");
    if (!nombreUsuario.trim()) return setError("Ingrese su nombre.");
    if (!nombreGrupo.trim()) return setError("Ingrese el nombre del grupo.");

    const grupo = await crearGrupo({
      nombreGrupo,
      nombreUsuario
    });

    abrirGrupo(grupo.codigo);
  }

  async function manejarCambioCodigo(valor) {
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
    setError("");
    if (!nombreUsuario.trim()) return setError("Ingrese su nombre.");
    if (!codigoIngreso.trim()) return setError("Ingrese el código del grupo.");

    try {
      const grupo = await unirseAGrupoPorCodigo({
        codigo: codigoIngreso,
        nombreUsuario
      });
      abrirGrupo(grupo.codigo);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="container">
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
      </div>

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
              <div><strong>Vista previa</strong></div>
              <div>{vistaPrevia.nombre}</div>
              <div>
                Miembros: {vistaPrevia.miembros.map(m => m.nombre).join(", ")}
              </div>
            </div>
          )}

          <button className="btn" onClick={manejarUnirse}>
            Unirme al grupo
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
    </div>
  );
}
