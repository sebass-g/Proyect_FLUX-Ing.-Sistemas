import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  abandonarGrupo,
  actualizarColorGrupo,
  actualizarNombreGrupo,
  buscarRepositoriosPublicos,
  crearGrupo,
  crearRepositorioPublico,
  listarGruposDelUsuario,
  obtenerVistaPreviaPorCodigo,
  unirseAGrupoPorCodigo
} from "../servicios/grupos.api";
import {
  listarRepositoriosFavoritos,
  listarRepositoriosCreados,
  listarRepositoriosDondeColaboro
} from "../servicios/grupos.api";
import { supabase } from "../config/supabaseClient";
import logoFlux from "../assets/logo-flux.png";
import {
  PALETA_BANNERS,
  obtenerColorEntidad
} from "../utils/groupColors";

const DIAS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" }
];

const FECHA_OPTIONS = [
  { value: "all", label: "Sin filtro de fecha" },
  { value: "1w", label: "Última semana" },
  { value: "1m", label: "Último mes" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "1y", label: "Último año" }
];

const RATING_OPTIONS = [
  { value: "all", label: "Sin filtro de puntuación" },
  { value: "4", label: "4 o más" },
  { value: "3", label: "3 o más" },
  { value: "2", label: "2 o más" },
  { value: "1", label: "1 o más" }
];

export default function Home() {
  const navigate = useNavigate();
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [codigoIngreso, setCodigoIngreso] = useState("");
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [esPublicoNuevoGrupo, setEsPublicoNuevoGrupo] = useState(false);
  const [colorNuevoGrupo, setColorNuevoGrupo] = useState(PALETA_BANNERS[0].id);
  const [tituloRepoPublico, setTituloRepoPublico] = useState("");
  const [colorNuevoRepo, setColorNuevoRepo] = useState(PALETA_BANNERS[0].id);
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
  const [filtroRatingRepos, setFiltroRatingRepos] = useState("all");
  const [reposSugeridos, setReposSugeridos] = useState([]);
  const [buscandoRepos, setBuscandoRepos] = useState(false);
  const [favoritosRepos, setFavoritosRepos] = useState([]);
  const [misReposCreados, setMisReposCreados] = useState([]);
  const [reposColaborando, setReposColaborando] = useState([]);
  const [esFundadorVista, setEsFundadorVista] = useState(false);
  const [menuGrupoAbiertoId, setMenuGrupoAbiertoId] = useState(null);
  const [grupoEditando, setGrupoEditando] = useState(null);
  const [nuevoNombreGrupoEditar, setNuevoNombreGrupoEditar] = useState("");
  const [colorGrupoEditar, setColorGrupoEditar] = useState(PALETA_BANNERS[0].id);
  const [tieneSesion, setTieneSesion] = useState(false);
  const toastTimeoutRef = useRef(null);
  const fechaFiltroLabel =
    FECHA_OPTIONS.find(o => o.value === filtroFechaRepos)?.label || "Sin filtro de fecha";
  const ratingFiltroLabel =
    RATING_OPTIONS.find(o => o.value === filtroRatingRepos)?.label || "Sin filtro de puntuación";

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
    if (!q && filtroFechaRepos === "all" && filtroRatingRepos === "all") {
      setReposSugeridos([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setBuscandoRepos(true);
        const resultados = await buscarRepositoriosPublicos(q, filtroFechaRepos, filtroRatingRepos);
        setReposSugeridos(resultados);
      } catch (e) {
        setError(e.message);
      } finally {
        setBuscandoRepos(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [busquedaAbierta, busquedaTexto, filtroFechaRepos, filtroRatingRepos]);

  async function cargarGrupos(userIdActual = userId) {
    try {
      if (!userIdActual) {
        setGruposUsuario([]);
        return;
      }
      const grupos = await listarGruposDelUsuario();
      setGruposUsuario(grupos);
    } catch (e) {
      setError(e.message);
    }
  }

  async function cargarFavoritos() {
    try {
      const favs = await listarRepositoriosFavoritos();
      setFavoritosRepos(favs || []);
    } catch (e) {
      console.warn("Error cargando favoritos:", e.message);
      setFavoritosRepos([]);
    }
  }

  async function cargarReposCreados() {
    try {
      const creados = await listarRepositoriosCreados();
      setMisReposCreados(creados || []);
    } catch (e) {
      console.warn("No se pudieron cargar repos creados:", e.message);
      setMisReposCreados([]);
    }
  }

  async function cargarReposColaborando() {
    try {
      const colaborando = await listarRepositoriosDondeColaboro();
      setReposColaborando(colaborando || []);
    } catch (e) {
      console.warn("No se pudieron cargar repos colaborando:", e.message);
      setReposColaborando([]);
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
          setEsFundadorVista(false);
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
      const { data: perfilData, error: perfilError } = await supabase
        .from("profiles")
        .select("is_fundador")
        .eq("id", user?.id)
        .maybeSingle();

      if (bloquesError) {
        setError("No se pudo cargar el horario.");
      }
      if (perfilError) {
        console.warn("No se pudo cargar el perfil de fundador:", perfilError.message);
      }

      if (isMounted) {
        setNombreUsuario(displayName || "");
        setAvatarUrl(avatar || "");
        setUserId(user?.id || null);
        setEsFundadorVista(Boolean(perfilData?.is_fundador));
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

      await cargarGrupos(user?.id || null);
      await cargarFavoritos();
      await cargarReposCreados();
      await cargarReposColaborando();
    }

    cargarContexto();
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time: cuando el usuario se une/abandona grupos, recargar lista automáticamente
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-grupo-members-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "grupo_miembros",
          filter: `user_id=eq.${userId}`
        },
        async payload => {
          // recargar grupos cuando cambian membresías
          cargarGrupos();
          try {
            const ev = payload?.event;
            if (ev === "INSERT") {
              const gid = payload?.new?.grupo_id;
              if (gid) {
                const { data: g, error: gErr } = await supabase
                  .from("grupos")
                  .select("id, nombre, codigo")
                  .eq("id", gid)
                  .maybeSingle();
                if (!gErr && g) {
                  setToastMensaje(`${g.nombre} agregado a tus grupos`);
                  setToastGrupoId(g.id);
                  setMostrarToast(true);
                  if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                  toastTimeoutRef.current = setTimeout(() => setMostrarToast(false), 6000);
                }
              }
            } else if (ev === "DELETE") {
              // opcional: notificar que salió del grupo
              const gid = payload?.old?.grupo_id;
              if (gid) {
                setToastMensaje(`Has salido de un grupo`);
                setMostrarToast(true);
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                toastTimeoutRef.current = setTimeout(() => setMostrarToast(false), 6000);
              }
            }
          } catch (e) {
            console.warn("Error handling grupo_miembros realtime:", e.message);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Real-time: cuando cambian colaboraciones del usuario, recargar repos colaborando.
  useEffect(() => {
    if (!userId) return;
    const chan = supabase
      .channel(`user-repos-collab-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "repositorio_publico_colaboradores",
          filter: `user_id=eq.${userId}`
        },
        () => {
          cargarReposColaborando();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chan);
    };
  }, [userId]);

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

  // Real-time: cuando el usuario crea/elimina repositorios públicos creados por él, recargar
  useEffect(() => {
    if (!userId) return;
    const chan = supabase
      .channel(`user-repos-created-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "repositorios_publicos",
          filter: `creador_id=eq.${userId}`
        },
        payload => {
          cargarReposCreados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chan);
    };
  }, [userId]);

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

  useEffect(() => {
    if (!accionAbierta && !grupoEditando) {
      setError("");
    }
  }, [accionAbierta, grupoEditando]);

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

    try {
      const grupo = await crearGrupo({
        nombreGrupo,
        nombreUsuario,
        esPublico: esPublicoNuevoGrupo,
        colorId: colorNuevoGrupo
      });

      setNombreGrupo("");
      setEsPublicoNuevoGrupo(false);
      setColorNuevoGrupo(PALETA_BANNERS[0].id);
      setAccionAbierta("");
      setFabAbierto(false);
      await cargarGrupos();
      navigate(`/grupos/${grupo.codigo}`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function manejarCrearRepoPublico() {
    setError("");
    if (!userId) return setError("Inicia sesión para crear repositorios públicos.");
    if (!nombreUsuario.trim()) return setError("No se encontró tu display name.");
    if (!tituloRepoPublico.trim()) return setError("Ingrese el título del repositorio.");

    try {
      const repo = await crearRepositorioPublico({
        titulo: tituloRepoPublico,
        creadorNombre: nombreUsuario,
        colorId: colorNuevoRepo
      });
      setTituloRepoPublico("");
      setColorNuevoRepo(PALETA_BANNERS[0].id);
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
    let mensaje = `¿Abandonar el grupo "${grupo.nombre}"?`;
    if (grupo.isAdmin && (grupo.miembros?.length || 0) > 1) {
      mensaje = `Eres administrador del grupo "${grupo.nombre}". Si sales, se asignará automáticamente otro miembro como administrador. ¿Continuar?`;
    }
    const ok = window.confirm(mensaje);
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
      await actualizarColorGrupo({
        grupoId: grupoEditando.id,
        colorId: colorGrupoEditar,
        actorId: userId,
        actorNombre: nombreUsuario
      });
      setGrupoEditando(null);
      setNuevoNombreGrupoEditar("");
      setColorGrupoEditar(PALETA_BANNERS[0].id);
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

      {misReposCreados && misReposCreados.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <strong>Mis repositorios</strong>
          <div className="classroom-grid" style={{ marginTop: 8 }}>
            {misReposCreados.map(r => {
              const iniciales = (r.titulo || "R")
                .split(" ")
                .map(p => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const color = obtenerColorEntidad({
                tipo: "repo_publico",
                entidadId: r.id,
                identificador: r.id || r.titulo || "",
                colorId: r.color_id || ""
              });
              return (
                <button key={r.id} className="classroom-card" onClick={() => navigate(`/repos-publicos/${r.id}`)}>
                  <div className="classroom-card-banner" style={{ "--banner-a": color.a, "--banner-b": color.b }}>
                    <div className="classroom-card-badge" style={{ "--badge-bg": color.badge }}>{iniciales}</div>
                  </div>
                  <div className="classroom-card-body">
                    <div className="classroom-card-title">{r.titulo}</div>
                    <div className="label classroom-card-code">Creador: {r.creador_nombre || "Usuario"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {reposColaborando && reposColaborando.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <strong>Colaborando</strong>
          <div className="classroom-grid" style={{ marginTop: 8 }}>
            {reposColaborando.map(r => {
              const iniciales = (r.titulo || "R")
                .split(" ")
                .map(p => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const color = obtenerColorEntidad({
                tipo: "repo_publico",
                entidadId: r.id,
                identificador: r.id || r.titulo || "",
                colorId: r.color_id || ""
              });
              return (
                <button key={r.id} className="classroom-card" onClick={() => navigate(`/repos-publicos/${r.id}`)}>
                  <div className="classroom-card-banner" style={{ "--banner-a": color.a, "--banner-b": color.b }}>
                    <div className="classroom-card-badge" style={{ "--badge-bg": color.badge }}>{iniciales}</div>
                  </div>
                  <div className="classroom-card-body">
                    <div className="classroom-card-title">{r.titulo}</div>
                    <div className="label classroom-card-code">Creador: {r.creador_nombre || "Usuario"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {favoritosRepos && favoritosRepos.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <strong>Favoritos</strong>
          <div className="classroom-grid" style={{ marginTop: 8 }}>
            {favoritosRepos.map(r => {
              const iniciales = (r.titulo || "R")
                .split(" ")
                .map(p => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const color = obtenerColorEntidad({
                tipo: "repo_publico",
                entidadId: r.id,
                identificador: r.id || r.titulo || "",
                colorId: r.color_id || ""
              });
              return (
                <button key={r.id} className="classroom-card" onClick={() => navigate(`/repos-publicos/${r.id}`)}>
                  <div className="classroom-card-banner" style={{ "--banner-a": color.a, "--banner-b": color.b }}>
                    <div className="classroom-card-badge" style={{ "--badge-bg": color.badge }}>{iniciales}</div>
                  </div>
                  <div className="classroom-card-body">
                    <div className="classroom-card-title">{r.titulo}</div>
                    <div className="label classroom-card-code">Creador: {r.creador_nombre || "Usuario"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {gruposUsuario && gruposUsuario.length > 0 ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <strong>Mis grupos</strong>
          <div className="classroom-grid" style={{ marginTop: 8 }}>
            {gruposUsuario.map(grupo => {
              const iniciales = (grupo.nombre || "G")
                .split(" ")
                .map(p => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const color = obtenerColorEntidad({
                tipo: "grupo",
                entidadId: grupo.id,
                identificador: grupo.codigo || grupo.nombre || grupo.id || "",
                colorId: grupo.color_id || ""
              });

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
                                setColorGrupoEditar(grupo.color_id || PALETA_BANNERS[0].id);
                                setMenuGrupoAbiertoId(null);
                              }}
                            >
                              Editar grupo
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
        </div>
      ) : (
        <div className="classroom-grid">
          {/* empty grid when no groups - message handled below */}
        </div>
      )}

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
                      const color = obtenerColorEntidad({
                        tipo: "grupo",
                        entidadId: `ejemplo-${i}`,
                        identificador: g.codigo || g.nombre || `ejemplo-${i}`,
                        colorId: ""
                      });
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
                  {gruposUsuario.map(g => {
                    const colorGrupo = obtenerColorEntidad({
                      tipo: "grupo",
                      entidadId: g.id,
                      identificador: g.codigo || g.nombre || g.id || "",
                      colorId: g.color_id || ""
                    });
                    return (
                    <button
                      key={g.id}
                      className="drawer-item drawer-item-color"
                      style={{
                        "--drawer-a": colorGrupo.a,
                        "--drawer-b": colorGrupo.b
                      }}
                      onClick={() => {
                        setMenuAbierto(false);
                        navigate(`/grupos/${g.codigo}`);
                      }}
                    >
                      <span className="drawer-item-name">{g.nombre}</span>
                      <small className="drawer-item-code">{g.codigo}</small>
                    </button>
                    );
                  })}
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

            {tieneSesion && esFundadorVista && (
              <button
                className="drawer-item drawer-metricas-btn"
                onClick={() => {
                  setMenuAbierto(false);
                  navigate("/metricas");
                }}
              >
                Ver metricas
              </button>
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

      <footer className="home-footer" style={{ justifyContent: "space-evenly" }}>
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
          className="home-footer-btn"
          aria-label="Asistente IA"
          onClick={() => {
            if (!tieneSesion) {
              setError("Inicia sesión para acceder al asistente IA.");
              return;
            }
            navigate("/ia");
          }}
        >
          <div className="home-footer-ia">
            <span style={{ fontSize: 18, lineHeight: 1 }}>✨</span>
            <span>IA</span>
          </div>
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
        <div className="modal-overlay" onClick={() => {
          setError("");
          setAccionAbierta("");
        }}>
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
              {error && <div className="alert" style={{ marginBottom: 12 }}>{error}</div>}

              {accionAbierta === "crear" && (
                <>
                  <label className="label">Nombre del grupo</label>
                  <input
                    className="input"
                    value={nombreGrupo}
                    onChange={e => setNombreGrupo(e.target.value)}
                    placeholder="Ej: Cálculo II - Parcial 1"
                  />
                  <label className="label">Color del grupo</label>
                  <div className="color-picker-row">
                    {PALETA_BANNERS.map(color => (
                      <button
                        key={color.id}
                        type="button"
                        className={`color-swatch ${colorNuevoGrupo === color.id ? "selected" : ""}`}
                        style={{ background: `linear-gradient(135deg, ${color.a}, ${color.b})` }}
                        onClick={() => setColorNuevoGrupo(color.id)}
                        aria-label={`Color ${color.id}`}
                      />
                    ))}
                  </div>
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
                  <label className="label">Color del repositorio</label>
                  <div className="color-picker-row">
                    {PALETA_BANNERS.map(color => (
                      <button
                        key={color.id}
                        type="button"
                        className={`color-swatch ${colorNuevoRepo === color.id ? "selected" : ""}`}
                        style={{ background: `linear-gradient(135deg, ${color.a}, ${color.b})` }}
                        onClick={() => setColorNuevoRepo(color.id)}
                        aria-label={`Color ${color.id}`}
                      />
                    ))}
                  </div>
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
              {error && <div className="alert" style={{ marginBottom: 12 }}>{error}</div>}

              <label className="label">Nombre del grupo</label>
              <input
                className="input"
                value={nuevoNombreGrupoEditar}
                onChange={e => setNuevoNombreGrupoEditar(e.target.value)}
                placeholder="Nombre del grupo"
              />
              <label className="label">Color del grupo</label>
              <div className="color-picker-row">
                {PALETA_BANNERS.map(color => (
                  <button
                    key={color.id}
                    type="button"
                    className={`color-swatch ${colorGrupoEditar === color.id ? "selected" : ""}`}
                    style={{ background: `linear-gradient(135deg, ${color.a}, ${color.b})` }}
                    onClick={() => setColorGrupoEditar(color.id)}
                    aria-label={`Color ${color.id}`}
                  />
                ))}
              </div>
              <button className="btn btnPrimary" onClick={manejarGuardarNombreGrupoHome}>
                Guardar cambios
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
              <details className="filters-details">
                <summary className="input filters-summary">
                  <span>Filtros</span>
                  <span className="filters-summary-meta">{fechaFiltroLabel} · {ratingFiltroLabel}</span>
                </summary>
                <div className="filters-body">
                  <select
                    className="input"
                    value={filtroFechaRepos}
                    onChange={e => setFiltroFechaRepos(e.target.value)}
                  >
                    {FECHA_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={filtroRatingRepos}
                    onChange={e => setFiltroRatingRepos(e.target.value)}
                  >
                    {RATING_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </details>
              <div className="repo-suggest-list" style={{ marginTop: 12 }}>
                {reposSugeridos.map(repo => {
                  const color = obtenerColorEntidad({
                    tipo: repo.tipo === "grupo" ? "grupo" : "repo_publico",
                    entidadId: repo.id,
                    identificador: repo.codigo || repo.nombre || repo.titulo || "",
                    colorId: repo.color_id || ""
                  });
                  return (
                    <button
                      key={`${repo.tipo}-${repo.id}`}
                      className="repo-suggest-card"
                      style={{
                        "--drawer-a": color.a,
                        "--drawer-b": color.b
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
                          <small className="repo-suggest-meta">
                            {repo.ratingTotal
                              ? `Calificación: ${Number(repo.ratingPromedio || 0).toFixed(1)}/5 (${repo.ratingTotal})`
                              : "Sin calificaciones"}
                          </small>
                        </>
                      ) : (
                        <>
                          <small className="repo-suggest-meta">Creador: {repo.creadorNombre}</small>
                          <small className="repo-suggest-meta">
                            Creado: {repo.createdAt ? new Date(repo.createdAt).toLocaleDateString() : "-"}
                          </small>
                          <small className="repo-suggest-meta">
                            {repo.ratingTotal
                              ? `Calificacion: ${Number(repo.ratingPromedio || 0).toFixed(1)}/5 (${repo.ratingTotal})`
                              : "Sin calificaciones"}
                          </small>
                        </>
                      )}
                    </button>
                  );
                })}
                {buscandoRepos && <div className="label">Buscando...</div>}
                {!buscandoRepos && (busquedaTexto.trim() || filtroFechaRepos !== "all" || filtroRatingRepos !== "all") && reposSugeridos.length === 0 && (
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

      {error && !accionAbierta && !grupoEditando && <div className="alert">{error}</div>}
    </div>
  );
}


