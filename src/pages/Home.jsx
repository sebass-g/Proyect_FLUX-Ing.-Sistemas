import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  crearGrupo,
  listarGruposDelUsuario,
  obtenerVistaPreviaPorCodigo,
  unirseAGrupoPorCodigo
} from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";

const DIAS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" }
];

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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [horario, setHorario] = useState([]);
  const [toastMensaje, setToastMensaje] = useState("");
  const [mostrarToast, setMostrarToast] = useState(false);
  const toastTimeoutRef = useRef(null);
  const [userId, setUserId] = useState(null);
  const [toastGrupoId, setToastGrupoId] = useState(null);

  const resumenHorario = useMemo(() => {
    if (!horario.length) return "Sin horario";
    return horario
      .slice()
      .sort((a, b) =>
        a.dayOfWeek === b.dayOfWeek
          ? a.startTime.localeCompare(b.startTime)
          : a.dayOfWeek - b.dayOfWeek
      )
      .map(b => {
        const diaLabel = DIAS.find(d => d.value === b.dayOfWeek)?.label || "";
        return `${diaLabel} ${b.startTime}-${b.endTime}`;
      })
      .join(", ");
  }, [horario]);

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
      const avatar = user?.user_metadata?.avatar_url?.trim();
      const { data: bloquesData, error: bloquesError } = await supabase
        .from("bloques_horario")
        .select("id, day_of_week, start_time, end_time, type")
        .eq("user_id", user?.id);

      if (bloquesError) {
        setError("No se pudo cargar el horario.");
      }
      if (isMounted) {
        setNombreUsuario(displayName || "");
        setAvatarUrl(avatar || "");
        setUserId(user?.id || null);
        setHorario(
          (bloquesData || []).map(b => ({
            id: b.id,
            dayOfWeek: b.day_of_week,
            startTime: b.start_time,
            endTime: b.end_time,
            type: b.type || ""
          }))
        );
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

  useEffect(() => {
    if (!gruposUsuario.length) return;

    const ids = gruposUsuario.map(g => g.id).join(",");
    const channel = supabase
      .channel("grupo-actividad-home")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "grupo_actividad",
          filter: `grupo_id=in.(${ids})`
        },
        payload => {
          const nuevo = payload.new;
          if (!nuevo) return;
          const esJoin = `${nuevo.mensaje || ""}`.includes("se ha unido a tu grupo");
          const esOtro = nuevo.actor_id && nuevo.actor_id !== userId;
          if (esJoin && (userId ? esOtro : true)) {
            setToastMensaje(nuevo.mensaje);
            setToastGrupoId(nuevo.grupo_id);
            setMostrarToast(true);
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            toastTimeoutRef.current = setTimeout(() => {
              setMostrarToast(false);
            }, 6000);
          }
        }
      )
      .subscribe();

    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [gruposUsuario, userId]);

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
      {mostrarToast && (
        <button
          className="toast-noti toast-action"
          onClick={() => {
            const grupo = gruposUsuario.find(g => g.id === toastGrupoId);
            if (grupo?.codigo) {
              navigate(`/grupos/${grupo.codigo}`);
            }
          }}
        >
          <div className="toast-icon">💬</div>
          <div className="toast-text">{toastMensaje}</div>
        </button>
      )}
      {/* Encabezado con marca, bienvenida y acciones */}
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
        <div className="topbar-right">
          <div className="topbar-welcome">
            <div className="welcome-title">
              Bienvenido{nombreUsuario ? `, ${nombreUsuario}` : ""}
            </div>
            <div className="welcome-subtitle">
              Ya puedes crear tu grupo o unirte con un código.
            </div>
            <button
              className="btn btn-logout"
              onClick={() => supabase.auth.signOut()}
            >
              Cerrar Sesión
            </button>
          </div>
          <button
            className="avatar-button avatar-big"
            onClick={() => navigate("/perfil/editar")}
            aria-label="Ir a perfil"
          >
            {avatarUrl ? (
              <img className="avatar-img" src={avatarUrl} alt="Perfil" />
            ) : (
              <div className="avatar-fallback">
                {(nombreUsuario || "U")
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

      <div style={{ height: 16 }} />

      {/* Grupos del usuario */}
      <div className="card">
        <strong>📚 Mis grupos</strong>
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

      {/* Horario del usuario */}
      <div className="card">
        <strong>🗓️ Mi horario</strong>
        <div className="label" style={{ marginTop: 8 }}>
          {resumenHorario}
        </div>
        {horario.length > 0 && (
          <div className="schedule-list">
            {horario
              .slice()
              .sort((a, b) =>
                a.dayOfWeek === b.dayOfWeek
                  ? a.startTime.localeCompare(b.startTime)
                  : a.dayOfWeek - b.dayOfWeek
              )
              .map(b => (
                <div key={b.id} className="schedule-item">
                  <div>
                    <strong>
                      {DIAS.find(d => d.value === b.dayOfWeek)?.label}
                    </strong>{" "}
                    {b.startTime} - {b.endTime}
                    {b.type ? ` · ${b.type}` : ""}
                  </div>
                </div>
              ))}
          </div>
        )}
        {horario.length === 0 && (
          <div className="label" style={{ marginTop: 8 }}>
            Aún no tienes bloques guardados.
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />

      {/* Bloques principales: crear grupo / unirse por código */}
      <div className="grid2">
        <div className="card">
          <strong>✨ Crear grupo</strong>
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
          <strong>🔑 Unirse por código</strong>
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
              <div><strong>🔍 Vista previa</strong></div>
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
