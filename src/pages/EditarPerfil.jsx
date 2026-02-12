import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabaseClient";
import "../estilos/flux.css";

const AVATAR_BUCKET = "Flux_repositorioGrupos";

const DIAS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" }
];

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function validarBloque(bloque, existentes, excludeId = null) {
  if (!bloque.startTime || !bloque.endTime) {
    return "Debes definir hora de inicio y fin.";
  }
  const inicio = timeToMinutes(bloque.startTime);
  const fin = timeToMinutes(bloque.endTime);
  if (inicio >= fin) {
    return "La hora de inicio debe ser menor que la hora de fin.";
  }
  const solapa = (existentes || []).some(b => {
    if (excludeId && b.id === excludeId) return false;
    if (b.dayOfWeek !== bloque.dayOfWeek) return false;
    const eInicio = timeToMinutes(b.startTime);
    const eFin = timeToMinutes(b.endTime);
    return inicio < eFin && fin > eInicio;
  });
  if (solapa) {
    return "El bloque se solapa con otro en el mismo día.";
  }
  return "";
}

export default function EditarPerfil() {
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [creadoEn, setCreadoEn] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [career, setCareer] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [passwordActual, setPasswordActual] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [mostrarActual, setMostrarActual] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);

  const [horario, setHorario] = useState([]);
  const [dia, setDia] = useState(1);
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [horaFin, setHoraFin] = useState("12:00");
  const [tipo, setTipo] = useState("");
  const [editandoId, setEditandoId] = useState(null);

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
    const cargar = async () => {
      setError("");
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();
      if (sessionError) {
        setError("No se pudo leer la sesión.");
        setCargando(false);
        return;
      }
      const user = session?.user;
      if (!user) {
        setError("No hay sesión activa.");
        setCargando(false);
        return;
      }
      setEmail(user.email || "");
      setUserId(user.id || "");
      setCreadoEn(user.created_at ? new Date(user.created_at).toLocaleString() : "");
      const meta = user.user_metadata || {};

      const { data: perfilData, error: perfilError } = await supabase
        .from("profiles")
        .select("username, telefono, nombre, apellido, career")
        .eq("id", user.id)
        .maybeSingle();

      if (perfilError) {
        setError("No se pudo cargar el perfil desde la tabla perfiles.");
      }

      const { data: bloquesData, error: bloquesError } = await supabase
        .from("bloques_horario")
        .select("id, day_of_week, start_time, end_time, type")
        .eq("user_id", user.id);

      if (bloquesError) {
        setError("No se pudo cargar los bloques de horario.");
      }

      const perfil = perfilData || {};
      const displayNameValue = meta.display_name || "";
      setDisplayName(displayNameValue);
      setUsername(perfil.username || meta.username || "");
      setTelefono(perfil.telefono || meta.phone || "");
      setNombre(perfil.nombre || meta.first_name || "");
      setApellido(perfil.apellido || meta.last_name || "");
      setCareer(perfil.career || meta.career || "");
      let avatarPublicUrl = "";
      const { data: avatarData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(`avatars/${user.id}`);
      avatarPublicUrl = avatarData?.publicUrl || "";

      if (!avatarPublicUrl) {
        const { data: files } = await supabase.storage
          .from(AVATAR_BUCKET)
          .list(`avatars/${user.id}`, { limit: 1, offset: 0, sortBy: { column: "created_at", order: "desc" } });
        const file = (files || [])[0];
        if (file) {
          const { data: urlData } = supabase.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(`avatars/${user.id}/${file.name}`);
          avatarPublicUrl = urlData?.publicUrl || "";
        }
      }

      setAvatarUrl(meta.avatar_url || avatarPublicUrl || "");
      setAvatarPath(meta.avatar_path || "");
      setHorario(
        (bloquesData || []).map(b => ({
          id: b.id,
          dayOfWeek: b.day_of_week,
          startTime: b.start_time,
          endTime: b.end_time,
          type: b.type || ""
        }))
      );
      setCargando(false);
    };
    cargar();
  }, []);

  function limpiarBloque() {
    setDia(1);
    setHoraInicio("10:00");
    setHoraFin("12:00");
    setTipo("");
    setEditandoId(null);
  }

  function manejarEditarBloque(b) {
    setDia(b.dayOfWeek);
    setHoraInicio(b.startTime);
    setHoraFin(b.endTime);
    setTipo(b.type || "");
    setEditandoId(b.id);
  }

  function manejarEliminarBloque(id) {
    setError("");
    setOk("");
    if (!userId) {
      setError("No hay sesión activa.");
      return;
    }
    supabase
      .from("bloques_horario")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .then(({ error: deleteError }) => {
        if (deleteError) {
          setError(deleteError.message);
          return;
        }
        setHorario(prev => prev.filter(b => b.id !== id));
        if (editandoId === id) limpiarBloque();
        setOk("Bloque eliminado.");
      });
  }

  async function manejarGuardarBloque() {
    try {
      setOk("");
      const errorValidacion = validarBloque(
        {
          dayOfWeek: dia,
          startTime: horaInicio,
          endTime: horaFin,
          type: tipo
        },
        horario,
        editandoId
      );
      if (errorValidacion) {
        setError(errorValidacion);
        return;
      }

      if (!userId) {
        setError("No hay sesión activa.");
        return;
      }

      setError("");

      if (editandoId) {
        const { error: updateError } = await supabase
          .from("bloques_horario")
          .update({
            day_of_week: dia,
            start_time: horaInicio,
            end_time: horaFin,
            type: tipo || null
          })
          .eq("id", editandoId)
          .eq("user_id", userId);

        if (updateError) {
          setError(updateError.message);
          return;
        }

        setHorario(prev =>
          prev.map(b =>
            b.id === editandoId
              ? {
                  ...b,
                  dayOfWeek: dia,
                  startTime: horaInicio,
                  endTime: horaFin,
                  type: tipo
                }
              : b
          )
        );
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from("bloques_horario")
          .insert({
            user_id: userId,
            day_of_week: dia,
            start_time: horaInicio,
            end_time: horaFin,
            type: tipo || null
          })
          .select("id, day_of_week, start_time, end_time, type")
          .single();

        if (insertError) {
          setError(insertError.message);
          return;
        }

        const nuevo = {
          id: insertData.id,
          dayOfWeek: insertData.day_of_week,
          startTime: insertData.start_time,
          endTime: insertData.end_time,
          type: insertData.type || ""
        };
        setHorario(prev => [...prev, nuevo]);
      }
      limpiarBloque();
      setOk("Horario actualizado.");
    } catch (e) {
      setError(e?.message || "Error inesperado al guardar el horario.");
    }
  }

  async function guardarPerfil() {
    setError("");
    setOk("");

    const computedDisplayName = displayName.trim() || `${nombre.trim()} ${apellido.trim()}`.trim();
    if (!computedDisplayName) {
      setError("El display name es obligatorio.");
      return;
    }

    if (password || passwordConfirm) {
      if (!passwordActual) {
        setError("Debes ingresar tu contraseña actual.");
        return;
      }
      const regex = /^(?=.*\d)(?=.*[A-Z]).{8,}$/;
      if (!regex.test(password)) {
        setError("La contraseña debe tener: 8 caracteres, 1 mayúscula y 1 número.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }

    setGuardando(true);
    if (password || passwordConfirm) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordActual
      });
      if (authError) {
        setError("La contraseña actual no es correcta.");
        setGuardando(false);
        return;
      }
    }

    const payload = {
      data: {
        display_name: computedDisplayName,
        username: username.trim(),
        phone: telefono.trim(),
        first_name: nombre.trim(),
        last_name: apellido.trim(),
        career: career.trim(),
        avatar_url: avatarUrl.trim(),
        avatar_path: avatarPath || ""
      }
    };
    if (password) {
      payload.password = password;
    }

    const { error: updateError } = await supabase.auth.updateUser(payload);
    if (updateError) {
      setError(updateError.message);
      setGuardando(false);
      return;
    }

    const { error: perfilError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          username: username.trim(),
          telefono: telefono.trim(),
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          career: career.trim()
        },
        { onConflict: "id" }
      );

    if (perfilError) {
      setError(perfilError.message);
      setGuardando(false);
      return;
    }

    setDisplayName(computedDisplayName);
    setOk("Perfil actualizado.");
    setPasswordActual("");
    setPassword("");
    setPasswordConfirm("");
    setGuardando(false);
  }

  async function manejarSubirAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5MB.");
      return;
    }

    setError("");
    setOk("");
    setAvatarUploading(true);
    const path = `avatars/${userId}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setError(uploadError.message);
      setAvatarUploading(false);
      return;
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setAvatarPath(path);
    setOk("Foto cargada. Guarda cambios.");
    setAvatarUploading(false);
  }

  function manejarEliminarAvatar() {
    setAvatarUrl("");
    setAvatarPath("");
    setOk("Foto eliminada. Guarda cambios.");
  }

  if (cargando) {
    return (
      <div className="container">
        <div className="card">Cargando perfil...</div>
      </div>
    );
  }

  const iniciales = (displayName || email || "?")
    .split(" ")
    .map(p => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <div className="logoDot" />
          <div>
            <div className="brandTitle">FLUX</div>
            <div className="brandSubtitle">Editar perfil</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn arrow-back" style={{ marginTop: 0 }} onClick={() => navigate(-1)} aria-label="Atrás">
            <svg
              className="arrow-back-icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M15 6L9 12L15 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="btn"
            style={{ width: "auto", marginTop: 0 }}
            onClick={() => supabase.auth.signOut()}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="perfil-grid">
        <div className="card cuenta-card">
            <strong>Cuenta</strong>
            <div className="profile-grid">
              <div>
                <label className="label">Email</label>
                <input className="input" value={email} readOnly />
              </div>
              <div>
                <label className="label">User ID</label>
                <input className="input" value={userId} readOnly />
              </div>
              <div>
                <label className="label">Creado</label>
                <input className="input" value={creadoEn} readOnly />
              </div>
            </div>
          </div>

          <div className="card password-card">
            <strong>Cambiar contraseña</strong>
            <div className="password-grid">
              <div>
                <label className="label">Contraseña actual</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={mostrarActual ? "text" : "password"}
                    value={passwordActual}
                    onChange={e => setPasswordActual(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-eye"
                    aria-label={mostrarActual ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={mostrarActual}
                    onClick={() => setMostrarActual(v => !v)}
                  >
                    {mostrarActual ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94" />
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6 0 10 8 10 8a21.79 21.79 0 0 1-3.17 4.26" />
                        <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                        <path d="M1 1l22 22" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Nueva contraseña</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={mostrarNueva ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-eye"
                    aria-label={mostrarNueva ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={mostrarNueva}
                    onClick={() => setMostrarNueva(v => !v)}
                  >
                    {mostrarNueva ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94" />
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6 0 10 8 10 8a21.79 21.79 0 0 1-3.17 4.26" />
                        <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                        <path d="M1 1l22 22" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirmar contraseña</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={mostrarConfirm ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-eye"
                    aria-label={mostrarConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={mostrarConfirm}
                    onClick={() => setMostrarConfirm(v => !v)}
                  >
                    {mostrarConfirm ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94" />
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6 0 10 8 10 8a21.79 21.79 0 0 1-3.17 4.26" />
                        <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                        <path d="M1 1l22 22" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card perfil-card">
            <strong>Perfil</strong>
            <div className="profile-layout">
              <div className="profile-fields">
                <div className="profile-grid">
                  <div>
                    <label className="label">Display name</label>
                    <input
                      className="input"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Username</label>
                    <input
                      className="input"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Tu usuario"
                    />
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <input
                      className="input"
                      type="tel"
                      value={telefono}
                      onChange={e => setTelefono(e.target.value)}
                      placeholder="Tu número de teléfono"
                    />
                  </div>
                  <div>
                    <label className="label">Nombre</label>
                    <input
                      className="input"
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="label">Apellido</label>
                    <input
                      className="input"
                      value={apellido}
                      onChange={e => setApellido(e.target.value)}
                      placeholder="Tu apellido"
                    />
                  </div>
                  <div>
                    <label className="label">Carrera</label>
                    <input
                      className="input"
                      value={career}
                      onChange={e => setCareer(e.target.value)}
                      placeholder="Ej: Ingeniería de Sistemas"
                    />
                  </div>
                </div>
              </div>
              <div className="profile-avatar">
                <div className="avatar-hero">
                  {avatarUrl ? (
                    <img
                      className="avatar-img"
                      src={avatarUrl}
                      alt="Foto de perfil"
                      onError={() => setAvatarUrl("")}
                    />
                  ) : (
                    <div className="avatar-fallback">{iniciales}</div>
                  )}
                  <label className="avatar-edit-button">
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={e => manejarSubirAvatar(e.target.files?.[0])}
                    />
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </label>
                </div>
                <div className="label" style={{ marginTop: 8 }}>
                  {avatarUploading ? "Subiendo..." : "Cambiar foto"}
                </div>
                {avatarUrl && (
                  <button
                    className="btn"
                    style={{ width: "auto", padding: "6px 10px" }}
                    onClick={manejarEliminarAvatar}
                  >
                    Eliminar foto
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card horario-card">
            <strong>Horario semanal</strong>
            <div className="schedule-form">
              <div>
                <label className="label">Día</label>
                <select
                  className="input"
                  value={dia}
                  onChange={e => setDia(Number(e.target.value))}
                >
                  {DIAS.map(d => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Inicio</label>
                <input
                  className="input"
                  type="time"
                  value={horaInicio}
                  onChange={e => setHoraInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Fin</label>
                <input
                  className="input"
                  type="time"
                  value={horaFin}
                  onChange={e => setHoraFin(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Tipo (opcional)</label>
                <input
                  className="input"
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  placeholder="Ej: Estudio / Clase"
                />
              </div>
            </div>
            <div className="schedule-actions">
              <button className="btn btnPrimary" onClick={manejarGuardarBloque}>
                {editandoId ? "Actualizar bloque" : "Agregar bloque"}
              </button>
              {editandoId && (
                <button className="btn" onClick={limpiarBloque}>
                  Cancelar edición
                </button>
              )}
            </div>

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
                    <div className="schedule-item-actions">
                      <button className="btn" onClick={() => manejarEditarBloque(b)}>
                        Editar
                      </button>
                      <button className="btn" onClick={() => manejarEliminarBloque(b.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              {horario.length === 0 && (
                <div className="label">Aún no tienes bloques guardados.</div>
              )}
            </div>
            <div className="label" style={{ marginTop: 8 }}>
              Resumen: {resumenHorario}
            </div>
          </div>
      </div>

      <div style={{ height: 16 }} />

      {error && <div className="alert">{error}</div>}
      {ok && <div className="preview">{ok}</div>}

      <div style={{ height: 12 }} />

      <button className="btn btnPrimary" onClick={guardarPerfil} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}
