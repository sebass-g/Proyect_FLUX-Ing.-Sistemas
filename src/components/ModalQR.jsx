import QRCode from "react-qr-code";

export default function ModalQR({ isOpen, onClose, url, titulo }) {
  if (!isOpen) return null;

  return (
    <div style={estilos.overlay} onClick={onClose}>
      <div style={estilos.modal} onClick={(e) => e.stopPropagation()}>
        <button style={estilos.cerrar} onClick={onClose}>&times;</button>
        <h3 style={{ margin: "0 0 15px 0", color: "#333" }}>{titulo}</h3>
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>Escanea para unirte</p>
        <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #eee", display:"inline-block" }}>
          <QRCode value={url} size={200} level={"H"} />
        </div>
        <p style={{ marginTop: "20px", fontSize: "12px", color: "#999", wordBreak: "break-all" }}>{url}</p>
      </div>
    </div>
  );
}

const estilos = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(3px)" },
  modal: { backgroundColor: "white", padding: "30px", borderRadius: "16px", position: "relative", width: "90%", maxWidth: "350px", textAlign: "center", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" },
  cerrar: { position: "absolute", top: "10px", right: "15px", background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#666" }
};