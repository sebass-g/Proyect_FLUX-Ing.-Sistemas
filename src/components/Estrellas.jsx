import { useState } from 'react';

export default function Estrellas({ alCalificar }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  // Esta función decide si la estrella se ve llena, a la mitad o vacía
  const obtenerEstilo = (index) => {
    const valorActual = hover || rating;

    // Estilo base para todas las estrellas
    const baseStyle = {
      fontSize: "40px",
      cursor: "pointer",
      transition: "transform 0.1s",
      userSelect: "none", // Evita que se seleccione el texto al hacer click rápido
      display: "inline-block" // Necesario para que funcione el degradado
    };

    // Caso 1: Estrella completa (ej: valor 3, estrella 1, 2 y 3)
    if (valorActual >= index) {
      return { ...baseStyle, color: "#FFD700" }; // Color dorado sólido
    }
    
    // Caso 2: Media estrella (ej: valor 2.5, estrella 3)
    if (valorActual >= index - 0.5) {
      return {
        ...baseStyle,
        background: "linear-gradient(90deg, #FFD700 50%, #D3D3D3 50%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent"
        // Esto crea el efecto visual de mitad oro, mitad gris
      };
    }

    // Caso 3: Estrella vacía
    return { ...baseStyle, color: "#D3D3D3" }; // Gris
  };

  // Detecta si el mouse está a la izquierda o derecha de la estrella
  const manejarMovimiento = (e, index) => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left; // Posición del mouse dentro de la estrella
    
    // Si el mouse está en la primera mitad, restamos 0.5 al índice
    const nuevoValor = x < width / 2 ? index - 0.5 : index;
    setHover(nuevoValor);
  };

  const confirmarVoto = (e, index) => {
     // Calculamos el valor final igual que en el movimiento
     const { left, width } = e.currentTarget.getBoundingClientRect();
     const x = e.clientX - left;
     const valorFinal = x < width / 2 ? index - 0.5 : index;
     
     setRating(valorFinal);
     if (alCalificar) alCalificar(valorFinal);
  };

  return (
    <div className="card" style={{ padding: "20px", marginTop: "20px", textAlign: "left", background: "#fff", borderRadius: "8px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
      <strong style={{ fontSize: "1.1rem", color: "#333" }}>Tu calificación</strong>
      
      <div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
        {[1, 2, 3, 4, 5].map((index) => (
          <span
            key={index}
            style={obtenerEstilo(index)}
            onMouseMove={(e) => manejarMovimiento(e, index)}
            onClick={(e) => confirmarVoto(e, index)}
            onMouseLeave={() => setHover(0)}
          >
            ★
          </span>
        ))}
      </div>

      <button
        type="button"
        className="btn"
        style={{ marginTop: "8px" }}
        onClick={() => {
          setRating(0);
          setHover(0);
          if (alCalificar) alCalificar(0);
        }}
      >
        Calificar con 0
      </button>
      
      <p style={{ marginTop: "8px", fontSize: "14px", color: "#666" }}>
        {rating > 0 
          ? `Has seleccionado ${rating} estrellas` 
          : "Desliza y haz clic para puntuar"}
      </p>
    </div>
  );
}