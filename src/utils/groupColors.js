export const PALETA_BANNERS = [
  { a: "#0F80C1", b: "#1F93D8", badge: "#0A5F93" },
  { a: "#7B3FE4", b: "#9E62FF", badge: "#5A28B7" },
  { a: "#0E8F6A", b: "#1CB98C", badge: "#0B664B" },
  { a: "#C05A1A", b: "#E17A2F", badge: "#8C3E10" },
  { a: "#C2276B", b: "#E34D8E", badge: "#8A1B4A" },
  { a: "#3159C8", b: "#4C77E8", badge: "#223F90" },
  { a: "#2E7D32", b: "#46A34B", badge: "#1F5722" },
  { a: "#8B5E00", b: "#B37A00", badge: "#654300" }
];

function hashTexto(valor = "") {
  let hash = 0;
  for (let i = 0; i < valor.length; i++) {
    hash = (hash << 5) - hash + valor.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function obtenerColorGrupo(identificador = "") {
  return PALETA_BANNERS[hashTexto(identificador) % PALETA_BANNERS.length];
}
