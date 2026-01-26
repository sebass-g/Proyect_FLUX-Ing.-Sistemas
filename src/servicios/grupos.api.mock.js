const CLAVE_STORAGE = "flux_grupos_mock";

function cargarGrupos() {
  return JSON.parse(localStorage.getItem(CLAVE_STORAGE) || "[]");
}

function guardarGrupos(grupos) {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(grupos));
}

function generarCodigo(longitud = 6) {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let resultado = "";
  for (let i = 0; i < longitud; i++) {
    resultado += caracteres[Math.floor(Math.random() * caracteres.length)];
  }
  return resultado;
}

export async function crearGrupo({ nombreGrupo, nombreUsuario }) {
  const grupos = cargarGrupos();

  let codigo = generarCodigo();
  while (grupos.some(g => g.codigo === codigo)) {
    codigo = generarCodigo();
  }

  const grupo = {
    id: crypto.randomUUID(),
    nombre: nombreGrupo.trim(),
    codigo,
    miembros: [{ id: crypto.randomUUID(), nombre: nombreUsuario }],
    actividad: [
      {
        mensaje: `${nombreUsuario} creó el grupo.`,
        fecha: new Date().toISOString()
      }
    ]
  };

  grupos.push(grupo);
  guardarGrupos(grupos);

  return grupo;
}

export async function obtenerVistaPreviaPorCodigo(codigo) {
  const grupos = cargarGrupos();
  return grupos.find(
    g => g.codigo === codigo.trim().toUpperCase()
  ) || null;
}

export async function unirseAGrupoPorCodigo({ codigo, nombreUsuario }) {
  const grupos = cargarGrupos();
  const indice = grupos.findIndex(
    g => g.codigo === codigo.trim().toUpperCase()
  );

  if (indice === -1) {
    throw new Error("El código ingresado no existe.");
  }

  const grupo = grupos[indice];

  const existe = grupo.miembros.some(
    m => m.nombre.toLowerCase() === nombreUsuario.toLowerCase()
  );

  if (!existe) {
    grupo.miembros.push({
      id: crypto.randomUUID(),
      nombre: nombreUsuario
    });

    grupo.actividad.unshift({
      mensaje: `${nombreUsuario} se unió al grupo.`,
      fecha: new Date().toISOString()
    });

    grupos[indice] = grupo;
    guardarGrupos(grupos);
  }

  return grupo;
}
