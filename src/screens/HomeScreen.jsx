// src/screens/HomeScreen.jsx
export default function HomeScreen({
  titleColor,
  user,
  onPracticeWrite,
  onPracticeFlash,
  onOpenUser,
  onLogout,
}) {
  return (
    <div style={{ textAlign: "center", marginTop: 60 }}>
      <h2 style={{ color: titleColor }}>👋 Hola, {user?.name}</h2>
      <p style={{ color: "#64748b" }}>¿Qué quieres practicar hoy?</p>

      <div
        style={{
          marginTop: 30,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <button
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
            fontSize: 16,
          }}
          onClick={onPracticeWrite}
        >
          ✍️ Practicar Escribiendo
        </button>

        <button
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            background: "#0f0e0eff",
            cursor: "pointer",
            fontSize: 16,
            color: "white",
          }}
          onClick={onPracticeFlash}
        >
          🃏 Practicar con Flashcards
        </button>

        <button
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            cursor: "pointer",
            fontSize: 14,
          }}
          onClick={onOpenUser}
        >
          👤 Ver tu perfil y progreso
        </button>
      </div>

      <button
        style={{
          marginTop: 40,
          fontSize: 14,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#64748b",
          textDecoration: "underline",
        }}
        onClick={onLogout}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
