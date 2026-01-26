import { useEffect, useState } from "react";
import { obtenerVistaPreviaPorCodigo } from "../servicios/grupos.api";

export default function PaginaDetalleGrupo({ codigoGrupo, volver }) {
  const [grupo, setGrupo] = useState(null);

  useEffect(() => {
    (async () => {
      const g = await obtenerVistaPreviaPorCodigo(codigoGrupo);
      setGrupo(g);
    })();
  }, [codigoGrupo]);

  if (!grupo) {
    return (
      <div className="container">
        <div className="card">
          <strong>Grupo no encontrado</strong>
          <p>Verifique el código e intente nuevamente.</p>
          <button className="btn" onClick={volver}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <div className="logoDot" />
          <div>
            <div className="brandTitle">FLUX</div>
            <div className="brandSubtitle">Detalle del grupo</div>
          </div>
        </div>
        <button className="btn" style={{ width: "auto" }} onClick={volver}>
          Volver
        </button>
      </div>

      <div className="card">
        <h1>{grupo.nombre}</h1>
        <p>
          Código del grupo: <strong>{grupo.codigo}</strong>
        </p>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid2">
        <div className="card">
          <strong>Miembros</strong>
          <ul>
            {grupo.miembros.map(m => (
              <li key={m.id}>{m.nombre}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <strong>Actividad</strong>
          {grupo.actividad.map((a, i) => (
            <div key={i} className="feedItem">
              <div>{a.mensaje}</div>
              <small>{new Date(a.fecha).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
