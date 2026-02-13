import { supabase } from "../config/supabaseClient";

function normalizarTexto(valor = "") {
  return `${valor}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function generarCodigo(longitud = 6) {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let resultado = "";
  for (let i = 0; i < longitud; i++) {
    resultado += caracteres[Math.floor(Math.random() * caracteres.length)];
  }
  return resultado;
}

async function generarCodigoUnico(intentos = 5) {
  for (let i = 0; i < intentos; i++) {
    const codigo = generarCodigo();
    const { data, error } = await supabase
      .from("grupos")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    if (error) throw error;
    if (!data) return codigo;
  }
  throw new Error("No se pudo generar un codigo unico.");
}

function mapearGrupo(grupo, miembros, actividad) {
  return {
    id: grupo.id,
    nombre: grupo.nombre,
    codigo: grupo.codigo,
    creadorId: grupo.creador_id,
    miembros: (miembros || []).map(m => ({
      id: m.id,
      nombre: m.display_name,
      user_id: m.user_id,
      is_admin: m.is_admin
    })),
    actividad: (actividad || []).map(a => ({
      mensaje: a.mensaje,
      fecha: a.fecha,
      actor_id: a.actor_id
    }))
  };
}

export async function listarGruposDelUsuario() {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  const { data, error } = await supabase
    .from("grupo_miembros")
    .select("grupo_id, is_admin, grupos ( id, nombre, codigo, creador_id, created_at )")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });
  if (error) throw error;

  return (data || [])
    .map(item => ({
      ...item.grupos,
      creadorId: item.grupos?.creador_id || null,
      isAdmin: Boolean(item.is_admin)
    }))
    .filter(Boolean);
}

export async function crearGrupo({ nombreGrupo, nombreUsuario }) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  const codigo = await generarCodigoUnico();
  const nombre = nombreGrupo.trim();
  const displayName = nombreUsuario.trim();

  const { data: grupo, error: errorGrupo } = await supabase
    .from("grupos")
    .insert({
      nombre,
      codigo,
      creador_id: user.id
    })
    .select("*")
    .single();
  if (errorGrupo) throw errorGrupo;

  const { data: miembro, error: errorMiembro } = await supabase
    .from("grupo_miembros")
    .insert({
      grupo_id: grupo.id,
      user_id: user.id,
      display_name: displayName,
      is_admin: true
    })
    .select("id, user_id, display_name, is_admin")
    .single();
  if (errorMiembro) throw errorMiembro;

  const mensaje = `${displayName} creo el grupo.`;
  const { data: actividad, error: errorActividad } = await supabase
    .from("grupo_actividad")
    .insert({
      grupo_id: grupo.id,
      actor_id: user.id,
      mensaje
    })
    .select("mensaje, fecha, actor_id")
    .single();
  if (errorActividad) throw errorActividad;

  return mapearGrupo(grupo, [miembro], [actividad]);
}

export async function obtenerVistaPreviaPorCodigo(codigo) {
  const codigoNormalizado = codigo.trim().toUpperCase();
  const { data: grupo, error: errorGrupo } = await supabase
    .from("grupos")
    .select("*")
    .eq("codigo", codigoNormalizado)
    .maybeSingle();
  if (errorGrupo) throw errorGrupo;
  if (!grupo) return null;

  const { data: miembros, error: errorMiembros } = await supabase
    .from("grupo_miembros")
    .select("id, user_id, display_name, is_admin")
    .eq("grupo_id", grupo.id)
    .order("joined_at", { ascending: true });
  if (errorMiembros) throw errorMiembros;

  const { data: actividad, error: errorActividad } = await supabase
    .from("grupo_actividad")
    .select("mensaje, fecha, actor_id")
    .eq("grupo_id", grupo.id)
    .order("fecha", { ascending: false });
  if (errorActividad) throw errorActividad;

  return mapearGrupo(grupo, miembros, actividad);
}

export async function unirseAGrupoPorCodigo({ codigo, nombreUsuario }) {
  const codigoNormalizado = codigo.trim().toUpperCase();

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  const { data: grupo, error: errorGrupo } = await supabase
    .from("grupos")
    .select("*")
    .eq("codigo", codigoNormalizado)
    .maybeSingle();
  if (errorGrupo) throw errorGrupo;
  if (!grupo) throw new Error("El codigo ingresado no existe.");

  const { data: existente, error: errorExiste } = await supabase
    .from("grupo_miembros")
    .select("id, user_id, display_name, is_admin")
    .eq("grupo_id", grupo.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (errorExiste) throw errorExiste;

  let miembro = existente;
  if (!miembro) {
    const displayName = nombreUsuario.trim();
    const { data: nuevoMiembro, error: errorMiembro } = await supabase
      .from("grupo_miembros")
      .insert({
        grupo_id: grupo.id,
        user_id: user.id,
        display_name: displayName,
        is_admin: false
      })
      .select("id, user_id, display_name, is_admin")
      .single();
    if (errorMiembro) throw errorMiembro;
    miembro = nuevoMiembro;

    const mensaje = `${displayName} se ha unido a tu grupo: ${grupo.nombre}`;
    const { error: errorActividad } = await supabase
      .from("grupo_actividad")
      .insert({
        grupo_id: grupo.id,
        actor_id: user.id,
        mensaje
      });
    if (errorActividad) throw errorActividad;
  }

  const { data: miembros, error: errorMiembros } = await supabase
    .from("grupo_miembros")
    .select("id, user_id, display_name, is_admin")
    .eq("grupo_id", grupo.id)
    .order("joined_at", { ascending: true });
  if (errorMiembros) throw errorMiembros;

  const { data: actividad, error: errorActividad } = await supabase
    .from("grupo_actividad")
    .select("mensaje, fecha, actor_id")
    .eq("grupo_id", grupo.id)
    .order("fecha", { ascending: false });
  if (errorActividad) throw errorActividad;

  return mapearGrupo(grupo, miembros, actividad);
}

export async function actualizarNombreGrupo({
  grupoId,
  nombre,
  actorId = null,
  actorNombre = "",
  nombreAnterior = ""
}) {
  const nuevoNombre = nombre.trim();
  const { error } = await supabase
    .from("grupos")
    .update({ nombre: nuevoNombre })
    .eq("id", grupoId);
  if (error) throw error;

  // Registro de actividad (best-effort): no bloqueamos el flujo si falla.
  if (actorId) {
    const mensaje = `RENOMBRE::${actorNombre || "Usuario"} cambió el nombre del grupo${nombreAnterior ? ` de "${nombreAnterior}"` : ""} a "${nuevoNombre}"`;
    const { error: actividadError } = await supabase
      .from("grupo_actividad")
      .insert({
        grupo_id: grupoId,
        actor_id: actorId,
        mensaje
      });
    if (actividadError) {
      console.warn("No se pudo registrar actividad de renombre:", actividadError.message);
    }
  }
}

export async function expulsarMiembro({ grupoId, miembroId }) {
  const { error } = await supabase
    .from("grupo_miembros")
    .delete()
    .eq("id", miembroId)
    .eq("grupo_id", grupoId);
  if (error) throw error;
}

export async function eliminarGrupo({ grupoId }) {
  const { error } = await supabase
    .from("grupos")
    .delete()
    .eq("id", grupoId);
  if (error) throw error;
}

export async function eliminarArchivoGrupo({ grupoId, path }) {
  const { error } = await supabase
    .from("grupo_archivos")
    .delete()
    .eq("grupo_id", grupoId)
    .eq("path", path);
  if (error) throw error;
}

export async function abandonarGrupo({ grupoId }) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  const { error: deleteError } = await supabase
    .from("grupo_miembros")
    .delete()
    .eq("grupo_id", grupoId)
    .eq("user_id", user.id);
  if (deleteError) throw deleteError;

  const { count, error: countError } = await supabase
    .from("grupo_miembros")
    .select("id", { count: "exact", head: true })
    .eq("grupo_id", grupoId);
  if (countError) throw countError;

  if (!count || count === 0) {
    const { error: deleteGroupError } = await supabase
      .from("grupos")
      .delete()
      .eq("id", grupoId);
    if (deleteGroupError) throw deleteGroupError;
  }
}

export async function buscarRepositoriosPublicos(textoBusqueda) {
  const term = `${textoBusqueda || ""}`.trim();
  if (!term) return [];
  const termNorm = normalizarTexto(term);
  const termTokens = termNorm.split(" ").filter(Boolean);

  const [{ data: grupos, error: errorGrupos }, { data: admins, error: errorAdmins }, { data: archivos, error: errorArchivos }] =
    await Promise.all([
      supabase
        .from("grupos")
        .select("id, nombre, codigo, creador_id")
        .limit(250),
      supabase
        .from("grupo_miembros")
        .select("grupo_id, display_name")
        .eq("is_admin", true)
        .limit(250),
      supabase
        .from("grupo_archivos")
        .select("grupo_id, id")
        .limit(1000)
    ]);

  if (errorGrupos) throw errorGrupos;
  if (errorAdmins) throw errorAdmins;
  if (errorArchivos) throw errorArchivos;

  const adminPorGrupo = new Map((admins || []).map(a => [a.grupo_id, a.display_name]));
  const countArchivosPorGrupo = new Map();
  for (const a of archivos || []) {
    countArchivosPorGrupo.set(a.grupo_id, (countArchivosPorGrupo.get(a.grupo_id) || 0) + 1);
  }

  return (grupos || [])
    .map(g => ({
      id: g.id,
      nombre: g.nombre,
      codigo: g.codigo,
      adminNombre: adminPorGrupo.get(g.id) || "Admin",
      archivosCount: countArchivosPorGrupo.get(g.id) || 0
    }))
    .filter(g => {
      const nombreNorm = normalizarTexto(g.nombre);
      const adminNorm = normalizarTexto(g.adminNombre);
      const textoNormalizado = `${nombreNorm} ${adminNorm}`;

      if (!termTokens.length) return false;
      return termTokens.every(token => textoNormalizado.includes(token));
    })
    .sort((a, b) => b.archivosCount - a.archivosCount || a.nombre.localeCompare(b.nombre));
}

export async function listarArchivosGrupoPorId({ grupoId }) {
  const { data, error } = await supabase
    .from("grupo_archivos")
    .select("id, path, nombre, created_at")
    .eq("grupo_id", grupoId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
