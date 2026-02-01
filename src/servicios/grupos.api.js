import { supabase } from "../config/supabaseClient";

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
    miembros: (miembros || []).map(m => ({
      id: m.id,
      nombre: m.display_name,
      user_id: m.user_id,
      is_admin: m.is_admin
    })),
    actividad: (actividad || []).map(a => ({
      mensaje: a.mensaje,
      fecha: a.fecha
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
    .select("grupo_id, grupos ( id, nombre, codigo, created_at )")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });
  if (error) throw error;

  return (data || [])
    .map(item => item.grupos)
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
    .select("mensaje, fecha")
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
    .select("mensaje, fecha")
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

    const mensaje = `${displayName} se unio al grupo.`;
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
    .select("mensaje, fecha")
    .eq("grupo_id", grupo.id)
    .order("fecha", { ascending: false });
  if (errorActividad) throw errorActividad;

  return mapearGrupo(grupo, miembros, actividad);
}

export async function actualizarNombreGrupo({ grupoId, nombre }) {
  const { error } = await supabase
    .from("grupos")
    .update({ nombre: nombre.trim() })
    .eq("id", grupoId);
  if (error) throw error;
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
