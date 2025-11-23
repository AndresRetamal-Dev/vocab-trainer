// src/screens/UserScreen.jsx

export default function UserScreen({
  titleColor,
  user,
  answeredCount,
  streak,
  levelStats,
  styles,
  onBackHome,
  onLogout,
}) {
  return (
    <div style={{ textAlign: "center", marginTop: 40, padding: "0 16px" }}>
      <h2 style={{ color: titleColor, marginBottom: 4 }}>👤 Tu perfil</h2>
      <p style={{ color: "#64748b", marginBottom: 20 }}>
        Información básica de tu progreso.
      </p>

      {/* Datos de usuario */}
      <div
        style={{
          margin: "0 auto 24px",
          padding: "16px 20px",
          maxWidth: 420,
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 6px 16px rgba(15,23,42,0.12)",
          textAlign: "left",
          color: "#000000ff",
        }}
      >
        <div style={{ fontSize: 14, marginBottom: 6 }}>
          <strong>Nombre:</strong> {user?.name || "Invitado"}
        </div>
        {!user?.isGuest && (
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            <strong>Email:</strong> {user?.email}
          </div>
        )}
        <div style={{ fontSize: 14, marginBottom: 6 }}>
          <strong>Modo:</strong>{" "}
          {user?.isGuest
            ? "Invitado (no guarda en la nube)"
            : "Conectado con Google"}
        </div>
        <div style={{ fontSize: 14, marginBottom: 6 }}>
          <strong>Palabras completadas (global):</strong> {answeredCount}
        </div>
        <div style={{ fontSize: 14 }}>
          <strong>Racha actual:</strong> {streak}
        </div>
      </div>

      {/* Progreso por nivel */}
      <div
        style={{
          margin: "0 auto",
          maxWidth: 420,
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 6px 16px rgba(15,23,42,0.12)",
          padding: "16px 20px",
          textAlign: "left",
          color: "#000000ff",
        }}
      >
        <h3 style={{ fontSize: 15, marginBottom: 10, color: "#0f172a" }}>
          📚 Progreso por nivel (modo escribir)
        </h3>
        <div style={{ fontSize: 13, color: "#000000ff", marginBottom: 8 }}>
          El porcentaje se basa en cuántas palabras has dominado (Leitner box &gt; 0).
        </div>

        {levelStats.map((ls) => (
          <div
            key={ls.level}
            style={{
              padding: "6px 0",
              borderBottom: "1px solid #e2e8f0",
              fontSize: 13,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span>
                <strong>{ls.level}</strong> – {ls.mastered}/{ls.total} palabras
              </span>
              <span>{ls.pct}%</span>
            </div>
            <div style={styles.progressBarOuter}>
              <div
                style={{
                  ...styles.progressBarInner,
                  width: `${ls.pct}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Botones abajo */}
      <div
        style={{
          marginTop: 24,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button style={styles.btnSecondary} onClick={onBackHome}>
          ⬅️ Volver al inicio
        </button>

        <button
          style={{
            ...styles.btnSecondary,
            borderColor: "#dc2626",
            color: "#dc2626",
          }}
          onClick={onLogout}
        >
          🚪 Cerrar sesión
        </button>
      </div>
    </div>
  );
}
