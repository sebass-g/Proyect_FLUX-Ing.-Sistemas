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
    esPublico: Boolean(grupo.es_publico),
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

export async function crearGrupo({ nombreGrupo, nombreUsuario, esPublico = false }) {
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
      creador_id: user.id,
      es_publico: esPublico
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

async function obtenerUsuarioActual() {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  return session?.user || null;
}

async function usuarioPuedeLeerGrupo({ grupoId, creadorId, esPublico, userId }) {
  if (esPublico) return true;
  if (!userId) return false;
  if (creadorId && creadorId === userId) return true;

  const { data: miembro, error: miembroError } = await supabase
    .from("grupo_miembros")
    .select("id")
    .eq("grupo_id", grupoId)
    .eq("user_id", userId)
    .maybeSingle();
  if (miembroError) throw miembroError;
  return Boolean(miembro);
}

export async function obtenerRepositorioParaLecturaPorCodigo(codigo) {
  const codigoNormalizado = codigo.trim().toUpperCase();
  const { data: grupo, error: errorGrupo } = await supabase
    .from("grupos")
    .select("id, nombre, codigo, creador_id, es_publico")
    .eq("codigo", codigoNormalizado)
    .maybeSingle();
  if (errorGrupo) throw errorGrupo;
  if (!grupo) return null;

  const user = await obtenerUsuarioActual();
  const permitido = await usuarioPuedeLeerGrupo({
    grupoId: grupo.id,
    creadorId: grupo.creador_id,
    esPublico: Boolean(grupo.es_publico),
    userId: user?.id || null
  });
  if (!permitido) return null;

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

export async function actualizarVisibilidadGrupo({
  grupoId,
  esPublico,
  actorId = null,
  actorNombre = ""
}) {
  const valor = Boolean(esPublico);
  const { error } = await supabase
    .from("grupos")
    .update({ es_publico: valor })
    .eq("id", grupoId);
  if (error) throw error;

  if (actorId) {
    const mensaje = `VISIBILIDAD::${actorNombre || "Usuario"} cambió la visibilidad del repositorio a ${valor ? "público" : "privado"}.`;
    const { error: actividadError } = await supabase
      .from("grupo_actividad")
      .insert({
        grupo_id: grupoId,
        actor_id: actorId,
        mensaje
      });
    if (actividadError) {
      console.warn("No se pudo registrar actividad de visibilidad:", actividadError.message);
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

export async function buscarRepositoriosPublicos(
  textoBusqueda,
  filtroFecha = "all",
  filtroRating = "all"
) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const esGuest = !session?.user;

  const term = `${textoBusqueda || ""}`.trim();
  const termNorm = normalizarTexto(term);
  const termTokens = termNorm.split(" ").filter(Boolean);
  const ahora = new Date();

  let desde = null;
  if (filtroFecha === "1m") {
    desde = new Date(ahora);
    desde.setMonth(desde.getMonth() - 1);
  } else if (filtroFecha === "3m") {
    desde = new Date(ahora);
    desde.setMonth(desde.getMonth() - 3);
  } else if (filtroFecha === "1y") {
    desde = new Date(ahora);
    desde.setFullYear(desde.getFullYear() - 1);
  }

  let minRating = null;
  if (filtroRating !== "all") {
    const parsed = Number(filtroRating);
    if (Number.isFinite(parsed)) {
      minRating = Math.min(Math.max(parsed, 1), 5);
    }
  }

  if (!term && !desde && !minRating) return [];

  let queryGrupos = supabase
    .from("grupos")
    .select("id, nombre, codigo, creador_id, es_publico, created_at")
    .eq("es_publico", true)
    .limit(250);
  if (desde) queryGrupos = queryGrupos.gte("created_at", desde.toISOString());

  let queryReposPublicos = supabase
    .from("repositorios_publicos")
    .select("id, titulo, creador_id, creador_nombre, created_at")
    .limit(250);
  if (desde) queryReposPublicos = queryReposPublicos.gte("created_at", desde.toISOString());

  let grupos = [];
  let reposPublicos = [];
  let admins = [];
  let archivos = [];
  let ratings = [];

  if (esGuest) {
    const [
      { data: gruposData, error: errorGrupos },
      { data: reposData, error: errorReposPublicos }
    ] = await Promise.all([queryGrupos, queryReposPublicos]);

    if (errorGrupos) throw errorGrupos;
    if (errorReposPublicos) throw errorReposPublicos;
    grupos = gruposData || [];
    reposPublicos = reposData || [];
  } else {
    const [
      { data: gruposData, error: errorGrupos },
      { data: adminsData, error: errorAdmins },
      { data: archivosData, error: errorArchivos },
      { data: reposData, error: errorReposPublicos }
    ] =
      await Promise.all([
        queryGrupos,
        supabase
          .from("grupo_miembros")
          .select("grupo_id, display_name")
          .eq("is_admin", true)
          .limit(250),
        supabase
          .from("grupo_archivos")
          .select("grupo_id, id")
          .limit(1000),
        queryReposPublicos
      ]);

    if (errorGrupos) throw errorGrupos;
    if (errorAdmins) throw errorAdmins;
    if (errorArchivos) throw errorArchivos;
    if (errorReposPublicos) throw errorReposPublicos;

    grupos = gruposData || [];
    reposPublicos = reposData || [];
    admins = adminsData || [];
    archivos = archivosData || [];
  }

  const reposPublicosIds = (reposPublicos || []).map(r => r.id).filter(Boolean);
  if (reposPublicosIds.length) {
    const { data: ratingsData, error: ratingsError } = await supabase
      .from("ratings")
      .select("repo_id, rating")
      .in("repo_id", reposPublicosIds)
      .limit(5000);
    if (ratingsError) throw ratingsError;
    ratings = ratingsData || [];
  }

  const adminPorGrupo = new Map((admins || []).map(a => [a.grupo_id, a.display_name]));
  const countArchivosPorGrupo = new Map();
  for (const a of archivos || []) {
    countArchivosPorGrupo.set(a.grupo_id, (countArchivosPorGrupo.get(a.grupo_id) || 0) + 1);
  }

  const resultadosGrupos = (grupos || [])
    .map(g => ({
      tipo: "grupo",
      id: g.id,
      nombre: g.nombre,
      codigo: g.codigo,
      adminNombre: adminPorGrupo.get(g.id) || "Admin",
      archivosCount: countArchivosPorGrupo.get(g.id) || 0,
      createdAt: g.created_at || null
    }))
    .filter(g => {
      const nombreNorm = normalizarTexto(g.nombre);
      const codigoNorm = normalizarTexto(g.codigo);
      const adminNorm = normalizarTexto(g.adminNombre);
      const textoNormalizado = `${nombreNorm} ${adminNorm} ${codigoNorm}`.trim();
      const textoSinEspacios = textoNormalizado.replace(/\s/g, "");
      const termSinEspacios = termNorm.replace(/\s/g, "");

      if (!termTokens.length) return true;
      return (
        termTokens.every(token => textoNormalizado.includes(token)) ||
        (termSinEspacios && textoSinEspacios.includes(termSinEspacios))
      );
    });

  const resultadosReposPublicos = (reposPublicos || [])
    .map(r => ({
      ...obtenerPromedioRating({ ratings, repositorioId: r.id }),
      tipo: "repo_publico",
      id: r.id,
      titulo: r.titulo,
      creadorId: r.creador_id,
      creadorNombre: r.creador_nombre || "Usuario",
      createdAt: r.created_at || null
    }))
    .filter(r => {
      const tituloNorm = normalizarTexto(r.titulo);
      const creadorNorm = normalizarTexto(r.creadorNombre);
      const textoNormalizado = `${tituloNorm} ${creadorNorm}`.trim();
      const textoSinEspacios = textoNormalizado.replace(/\s/g, "");
      const termSinEspacios = termNorm.replace(/\s/g, "");
      if (minRating && (Number(r.ratingPromedio) || 0) < minRating) return false;
      if (!termTokens.length) return true;
      return (
        termTokens.every(token => textoNormalizado.includes(token)) ||
        (termSinEspacios && textoSinEspacios.includes(termSinEspacios))
      );
    });

  return [...resultadosGrupos, ...resultadosReposPublicos]
    .sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (db !== da) return db - da;
      const na = a.nombre || a.titulo || "";
      const nb = b.nombre || b.titulo || "";
      return na.localeCompare(nb);
    });
}

function obtenerPromedioRating({ ratings, repositorioId }) {
  const lista = (ratings || []).filter(r => r.repo_id === repositorioId);
  if (!lista.length) {
    return { ratingPromedio: 0, ratingTotal: 0 };
  }
  const suma = lista.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  const total = lista.length;
  return { ratingPromedio: suma / total, ratingTotal: total };
}

export async function crearRepositorioPublico({ titulo, creadorNombre = "" }) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  const nombre = `${creadorNombre || user.user_metadata?.display_name || "Usuario"}`.trim();
  const tituloLimpio = `${titulo || ""}`.trim();
  if (!tituloLimpio) throw new Error("El titulo es obligatorio.");

  const { data, error } = await supabase
    .from("repositorios_publicos")
    .insert({
      titulo: tituloLimpio,
      creador_id: user.id,
      creador_nombre: nombre
    })
    .select("id, titulo, creador_id, creador_nombre, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerRepositorioPublicoPorId(id) {
  const repoId = `${id || ""}`.trim();
  if (!repoId) return null;
  const { data, error } = await supabase
    .from("repositorios_publicos")
    .select("id, titulo, creador_id, creador_nombre, created_at")
    .eq("id", repoId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function obtenerMiCalificacionRepositorioPublico({ repositorioId }) {
  const repoId = `${repositorioId || ""}`.trim();
  if (!repoId) return null;

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("ratings")
    .select("rating")
    .eq("repo_id", repoId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.rating ?? null;
}

export async function obtenerPromedioRepositorioPublico({ repositorioId }) {
  const repoId = `${repositorioId || ""}`.trim();
  if (!repoId) return { ratingPromedio: 0, ratingTotal: 0 };

  const { data, error } = await supabase
    .from("ratings")
    .select("rating", { count: "exact" })
    .eq("repo_id", repoId);
  if (error) throw error;

  const lista = data || [];
  if (!lista.length) return { ratingPromedio: 0, ratingTotal: 0 };
  const suma = lista.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  return { ratingPromedio: suma / lista.length, ratingTotal: lista.length };
}

export async function guardarCalificacionRepositorioPublico({ repositorioId, rating }) {
  const repoId = `${repositorioId || ""}`.trim();
  const valor = Number(rating);
  if (!repoId) throw new Error("Repositorio invalido.");
  if (!Number.isFinite(valor) || valor < 1 || valor > 5) {
    throw new Error("La calificacion debe estar entre 1 y 5.");
  }

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  const { error } = await supabase
    .from("ratings")
    .upsert(
      { repo_id: repoId, user_id: user.id, rating: valor },
      { onConflict: "repo_id,user_id" }
    );
  if (error) throw error;
}

async function asegurarPropietarioRepositorioPublico({ repositorioId, userId }) {
  const { data: repo, error: repoError } = await supabase
    .from("repositorios_publicos")
    .select("id, creador_id")
    .eq("id", repositorioId)
    .maybeSingle();
  if (repoError) throw repoError;
  if (!repo) throw new Error("Repositorio público no encontrado.");
  if (!userId || repo.creador_id !== userId) {
    throw new Error("Solo el creador puede modificar este repositorio.");
  }
  return repo;
}

async function esColaboradorRepositorioPublico({ repositorioId, userId }) {
  if (!repositorioId || !userId) return false;
  const { data, error } = await supabase
    .from("repositorio_publico_colaboradores")
    .select("id")
    .eq("repositorio_id", repositorioId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function asegurarEditorRepositorioPublico({ repositorioId, userId }) {
  const repo = await asegurarPropietarioRepositorioPublico({ repositorioId, userId }).catch(
    () => null
  );
  if (repo) return repo;
  const ok = await esColaboradorRepositorioPublico({ repositorioId, userId });
  if (!ok) {
    throw new Error("Solo el creador o colaboradores pueden modificar este repositorio.");
  }
  return { id: repositorioId, creador_id: null };
}

export async function listarArchivosRepositorioPublico({ repositorioId }) {
  const repoId = `${repositorioId || ""}`.trim();
  if (!repoId) return [];
  const { data, error } = await supabase
    .from("repositorio_publico_archivos")
    .select("id, repositorio_id, path, nombre, mime_type, size_bytes, created_at, uploader_id")
    .eq("repositorio_id", repoId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function subirArchivoRepositorioPublico({ repositorioId, archivo }) {
  if (!archivo) throw new Error("Selecciona un archivo.");

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  await asegurarEditorRepositorioPublico({ repositorioId, userId: user.id });

  const safeName = `${archivo.name || "archivo"}`
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_");
  const path = `repos-publicos/${repositorioId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("Flux_repositorioGrupos")
    .upload(path, archivo);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("repositorio_publico_archivos")
    .insert({
      repositorio_id: repositorioId,
      path,
      nombre: archivo.name || safeName,
      mime_type: archivo.type || null,
      size_bytes: archivo.size || null,
      uploader_id: user.id
    })
    .select("id, repositorio_id, path, nombre, mime_type, size_bytes, created_at, uploader_id")
    .single();
  if (error) throw error;

  return data;
}

export async function eliminarArchivoRepositorioPublico({ repositorioId, archivoId, path }) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  await asegurarEditorRepositorioPublico({ repositorioId, userId: user.id });

  if (path) {
    const { error: removeError } = await supabase.storage
      .from("Flux_repositorioGrupos")
      .remove([path]);
    if (removeError && !`${removeError.message}`.toLowerCase().includes("not found")) {
      throw removeError;
    }
  }

  const { error } = await supabase
    .from("repositorio_publico_archivos")
    .delete()
    .eq("id", archivoId)
    .eq("repositorio_id", repositorioId);
  if (error) throw error;
}

export async function eliminarRepositorioPublico({ repositorioId }) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  await asegurarPropietarioRepositorioPublico({ repositorioId, userId: user.id });

  const { data: archivos, error: archivosError } = await supabase
    .from("repositorio_publico_archivos")
    .select("path")
    .eq("repositorio_id", repositorioId);
  if (archivosError) throw archivosError;

  const paths = (archivos || []).map(a => a.path).filter(Boolean);
  if (paths.length) {
    const { error: removeError } = await supabase.storage
      .from("Flux_repositorioGrupos")
      .remove(paths);
    if (removeError) {
      throw removeError;
    }
  }

  const { error } = await supabase
    .from("repositorios_publicos")
    .delete()
    .eq("id", repositorioId);
  if (error) throw error;
}

export async function listarColaboradoresRepositorioPublico({ repositorioId }) {
  const repoId = `${repositorioId || ""}`.trim();
  if (!repoId) return [];
  const { data, error } = await supabase
    .from("repositorio_publico_colaboradores")
    .select("id, repositorio_id, user_id, email, created_at, created_by")
    .eq("repositorio_id", repoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function agregarColaboradorPorEmail({ repositorioId, email }) {
  const repoId = `${repositorioId || ""}`.trim();
  const emailLimpio = `${email || ""}`.trim().toLowerCase();
  if (!repoId) throw new Error("Repositorio inválido.");
  if (!emailLimpio) throw new Error("El correo es obligatorio.");

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  await asegurarPropietarioRepositorioPublico({ repositorioId: repoId, userId: user.id });

  const { data: perfil, error: perfilError } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", emailLimpio)
    .maybeSingle();
  if (perfilError) throw perfilError;
  if (!perfil?.id) {
    throw new Error("No existe un usuario con ese correo.");
  }
  if (perfil.id === user.id) {
    throw new Error("Ya eres el creador del repositorio.");
  }

  const { data, error } = await supabase
    .from("repositorio_publico_colaboradores")
    .upsert(
      {
        repositorio_id: repoId,
        user_id: perfil.id,
        email: emailLimpio,
        created_by: user.id
      },
      { onConflict: "repositorio_id,user_id" }
    )
    .select("id, repositorio_id, user_id, email, created_at, created_by")
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarColaboradorRepositorioPublico({ repositorioId, userId }) {
  const repoId = `${repositorioId || ""}`.trim();
  const uid = `${userId || ""}`.trim();
  if (!repoId || !uid) throw new Error("Datos inválidos.");

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  // Solo creador puede expulsar colaboradores
  await asegurarPropietarioRepositorioPublico({ repositorioId: repoId, userId: user.id });

  const { error } = await supabase
    .from("repositorio_publico_colaboradores")
    .delete()
    .eq("repositorio_id", repoId)
    .eq("user_id", uid);
  if (error) throw error;
}

export async function salirRepositorioPublico({ repositorioId }) {
  const repoId = `${repositorioId || ""}`.trim();
  if (!repoId) throw new Error("Repositorio inválido.");

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) throw new Error("No hay sesion activa.");

  const { error } = await supabase
    .from("repositorio_publico_colaboradores")
    .delete()
    .eq("repositorio_id", repoId)
    .eq("user_id", user.id);
  if (error) throw error;
}

// -----------------------------
// Favoritos de repositorios
// -----------------------------
export async function listarRepositoriosFavoritos() {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = session?.user?.id;
  if (!userId) return [];

  const { data: favs, error: favsError } = await supabase
    .from("repositorio_favoritos")
    .select("repositorio_id")
    .eq("user_id", userId);
  if (favsError) throw favsError;
  const ids = (favs || []).map(f => f.repositorio_id).filter(Boolean);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("repositorios_publicos")
    .select("id, titulo, creador_id, creador_nombre, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function isRepositorioFavorito(repoId) {
  if (!repoId) return false;
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = session?.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from("repositorio_favoritos")
    .select("id")
    .eq("repositorio_id", repoId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function toggleFavoritoRepositorio(repoId) {
  if (!repoId) throw new Error("Repositorio inválido.");
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = session?.user?.id;
  if (!userId) throw new Error("Inicia sesión para marcar favoritos.");

  const { data: existing, error: existingError } = await supabase
    .from("repositorio_favoritos")
    .select("id")
    .eq("repositorio_id", repoId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase.from("repositorio_favoritos").delete().eq("id", existing.id);
    if (error) throw error;
    return { favorito: false };
  } else {
    const { data, error } = await supabase
      .from("repositorio_favoritos")
      .insert({ repositorio_id: repoId, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return { favorito: true, row: data };
  }
}

export async function listarRepositoriosCreados() {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = session?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("repositorios_publicos")
    .select("id, titulo, creador_id, creador_nombre, created_at")
    .eq("creador_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listarArchivosGrupoPorId({ grupoId }) {
  const { data: grupo, error: errorGrupo } = await supabase
    .from("grupos")
    .select("id, creador_id, es_publico")
    .eq("id", grupoId)
    .maybeSingle();
  if (errorGrupo) throw errorGrupo;
  if (!grupo) return [];

  const user = await obtenerUsuarioActual();
  const permitido = await usuarioPuedeLeerGrupo({
    grupoId: grupo.id,
    creadorId: grupo.creador_id,
    esPublico: Boolean(grupo.es_publico),
    userId: user?.id || null
  });
  if (!permitido) {
    throw new Error("No tienes permisos para ver este repositorio.");
  }

  const { data, error } = await supabase
    .from("grupo_archivos")
    .select("id, path, nombre, created_at")
    .eq("grupo_id", grupoId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
