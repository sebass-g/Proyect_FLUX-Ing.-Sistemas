export default function ConfirmModal({ isOpen, title, message, onCancel, onConfirm, confirmLabel = "Aceptar", cancelLabel = "Cancelar" }) {
  if (!isOpen) return null;

  return (
    <div style={estilos.overlay} onClick={onCancel}>
      <div style={estilos.modal} onClick={(e) => e.stopPropagation()}>
        <button style={estilos.cerrar} onClick={onCancel}>&times;</button>
        {title && <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>{title}</h3>}
        {message && <p style={{ color: "#555", marginBottom: 18 }}>{message}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="btn" onClick={onCancel} style={{ minWidth: 110 }}>{cancelLabel}</button>
          <button className="btn btnPrimary" onClick={onConfirm} style={{ minWidth: 110 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const estilos = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "transparent", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200 },
  modal: { backgroundColor: "white", padding: "22px", borderRadius: "12px", position: "relative", width: "92%", maxWidth: "420px", textAlign: "center", boxShadow: "0 8px 18px rgba(0,0,0,0.08)" },
  cerrar: { position: "absolute", top: "8px", right: "12px", background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#666" }
};
