// src/screens/AuthScreen.jsx
export default function AuthScreen({ titleColor, onGoogleLogin, onGuestLogin }) {
  return (
    <div style={{ textAlign: "center", marginTop: 80 }}>
      <h2 style={{ color: titleColor }}>🔐 Bienvenido a Vocab Trainer</h2>
      <p style={{ color: "#64748b" }}>Accede para empezar a practicar</p>

      <button
        style={{
          marginTop: 30,
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #cbd5e1",
          background: "#2563eb",
          color: "white",
          cursor: "pointer",
          fontSize: 16,
          width: "260px",
          display: "block",
          marginLeft: "auto",
          marginRight: "auto",
        }}
        onClick={onGoogleLogin}
      >
        🔐 Entrar con Google
      </button>

      <button
        style={{
          marginTop: 15,
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #cbd5e1",
          background: "#0f0f0fff",
          color: "#dfe1e6ff",
          cursor: "pointer",
          fontSize: 16,
          width: "260px",
          display: "block",
          marginLeft: "auto",
          marginRight: "auto",
        }}
        onClick={onGuestLogin}
      >
        🚪 Entrar sin registrarse
      </button>
    </div>
  );
}
