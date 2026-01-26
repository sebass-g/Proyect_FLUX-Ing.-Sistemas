import { useState } from "react";
import "./App.css"; 
import PaginaGrupos from "./paginas/PaginaGrupos";
import PaginaDetalleGrupo from "./paginas/PaginaDetalleGrupo";

export default function App() {
  const [codigoGrupoAbierto, setCodigoGrupoAbierto] = useState(null);

  return codigoGrupoAbierto ? (
    <PaginaDetalleGrupo
      codigoGrupo={codigoGrupoAbierto}
      volver={() => setCodigoGrupoAbierto(null)}
    />
  ) : (
    <PaginaGrupos abrirGrupo={(codigo) => setCodigoGrupoAbierto(codigo)} />
  );
}
