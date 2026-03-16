export const PALABRAS_PROHIBIDAS = [
  "boludo",
  "cabron",
  "cabrón",
  "carajo",
  "cojudo",
  "concha",
  "coño",
  "culero",
  "culo",
  "estupido",
  "estúpido",
  "gilipollas",
  "hijueputa",
  "hijo de puta",
  "idiota",
  "imbecil",
  "imbécil",
  "malparido",
  "mamaguevo",
  "marica",
  "mierda",
  "pendejo",
  "pene",
  "puta",
  "puto",
  "tarado",
  "verga",
  "zorra"
];

function normalizarTexto(valor = "") {
  return `${valor}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escaparRegex(texto = "") {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contienePalabraProhibida(textoNormalizado, palabraNormalizada) {
  if (!textoNormalizado || !palabraNormalizada) return false;
  const regex = new RegExp(`(^|\\s)${escaparRegex(palabraNormalizada)}(?=\\s|$)`, "i");
  return regex.test(textoNormalizado);
}

export function obtenerCoincidenciaPalabraProhibida(valor = "") {
  const textoNormalizado = normalizarTexto(valor);
  if (!textoNormalizado) return null;

  for (const palabra of PALABRAS_PROHIBIDAS) {
    const palabraNormalizada = normalizarTexto(palabra);
    if (contienePalabraProhibida(textoNormalizado, palabraNormalizada)) {
      return palabra;
    }
  }

  return null;
}

export function validarNombreSinMalasPalabras(valor = "", etiqueta = "El nombre") {
  const texto = `${valor}`.trim();
  if (!texto) {
    throw new Error(`${etiqueta} es obligatorio.`);
  }

  const coincidencia = obtenerCoincidenciaPalabraProhibida(texto);
  if (coincidencia) {
    throw new Error(`${etiqueta} contiene una palabra no permitida.`);
  }

  return texto;
}
