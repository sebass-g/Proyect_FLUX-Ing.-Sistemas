import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  abandonarGrupo,
  actualizarNombreGrupo,
  buscarRepositoriosPublicos,
  crearGrupo,
  crearRepositorioPublico,
  listarGruposDelUsuario,
  obtenerVistaPreviaPorCodigo,
  unirseAGrupoPorCodigo
} from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";
import { obtenerColorGrupo } from "../utils/groupColors";

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
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [codigoIngreso, setCodigoIngreso] = useState("");
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [esPublicoNuevoGrupo, setEsPublicoNuevoGrupo] = useState(false);
  const [tituloRepoPublico, setTituloRepoPublico] = useState("");
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [error, setError] = useState("");
  const [gruposUsuario, setGruposUsuario] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [horario, setHorario] = useState([]);
  const [mostrarToast, setMostrarToast] = useState(false);
  const [toastMensaje, setToastMensaje] = useState("");
  const [toastGrupoId, setToastGrupoId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [fabAbierto, setFabAbierto] = useState(false);
  const [accionAbierta, setAccionAbierta] = useState("");
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [busquedaTexto, setBusquedaTexto] = useState("");
  const [filtroFechaRepos, setFiltroFechaRepos] = useState("all");
  const [reposSugeridos, setReposSugeridos] = useState([]);
  const [buscandoRepos, setBuscandoRepos] = useState(false);
  const [menuGrupoAbiertoId, setMenuGrupoAbiertoId] = useState(null);
  const [grupoEditando, setGrupoEditando] = useState(null);
  const [nuevoNombreGrupoEditar, setNuevoNombreGrupoEditar] = useState("");
  const [tieneSesion, setTieneSesion] = useState(false);
  const toastTimeoutRef = useRef(null);

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

  const horarioDrawer = useMemo(() => {
    return horario
      .slice()
      .sort((a, b) =>
        a.startTime === b.startTime
          ? a.dayOfWeek - b.dayOfWeek
          : a.startTime.localeCompare(b.startTime)
      )
      .map(b => ({
        ...b,
        diaLabel: DIAS.find(d => d.value === b.dayOfWeek)?.label || "",
        nombreClase: b.type?.trim() || "Clase"
      }));
  }, [horario]);

  useEffect(() => {
    if (!busquedaAbierta) return;
    const q = busquedaTexto.trim();
    if (!q && filtroFechaRepos === "all") {
      setReposSugeridos([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setBuscandoRepos(true);
        const resultados = await buscarRepositoriosPublicos(q, filtroFechaRepos);
        setReposSugeridos(resultados);
      } catch (e) {
        setError(e.message);
      } finally {
        setBuscandoRepos(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [busquedaAbierta, busquedaTexto, filtroFechaRepos]);

  async function cargarGrupos() {
    try {
      if (!userId) {
        setGruposUsuario([]);
        return;
      }
      const grupos = await listarGruposDelUsuario();
      setGruposUsuario(grupos);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function cargarContexto() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError("No se pudo leer la sesión.");
        return;
      }
      const user = data?.session?.user;
      if (!user) {
        if (isMounted) {
          setNombreUsuario("");
          setAvatarUrl("");
          setUserId(null);
          setHorario([]);
          setGruposUsuario([]);
          setTieneSesion(false);
          setError("");
        }
        return;
      }
      setTieneSesion(true);
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

      await cargarGrupos();
    }

    cargarContexto();
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

  useEffect(() => {
    if (!menuGrupoAbiertoId) return;

    const onPointerDown = event => {
      const target = event.target;
      if (target instanceof Element && target.closest(".classroom-card-menu-wrap")) {
        return;
      }
      setMenuGrupoAbiertoId(null);
    };

    const onKeyDown = event => {
      if (event.key === "Escape") setMenuGrupoAbiertoId(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuGrupoAbiertoId]);

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

  async function manejarCrearGrupo() {
    setError("");
    if (!userId) return setError("Inicia sesión para crear grupos.");
    if (!nombreUsuario.trim()) return setError("No se encontró tu display name.");
    if (!nombreGrupo.trim()) return setError("Ingrese el nombre del grupo.");

    const grupo = await crearGrupo({
      nombreGrupo,
      nombreUsuario,
      esPublico: esPublicoNuevoGrupo
    });

      setNombreGrupo("");
      setEsPublicoNuevoGrupo(false);
      setAccionAbierta("");
      setFabAbierto(false);
      await cargarGrupos();
      navigate(`/grupos/${grupo.codigo}`);
  }

  async function manejarCrearRepoPublico() {
    setError("");
    if (!userId) return setError("Inicia sesión para crear repositorios públicos.");
    if (!nombreUsuario.trim()) return setError("No se encontró tu display name.");
    if (!tituloRepoPublico.trim()) return setError("Ingrese el título del repositorio.");

    try {
      const repo = await crearRepositorioPublico({
        titulo: tituloRepoPublico,
        creadorNombre: nombreUsuario
      });
      setTituloRepoPublico("");
      setAccionAbierta("");
      setFabAbierto(false);
      navigate(`/repos-publicos/${repo.id}`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function manejarUnirse() {
    setError("");
    if (!userId) return setError("Inicia sesión para unirte a grupos.");
    if (!nombreUsuario.trim()) return setError("No se encontró tu display name.");
    if (!codigoIngreso.trim()) return setError("Ingrese el código del grupo.");

    try {
      const grupo = await unirseAGrupoPorCodigo({
        codigo: codigoIngreso,
        nombreUsuario
      });
      setCodigoIngreso("");
      setVistaPrevia(null);
      setAccionAbierta("");
      setFabAbierto(false);
      await cargarGrupos();
      navigate(`/grupos/${grupo.codigo}`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function manejarAbandonarGrupoHome(grupo) {
    const ok = window.confirm(`¿Abandonar el grupo "${grupo.nombre}"?`);
    if (!ok) return;
    try {
      await abandonarGrupo({ grupoId: grupo.id });
      setMenuGrupoAbiertoId(null);
      await cargarGrupos();
    } catch (e) {
      setError(e.message);
    }
  }

  async function manejarGuardarNombreGrupoHome() {
    if (!grupoEditando?.id) return;
    if (!nuevoNombreGrupoEditar.trim()) return;
    try {
      await actualizarNombreGrupo({
        grupoId: grupoEditando.id,
        nombre: nuevoNombreGrupoEditar.trim(),
        actorId: userId,
        actorNombre: nombreUsuario,
        nombreAnterior: grupoEditando.nombre || ""
      });
      setGrupoEditando(null);
      setNuevoNombreGrupoEditar("");
      await cargarGrupos();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="container home-container">
      {mostrarToast && (
        <button
          className="toast-noti toast-action"
          onClick={() => {
            const grupo = gruposUsuario.find(g => g.id === toastGrupoId);
            if (grupo?.codigo) navigate(`/grupos/${grupo.codigo}`);
          }}
        >
          <div className="toast-icon">💬</div>
          <div className="toast-text">{toastMensaje}</div>
        </button>
      )}

      <div className="home-header-strip">
        <button
          className="menu-button menu-button-primary"
          aria-label="Abrir menú"
          onClick={() => setMenuAbierto(true)}
        >
          ☰
        </button>
        <div className="home-header-title-wrap">
          <div className="home-header-title">FLUX</div>
          <div className="logoDot home-header-dot" />
        </div>
      </div>

      <div className="classroom-grid">
        {gruposUsuario.map(grupo => {
          const iniciales = (grupo.nombre || "G")
            .split(" ")
            .map(p => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const color = obtenerColorGrupo(grupo.codigo || grupo.nombre || "");

          return (
            <button
              key={grupo.id}
              className="classroom-card"
              onClick={() => navigate(`/grupos/${grupo.codigo}`)}
            >
              <div
                className="classroom-card-banner"
                style={{ "--banner-a": color.a, "--banner-b": color.b }}
              >
                <div className="classroom-card-menu-wrap">
                  <button
                    className="classroom-card-kebab"
                    aria-label="Opciones del grupo"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuGrupoAbiertoId(prev => (prev === grupo.id ? null : grupo.id));
                    }}
                  >
                    ⋯
                  </button>

                  {menuGrupoAbiertoId === grupo.id && (
                    <div
                      className="classroom-card-menu"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      {grupo.isAdmin && (
                        <button
                          className="classroom-card-menu-item"
                          onClick={() => {
                            setGrupoEditando(grupo);
                            setNuevoNombreGrupoEditar(grupo.nombre || "");
                            setMenuGrupoAbiertoId(null);
                          }}
                        >
                          Editar nombre
                        </button>
                      )}
                      <button
                        className="classroom-card-menu-item danger"
                        onClick={() => manejarAbandonarGrupoHome(grupo)}
                      >
                        Abandonar grupo
                      </button>
                    </div>
                  )}
                </div>

                <div className="classroom-card-badge" style={{ "--badge-bg": color.badge }}>
                  {iniciales}
                </div>
              </div>
              <div className="classroom-card-body">
                <div className="classroom-card-title">{grupo.nombre}</div>
                <div className="label classroom-card-code">Código: {grupo.codigo}</div>
              </div>
            </button>
          );
        })}
      </div>

      {gruposUsuario.length === 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          {tieneSesion ? (
            <div className="label" style={{ marginBottom: 0 }}>
              Aún no perteneces a ningún grupo. Usa el botón + para crear o unirte.
            </div>
          ) : (
            <div>
              <div className="label" style={{ marginBottom: 8 }}>
                Explora grupos. Inicia sesión para unirte o crear grupos.
              </div>
              {(() => {
                const gruposEjemplo = [
                  { nombre: "Grupo de Matemáticas", codigo: "MAT123" },
                  { nombre: "Grupo de Física", codigo: "FIS456" },
                  { nombre: "Grupo de Química", codigo: "QUI789" }
                ];

                return (
                  <div className="classroom-grid" style={{ marginTop: 8 }}>
                    {gruposEjemplo.map((g, i) => {
                      const iniciales = (g.nombre || "G")
                        .split(" ")
                        .map(p => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      const color = obtenerColorGrupo(g.codigo || g.nombre || "");
                      return (
                        <button
                          key={i}
                          className="classroom-card"
                          onClick={() => navigate("/auth")}
                          style={{ cursor: "pointer" }}
                        >
                          <div
                            className="classroom-card-banner"
                            style={{ "--banner-a": color.a, "--banner-b": color.b }}
                          >
                            <div className="classroom-card-badge" style={{ "--badge-bg": color.badge }}>
                              {iniciales}
                            </div>
                          </div>
                          <div className="classroom-card-body">
                            <div className="classroom-card-title">{g.nombre}</div>
                            <div className="label classroom-card-code">Código: {g.codigo}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => navigate("/auth")}>
                  Iniciar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <>
        <div
          className={`drawer-overlay ${menuAbierto ? "open" : ""}`}
          onClick={() => setMenuAbierto(false)}
        />
        <aside className={`home-drawer ${menuAbierto ? "open" : ""}`}>
          <div className="home-drawer-header">
            <div />
            <button className="menu-button" onClick={() => setMenuAbierto(false)}>
              ✕
            </button>
          </div>

          <div className="home-drawer-section">
            <div className="label">Grupos</div>
            <div className="drawer-list">
              {tieneSesion ? (
                <>
                  {gruposUsuario.map(g => (
                    <button
                      key={g.id}
                      className="drawer-item drawer-item-color"
                      style={{
                        "--drawer-a": obtenerColorGrupo(g.codigo || g.nombre || "").a,
                        "--drawer-b": obtenerColorGrupo(g.codigo || g.nombre || "").b
                      }}
                      onClick={() => {
                        setMenuAbierto(false);
                        navigate(`/grupos/${g.codigo}`);
                      }}
                    >
                      <span className="drawer-item-name">{g.nombre}</span>
                      <small className="drawer-item-code">{g.codigo}</small>
                    </button>
                  ))}
                  {gruposUsuario.length === 0 && <div className="label">Sin grupos</div>}
                </>
              ) : (
                <div className="label">Inicia sesión para ver tus grupos.</div>
              )}
            </div>
          </div>

          <div className="home-drawer-section">
            <div className="label">Mi horario</div>
            {tieneSesion ? (
              horarioDrawer.length === 0 ? (
                <div className="drawer-horario">Sin horario</div>
              ) : (
                <div className="drawer-horario-list">
                  {horarioDrawer.map((b, idx) => (
                    <div key={`${b.id}-${idx}`} className="drawer-horario-item">
                      <div className="drawer-horario-top">
                        <span className="drawer-dia-badge">{b.diaLabel}</span>
                        <span className="drawer-hora">{b.startTime} - {b.endTime}</span>
                      </div>
                      <div className="drawer-clase">{b.nombreClase}</div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="drawer-horario">Disponible al iniciar sesión</div>
            )}
          </div>
        </aside>
      </>

      {fabAbierto && tieneSesion && (
        <div className="footer-plus-menu">
          <button
            className="fab-menu-item"
            onClick={() => {
              setAccionAbierta("crear");
              setFabAbierto(false);
              setError("");
            }}
          >
            Crear grupo
          </button>
          <button
            className="fab-menu-item"
            onClick={() => {
              setAccionAbierta("unirse");
              setFabAbierto(false);
              setError("");
            }}
          >
            Unirme por código
          </button>
          <button
            className="fab-menu-item"
            onClick={() => {
              setAccionAbierta("crearRepoPublico");
              setFabAbierto(false);
              setError("");
            }}
          >
            Crear repositorio público
          </button>
        </div>
      )}

      <footer className="home-footer">
        <button
          className="home-footer-btn"
          aria-label="Buscar grupos"
          onClick={() => {
                setBusquedaAbierta(true);
                setFabAbierto(false);
                setMenuGrupoAbiertoId(null);
              }}
            >
          <svg viewBox="0 0 24 24" className="home-footer-icon" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20L16.8 16.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <button
          className="home-footer-plus"
          aria-label="Opciones de grupo"
          onClick={() => {
            if (!tieneSesion) {
              setError("Inicia sesión para acceder a grupos privados.");
              return;
            }
            setFabAbierto(v => !v);
            setAccionAbierta("");
            setMenuGrupoAbiertoId(null);
          }}
        >
          +
        </button>

        <button
          className="avatar-button home-footer-avatar"
          onClick={() => (tieneSesion ? navigate("/perfil/editar") : navigate("/auth"))}
          aria-label={tieneSesion ? "Ir a perfil" : "Iniciar sesión"}
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
      </footer>

      {accionAbierta && (
        <div className="modal-overlay" onClick={() => setAccionAbierta("")}>
          <div className="modal-content action-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {accionAbierta === "crear"
                  ? "Crear grupo"
                  : accionAbierta === "crearRepoPublico"
                    ? "Crear repositorio público"
                    : "Unirme al grupo"}
              </h3>
              <button className="modal-close" onClick={() => setAccionAbierta("")}>✕</button>
            </div>
            <div className="modal-body">
              {accionAbierta === "crear" && (
                <>
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
                </>
              )}

              {accionAbierta === "crearRepoPublico" && (
                <>
                  <label className="label">Título del repositorio</label>
                  <input
                    className="input"
                    value={tituloRepoPublico}
                    onChange={e => setTituloRepoPublico(e.target.value)}
                    placeholder="Ej: Apuntes de Álgebra Lineal"
                  />
                  <div className="label">Creador: {nombreUsuario || "Usuario"}</div>
                  <button className="btn btnPrimary" onClick={manejarCrearRepoPublico}>
                    Crear repositorio público
                  </button>
                </>
              )}

              {accionAbierta === "unirse" && (
                <>
                  <label className="label">Código del grupo</label>
                  <input
                    className="input"
                    value={codigoIngreso}
                    onChange={e => manejarCambioCodigo(e.target.value)}
                    placeholder="Ej: A1B2C3"
                    style={{ textTransform: "uppercase", fontWeight: 700 }}
                  />

                  {vistaPrevia && (
                    <div className="preview">
                      <div style={{ fontWeight: 700 }}>{vistaPrevia.nombre}</div>
                      <div className="label" style={{ marginBottom: 0 }}>
                        Miembros: {vistaPrevia.miembros.map(m => m.nombre).join(", ")}
                      </div>
                    </div>
                  )}

                  <button className="btn btnPrimary" onClick={manejarUnirse}>
                    Unirme al grupo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {grupoEditando && (
        <div className="modal-overlay" onClick={() => setGrupoEditando(null)}>
          <div className="modal-content action-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar nombre del grupo</h3>
              <button className="modal-close" onClick={() => setGrupoEditando(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <label className="label">Nombre del grupo</label>
              <input
                className="input"
                value={nuevoNombreGrupoEditar}
                onChange={e => setNuevoNombreGrupoEditar(e.target.value)}
                placeholder="Nombre del grupo"
              />
              <button className="btn btnPrimary" onClick={manejarGuardarNombreGrupoHome}>
                Guardar nombre
              </button>
            </div>
          </div>
        </div>
      )}

      {busquedaAbierta && (
        <div className="modal-overlay" onClick={() => setBusquedaAbierta(false)}>
          <div className="modal-content action-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Buscar repositorios</h3>
              <button className="modal-close" onClick={() => setBusquedaAbierta(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <input
                className="input"
                value={busquedaTexto}
                onChange={e => setBusquedaTexto(e.target.value)}
                placeholder="Buscar por grupo, admin, título o creador"
              />
              <select
                className="input"
                value={filtroFechaRepos}
                onChange={e => setFiltroFechaRepos(e.target.value)}
                style={{ marginTop: 8 }}
              >
                <option value="all">Sin filtro</option>
                <option value="1m">Último mes</option>
                <option value="3m">Últimos 3 meses</option>
                <option value="1y">Último año</option>
              </select>
              <div className="repo-suggest-list" style={{ marginTop: 12 }}>
                {reposSugeridos.map(repo => (
                  <button
                    key={`${repo.tipo}-${repo.id}`}
                    className="repo-suggest-card"
                    style={{
                      "--drawer-a": obtenerColorGrupo(repo.codigo || repo.nombre || repo.titulo || "").a,
                      "--drawer-b": obtenerColorGrupo(repo.codigo || repo.nombre || repo.titulo || "").b
                    }}
                    onClick={() => {
                      setBusquedaAbierta(false);
                      setBusquedaTexto("");
                      if (repo.tipo === "grupo") {
                        navigate(`/repos/${repo.codigo}`);
                      } else {
                        navigate(`/repos-publicos/${repo.id}`);
                      }
                    }}
                  >
                    <span className="repo-suggest-name">{repo.nombre || repo.titulo}</span>
                    {repo.tipo === "grupo" ? (
                      <>
                        <small className="repo-suggest-meta">
                          {repo.codigo} · Admin: {repo.adminNombre}
                        </small>
                        <small className="repo-suggest-meta">
                          {repo.archivosCount} archivo(s)
                        </small>
                      </>
                    ) : (
                      <>
                        <small className="repo-suggest-meta">Creador: {repo.creadorNombre}</small>
                        <small className="repo-suggest-meta">
                          Creado: {repo.createdAt ? new Date(repo.createdAt).toLocaleDateString() : "-"}
                        </small>
                      </>
                    )}
                  </button>
                ))}
                {buscandoRepos && <div className="label">Buscando...</div>}
                {!buscandoRepos && (busquedaTexto.trim() || filtroFechaRepos !== "all") && reposSugeridos.length === 0 && (
                  <div className="label">Sin resultados</div>
                )}
              </div>
              <div className="label" style={{ marginTop: 12, marginBottom: 0 }}>
                Toca una opción para abrir su repositorio en modo lectura.
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert">{error}</div>}
    </div>
  );
}
