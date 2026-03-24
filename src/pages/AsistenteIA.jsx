import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabaseClient";
import {
  listarGruposDelUsuario,
  listarTareasGrupo,
  guardarMensajeChat,
  listarHistorialChat,
  eliminarHistorialChatPorId
} from "../servicios/grupos.api";
import { generarPlanEstudio, chatConIA } from "../servicios/ia.api";
import "../estilos/flux.css";

const DIAS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" }
];

export default function AsistenteIA() {
  const navigate = useNavigate();
  const [tabActiva, setTabActiva] = useState("planificador");

  // ── Sesión ──────────────────────────────────────────────
  const [userId, setUserId] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [cargandoSesion, setCargandoSesion] = useState(true);

  // ── Tab Planificador ────────────────────────────────────
  const [tareasPendientes, setTareasPendientes] = useState([]);
  const [horario, setHorario] = useState([]);
  const [reposGrupos, setReposGrupos] = useState([]);
  const [cargandoContexto, setCargandoContexto] = useState(false);
  const [restriccionesPlan, setRestriccionesPlan] = useState(""); // 🟢 NUEVO: Estado para restricciones
  const [generandoPlan, setGenerandoPlan] = useState(false);
  const [planResultado, setPlanResultado] = useState("");
  const [errorPlan, setErrorPlan] = useState("");

  // ── Tab Chat ─────────────────────────────────────────────
  const [mensajesChat, setMensajesChat] = useState([]);
  const [inputChat, setInputChat] = useState("");
  const [enviandoChat, setEnviandoChat] = useState(false);
  const [errorChat, setErrorChat] = useState("");
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [chatsGuardados, setChatsGuardados] = useState([]);
  const [chatActivoId, setChatActivoId] = useState(null);
  const [titulosPersonalizados, setTitulosPersonalizados] = useState({});
  const [editandoChatId, setEditandoChatId] = useState(null);
  const [tituloEditando, setTituloEditando] = useState("");
  const [menuChatIdAbierto, setMenuChatIdAbierto] = useState(null);
  const [eliminandoChatId, setEliminandoChatId] = useState(null);
  const chatEndRef = useRef(null);

  // ─────────────────────────────────────────────────────────
  // Cargar sesión inicial
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
      setDisplayName(session?.user?.user_metadata?.display_name || session?.user?.email || "");
      setCargandoSesion(false);
    });
  }, []);

  // ─────────────────────────────────────────────────────────
  // Cargar contexto del usuario (horario + grupos + tareas)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const cargar = async () => {
      setCargandoContexto(true);
      try {
        const { data: bloquesData } = await supabase
          .from("bloques_horario")
          .select("id, day_of_week, start_time, end_time, type")
          .eq("user_id", userId);

        const bloques = (bloquesData || []).map(b => ({
          id: b.id,
          dayOfWeek: b.day_of_week,
          startTime: b.start_time,
          endTime: b.end_time,
          type: b.type || ""
        }));
        setHorario(bloques);

        const grupos = await listarGruposDelUsuario();
        setReposGrupos(grupos);

        const todasTareas = [];
        await Promise.all(
          grupos.map(async g => {
            try {
              const tareas = await listarTareasGrupo(g.id);
              const pendientes = (tareas || [])
                .filter(t => !t.completada)
                .map(t => ({ ...t, grupo_nombre: g.nombre }));
              todasTareas.push(...pendientes);
            } catch {
              // ignorar grupos con error
            }
          })
        );
        setTareasPendientes(todasTareas);
      } catch (e) {
        console.error("Error cargando contexto IA:", e);
      } finally {
        setCargandoContexto(false);
      }
    };

    cargar();
  }, [userId]);

  // Cargar historial de chat al entrar al tab de chat
  useEffect(() => {
    if (tabActiva !== "chat" || !userId) return;
    const cargar = async () => {
      setCargandoHistorial(true);
      try {
        const historial = await listarHistorialChat();
        const conversaciones = construirConversaciones(historial);
        setChatsGuardados(conversaciones);
        setChatActivoId(null);
        setMensajesChat([]);
        setMenuChatIdAbierto(null);
      } catch (e) {
        console.error("Error cargando historial de chat:", e);
      } finally {
        setCargandoHistorial(false);
      }
    };
    cargar();
  }, [tabActiva, userId]);

  useEffect(() => {
    if (!userId) return;
    const key = `flux_chat_titles_${userId}`;
    try {
      const raw = localStorage.getItem(key);
      setTitulosPersonalizados(raw ? JSON.parse(raw) : {});
    } catch {
      setTitulosPersonalizados({});
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const key = `flux_chat_titles_${userId}`;
    localStorage.setItem(key, JSON.stringify(titulosPersonalizados));
  }, [titulosPersonalizados, userId]);

  useEffect(() => {
    if (tabActiva === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajesChat, tabActiva]);

  useEffect(() => {
    if (!menuChatIdAbierto) return;

    const onPointerDown = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".classroom-card-menu-wrap")) return;
      setMenuChatIdAbierto(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [menuChatIdAbierto]);

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────
  function buildContextoUsuario() {
    return {
      nombreUsuario: displayName,
      grupos: reposGrupos.map(g => g.nombre),
      horario: horario.map(b => {
        const dia = DIAS.find(d => d.value === b.dayOfWeek)?.label || "?";
        return `${dia} ${b.startTime}-${b.endTime} (${b.type || "Clase"})`;
      }),
      tareasPendientes: tareasPendientes.map(t => t.titulo)
    };
  }

  function crearChatId() {
    return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function crearTituloChat(texto = "") {
    const limpio = `${texto}`.trim().replace(/\s+/g, " ");
    if (!limpio) return "Chat sin título";
    return limpio.length > 48 ? `${limpio.slice(0, 48)}...` : limpio;
  }

  function construirConversaciones(historial = []) {
    const porChat = new Map();
    const ordenado = [...historial].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const item of ordenado) {
      const id = item.chat_id || "legacy";
      if (!porChat.has(id)) {
        porChat.set(id, {
          id,
          titulo: crearTituloChat(item.mensaje_usuario),
          updatedAt: item.created_at,
          mensajes: []
        });
      }

      const chat = porChat.get(id);
      chat.mensajes.push({ role: "user", text: item.mensaje_usuario });
      chat.mensajes.push({ role: "assistant", text: item.respuesta_ia });
      chat.updatedAt = item.created_at;
    }

    return [...porChat.values()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  function obtenerTituloVisual(chat) {
    return titulosPersonalizados[chat.id] || chat.titulo || "Chat sin título";
  }

  function upsertConversacionLocal({ id, mensajes, updatedAt, tituloBase = "" }) {
    setChatsGuardados(prev => {
      const base = prev.filter(c => c.id !== id);
      const existente = prev.find(c => c.id === id);
      const conv = {
        id,
        titulo: existente?.titulo || crearTituloChat(tituloBase),
        updatedAt: updatedAt || new Date().toISOString(),
        mensajes
      };
      return [conv, ...base].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }

  function iniciarNuevoChat() {
    const id = crearChatId();
    setChatActivoId(id);
    setMensajesChat([]);
    setErrorChat("");
    setEditandoChatId(null);
    setTituloEditando("");
    setMenuChatIdAbierto(null);
  }

  function seleccionarChat(id) {
    const chat = chatsGuardados.find(c => c.id === id);
    if (!chat) return;
    setChatActivoId(id);
    setMensajesChat(chat.mensajes);
    setErrorChat("");
    setMenuChatIdAbierto(null);
  }

  function formatearFechaChat(fecha) {
    if (!fecha) return "";
    return new Date(fecha).toLocaleDateString();
  }

  function iniciarEdicionTitulo(chat) {
    setEditandoChatId(chat.id);
    setTituloEditando(obtenerTituloVisual(chat));
    setMenuChatIdAbierto(null);
  }

  function cancelarEdicionTitulo() {
    setEditandoChatId(null);
    setTituloEditando("");
  }

  function guardarTituloChat(chat) {
    const limpio = tituloEditando.trim().replace(/\s+/g, " ");
    if (!limpio) {
      setTitulosPersonalizados(prev => {
        const next = { ...prev };
        delete next[chat.id];
        return next;
      });
    } else {
      setTitulosPersonalizados(prev => ({ ...prev, [chat.id]: limpio }));
    }
    setEditandoChatId(null);
    setTituloEditando("");
  }

  function toggleMenuChat(chatId) {
    setMenuChatIdAbierto(prev => (prev === chatId ? null : chatId));
  }

  async function eliminarChat(chat) {
    const confirmar = window.confirm(`¿Seguro que deseas eliminar "${obtenerTituloVisual(chat)}"?`);
    if (!confirmar) return;

    setMenuChatIdAbierto(null);
    setEliminandoChatId(chat.id);
    setErrorChat("");

    try {
      await eliminarHistorialChatPorId(chat.id);
      const restantes = chatsGuardados.filter(c => c.id !== chat.id);
      setChatsGuardados(restantes);
      setTitulosPersonalizados(prev => {
        const next = { ...prev };
        delete next[chat.id];
        return next;
      });

      if (chatActivoId === chat.id) {
        if (restantes.length > 0) {
          setChatActivoId(restantes[0].id);
          setMensajesChat(restantes[0].mensajes);
        } else {
          iniciarNuevoChat();
        }
      }
    } catch (e) {
      setErrorChat(e.message || "No se pudo eliminar el chat.");
    } finally {
      setEliminandoChatId(null);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────
  async function manejarGenerarPlan() {
    setErrorPlan("");
    setPlanResultado("");
    setGenerandoPlan(true);
    try {
      const resultado = await generarPlanEstudio({ 
        tareas: tareasPendientes, 
        horario,
        restricciones: restriccionesPlan // 🟢 Se envían las restricciones a la API
      });
      setPlanResultado(resultado);
    } catch (e) {
      setErrorPlan(e.message);
    } finally {
      setGenerandoPlan(false);
    }
  }

  async function manejarEnviarChat() {
    const texto = inputChat.trim();
    if (!texto || enviandoChat) return;

    const chatIdActual = chatActivoId || crearChatId();
    if (!chatActivoId) setChatActivoId(chatIdActual);

    const nuevoMensajeUsuario = { role: "user", text: texto };
    const mensajesActualizados = [...mensajesChat, nuevoMensajeUsuario];
    setMensajesChat(mensajesActualizados);
    setInputChat("");
    setEnviandoChat(true);
    setErrorChat("");
    upsertConversacionLocal({
      id: chatIdActual,
      mensajes: mensajesActualizados,
      updatedAt: new Date().toISOString(),
      tituloBase: texto
    });

    try {
      const respuesta = await chatConIA({
        mensajes: mensajesActualizados,
        contextoUsuario: buildContextoUsuario()
      });
      const nuevoMensajeIA = { role: "assistant", text: respuesta };
      const mensajesFinales = [...mensajesActualizados, nuevoMensajeIA];
      setMensajesChat(mensajesFinales);
      upsertConversacionLocal({
        id: chatIdActual,
        mensajes: mensajesFinales,
        updatedAt: new Date().toISOString(),
        tituloBase: texto
      });

      guardarMensajeChat({ mensajeUsuario: texto, respuestaIA: respuesta, chatId: chatIdActual }).catch(
        e => console.error("Error guardando chat:", e)
      );
    } catch (e) {
      setErrorChat(e.message);
    } finally {
      setEnviandoChat(false);
    }
  }

  function manejarTeclasChat(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      manejarEnviarChat();
    }
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  if (cargandoSesion) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: "center", padding: "20px" }}>
          ⏳ Cargando asistente...
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: "center" }}>
          <span style={{ fontSize: "2rem" }}>🔒</span>
          <p>Inicia sesión para acceder al asistente IA.</p>
          <button className="btn btnPrimary" onClick={() => navigate("/auth")} style={{ marginTop: "12px" }}>
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const chatActivo = chatsGuardados.find(c => c.id === chatActivoId) || null;
  const tituloChatActivo = chatActivo ? obtenerTituloVisual(chatActivo) : "Selecciona un chat";

  return (
    <div className="container">
      {/* Topbar */}
      <div className="topbar">
        <div className="brand">
          <div className="logoDot" />
          <div>
            <div className="brandTitle">FLUX</div>
            <div className="brandSubtitle">Asistente IA</div>
          </div>
        </div>
        <button
          className="btn arrow-back"
          style={{ marginTop: 0 }}
          onClick={() => navigate(-1)}
          aria-label="Atrás"
        >
          <svg className="arrow-back-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {cargandoContexto && (
        <div className="card" style={{ textAlign: "center", color: "var(--primario)" }}>
          Cargando tu información académica...
        </div>
      )}

      {/* Tabs Simplificadas (Sin Resumidor) */}
      <div className="group-tabs">
        <button
          className={`group-tab ${tabActiva === "planificador" ? "active" : ""}`}
          onClick={() => setTabActiva("planificador")}
        >
          🗓️ Planificador
        </button>
        <button
          className={`group-tab ${tabActiva === "chat" ? "active" : ""}`}
          onClick={() => setTabActiva("chat")}
        >
          💬 Chat Libre
        </button>
      </div>

      {/* ── TAB 1: Planificador ── */}
      {tabActiva === "planificador" && (
        <div className="group-tab-content">
          
          <div
            className="card"
            style={{
              position: "relative",
              zIndex: menuChatIdAbierto ? 40 : "auto"
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Tu Contexto Académico</h3>
            
            <div style={{ marginBottom: "16px" }}>
              <strong>📋 Tareas pendientes</strong>
              {tareasPendientes.length === 0 ? (
                <p className="label" style={{ marginTop: 8 }}>
                  No tienes tareas pendientes. ¡Excelente! 🎉
                </p>
              ) : (
                <ul className="ia-lista" style={{ marginTop: 8 }}>
                  {tareasPendientes.map(t => (
                    <li key={t.id} className="ia-lista-item">
                      <span className="ia-lista-dot" />
                      <span>
                        <strong>{t.titulo}</strong>
                        <span className="label" style={{ marginLeft: 6 }}>({t.grupo_nombre})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--borde)", margin: "16px 0" }} />

            <div>
              <strong>⏰ Tu horario semanal</strong>
              {horario.length === 0 ? (
                <p className="label" style={{ marginTop: 8 }}>
                  Sin horario definido. Agrégalo en tu{" "}
                  <button
                    className="btn"
                    style={{ display: "inline", padding: "0 4px", minHeight: "auto", color: "var(--primario)" }}
                    onClick={() => navigate("/perfil/editar")}
                  >
                    perfil
                  </button>
                  {" "}para resultados más precisos.
                </p>
              ) : (
                <div className="ia-horario-grid" style={{ marginTop: 8 }}>
                  {horario
                    .slice()
                    .sort((a, b) =>
                      a.dayOfWeek === b.dayOfWeek
                        ? a.startTime.localeCompare(b.startTime)
                        : a.dayOfWeek - b.dayOfWeek
                    )
                    .map(b => {
                      const dia = DIAS.find(d => d.value === b.dayOfWeek)?.label || "?";
                      return (
                        <div key={b.id} className="ia-bloque">
                          <span className="ia-bloque-dia">{dia}</span>
                          <span className="ia-bloque-hora">
                            {b.startTime}–{b.endTime}
                          </span>
                          {b.type && <span className="ia-bloque-tipo">{b.type}</span>}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* 🟢 NUEVO: Tarjeta de Restricciones */}
          <div className="card" style={{ marginTop: 12 }}>
            <strong style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              ⚙️ Reglas y Preferencias
            </strong>
            <p className="label" style={{ marginTop: 4, marginBottom: 12 }}>
              ¿Tienes alguna limitación? Ej: "No me pongas a estudiar los sábados", "Solo puedo estudiar de 8pm a 10pm".
            </p>
            <textarea
              className="input"
              rows={2}
              value={restriccionesPlan}
              onChange={e => setRestriccionesPlan(e.target.value)}
              placeholder="Escribe tus reglas aquí (opcional)..."
              disabled={generandoPlan || cargandoContexto}
            />
          </div>

          {errorPlan && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              {errorPlan}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              className="btn btnPrimary"
              style={{ width: "100%", padding: "12px", fontSize: "1.1rem" }}
              onClick={manejarGenerarPlan}
              disabled={generandoPlan || cargandoContexto}
            >
              {generandoPlan ? "⏳ Analizando tu rutina..." : "✨ Generar Plan de Estudio"}
            </button>
          </div>

          {planResultado && (
            <div className="card ia-resultado" style={{ marginTop: 16 }}>
              <strong style={{ display: "block", marginBottom: 8, fontSize: "1.1rem" }}>🎯 Tu Plan Generado</strong>
              <pre className="ia-pre">{planResultado}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Chat libre ── */}
      {tabActiva === "chat" && (
        <div className="group-tab-content">
          <div className="card">
            <div className="ia-chat-sesiones-head">
              <strong>Historial de Chats</strong>
              <button className="btn btn-secundario ia-chat-nuevo-btn" onClick={iniciarNuevoChat}>
                + Nuevo chat
              </button>
            </div>

            {cargandoHistorial ? (
              <p className="label" style={{ marginTop: 8 }}>Cargando historial...</p>
            ) : chatsGuardados.length === 0 ? (
              <p className="label" style={{ marginTop: 8 }}>Aún no tienes chats guardados.</p>
            ) : (
              <div className="ia-chat-sesiones-lista" style={{ marginTop: 8 }}>
                {chatsGuardados.map(c => (
                  <div
                    key={c.id}
                    className={`ia-chat-sesion-btn ${chatActivoId === c.id ? "active" : ""}`}
                    style={{ position: "relative", display: "flex", alignItems: "center" }}
                  >
                    {editandoChatId === c.id ? (
                      <div style={{ width: "100%", display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          className="input"
                          value={tituloEditando}
                          onChange={e => setTituloEditando(e.target.value)}
                          placeholder="Nombre del chat"
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              guardarTituloChat(c);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelarEdicionTitulo();
                            }
                          }}
                        />
                        <button className="btn btn-secundario" onClick={() => guardarTituloChat(c)}>Guardar</button>
                        <button className="btn" onClick={cancelarEdicionTitulo}>Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <button
                          className="btn"
                          style={{
                            flex: 1,
                            justifyContent: "space-between",
                            display: "flex",
                            paddingRight: 44
                          }}
                          onClick={() => seleccionarChat(c.id)}
                        >
                          <span>{obtenerTituloVisual(c)}</span>
                          <span className="label">{formatearFechaChat(c.updatedAt)}</span>
                        </button>
                        <div
                          className="classroom-card-menu-wrap"
                          style={{
                            left: "auto",
                            right: 8,
                            top: "50%",
                            transform: "translateY(-50%)",
                            zIndex: 25
                          }}
                        >
                          <button
                            className="classroom-card-kebab"
                            aria-label={`Opciones de ${obtenerTituloVisual(c)}`}
                            onClick={() => toggleMenuChat(c.id)}
                            disabled={eliminandoChatId === c.id}
                          >
                            ⋯
                          </button>

                          {menuChatIdAbierto === c.id && (
                            <div
                              className="classroom-card-menu"
                              style={{
                                position: "absolute",
                                right: 0,
                                bottom: "calc(100% + 6px)",
                                zIndex: 999
                              }}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                className="classroom-card-menu-item"
                                onClick={() => iniciarEdicionTitulo(c)}
                              >
                                Renombrar chat
                              </button>
                              <button
                                className="classroom-card-menu-item danger"
                                onClick={() => eliminarChat(c)}
                                disabled={eliminandoChatId === c.id}
                              >
                                {eliminandoChatId === c.id ? "Eliminando..." : "Eliminar chat"}
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card chat-card">
            <div className="chat-header">
              <strong>Chat con FLUX IA: {tituloChatActivo}</strong>
              <span className="label">Resuelve dudas sobre tus materias o tareas</span>
            </div>

            <div className="ia-chat-messages">
              {cargandoHistorial && (
                <p className="label" style={{ textAlign: "center", padding: 16 }}>
                  Cargando...
                </p>
              )}
              {!cargandoHistorial && mensajesChat.length === 0 && (
                <div className="ia-chat-empty">
                  <span style={{ fontSize: "2.5rem" }}>👋</span>
                  <p>
                    {chatActivoId
                      ? `¡Hola${displayName ? `, ${displayName.split(" ")[0]}` : ""}! Soy FLUX IA. ¿En qué te puedo ayudar hoy?`
                      : "Selecciona un chat del historial o crea uno nuevo para empezar."}
                  </p>
                </div>
              )}
              {mensajesChat.map((m, i) => (
                <div
                  key={i}
                  className={`ia-chat-bubble ${m.role === "user" ? "ia-bubble-user" : "ia-bubble-ia"}`}
                >
                  <pre className="ia-pre ia-pre-chat">{m.text}</pre>
                </div>
              ))}
              {enviandoChat && (
                <div className="ia-chat-bubble ia-bubble-ia">
                  <span className="ia-typing">Escribiendo...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {errorChat && (
              <div className="alert alert-error" style={{ marginTop: 8 }}>
                {errorChat}
              </div>
            )}

            <div className="chat-input" style={{ marginTop: 12 }}>
              <textarea
                className="input"
                rows={2}
                value={inputChat}
                onChange={e => setInputChat(e.target.value)}
                onKeyDown={manejarTeclasChat}
                placeholder="Pregúntame algo... (Enter para enviar)"
                disabled={enviandoChat}
              />
              <button
                className="btn btnPrimary"
                onClick={manejarEnviarChat}
                disabled={enviandoChat || !inputChat.trim()}
              >
                {enviandoChat ? "⏳" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
