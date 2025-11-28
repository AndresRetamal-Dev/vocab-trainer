// src/screens/AuthScreen.jsx
import { useState } from "react";

export default function AuthScreen({
  titleColor,
  // onGoogleLogin, // 🔴 ya no se usa
  onEmailLogin,
  onEmailRegister,
  onGuestLogin,
}) {
  const [mode, setMode] = useState("login"); // "login" | "register"

  // Campos login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Campos registro
  const [regEmail, setRegEmail] = useState("");
  const [regEmail2, setRegEmail2] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");

  const handleSubmitLogin = (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      alert("Rellena email y contraseña.");
      return;
    }
    onEmailLogin({ email: loginEmail, password: loginPassword });
  };

  const handleSubmitRegister = (e) => {
    e.preventDefault();
    if (!regEmail || !regEmail2 || !regPassword || !regFirstName || !regLastName) {
      alert("Rellena todos los campos.");
      return;
    }
    if (regEmail !== regEmail2) {
      alert("Los correos no coinciden.");
      return;
    }
    onEmailRegister({
      email: regEmail,
      password: regPassword,
      firstName: regFirstName,
      lastName: regLastName,
    });
  };

  const activeTabStyle = {
    flex: 1,
    padding: "10px 0",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    background: "#2563eb",
    color: "white",
  };

  const inactiveTabStyle = {
    flex: 1,
    padding: "10px 0",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    fontWeight: 500,
    background: "#e2e8f0",
    color: "#475569",
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    marginBottom: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const primaryBtn = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    background: "#8831cfd7",
    color: "white",
    fontWeight: 600,
    fontSize: "15px",
    marginTop: "4px",
  };

  const secondaryBtn = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    cursor: "pointer",
    background: "white",
    color: "#334155",
    fontWeight: 500,
    fontSize: "14px",
    marginTop: "8px",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 520,
        padding: "24px 20px",
        background: "#ffffff",
        borderRadius: 16,
        boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
        marginTop: 30,
      }}
    >
      <h1 style={{ color: titleColor, fontSize: 22, marginBottom: 10, textAlign: "center" }}>
        Vocab Trainer
      </h1>
      <p style={{ color: "#64748b", fontSize: 14, textAlign: "center", marginBottom: 18 }}>
        Inicia sesión o crea tu cuenta para guardar tu progreso.
      </p>

      {/* Tabs LOGIN / REGISTRO */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: 4,
          borderRadius: 999,
          background: "#e2e8f0",
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          style={mode === "login" ? activeTabStyle : inactiveTabStyle}
          onClick={() => setMode("login")}
        >
          Login
        </button>
        <button
          type="button"
          style={mode === "register" ? activeTabStyle : inactiveTabStyle}
          onClick={() => setMode("register")}
        >
          Registro
        </button>
      </div>

      {/* FORMULARIO LOGIN */}
      {mode === "login" && (
        <form onSubmit={handleSubmitLogin}>
          <input
            style={inputStyle}
            type="email"
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />
          <input
            style={inputStyle}
            type="password"
            placeholder="Contraseña"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
          />

          <button type="submit" style={primaryBtn}>
            Iniciar sesión
          </button>
        </form>
      )}

      {/* FORMULARIO REGISTRO */}
      {mode === "register" && (
        <form onSubmit={handleSubmitRegister}>
          <input
            style={inputStyle}
            type="email"
            placeholder="Correo (Gmail u otro)"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
          />
          <input
            style={inputStyle}
            type="email"
            placeholder="Repite el correo"
            value={regEmail2}
            onChange={(e) => setRegEmail2(e.target.value)}
          />
          <input
            style={inputStyle}
            type="password"
            placeholder="Contraseña"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
          />
          <input
            style={inputStyle}
            type="text"
            placeholder="Nombre"
            value={regFirstName}
            onChange={(e) => setRegFirstName(e.target.value)}
          />
          <input
            style={inputStyle}
            type="text"
            placeholder="Apellidos"
            value={regLastName}
            onChange={(e) => setRegLastName(e.target.value)}
          />

          <button type="submit" style={primaryBtn}>
            Crear cuenta
          </button>
        </form>
      )}

      {/* BOTÓN INVITADO */}
      <button type="button" style={secondaryBtn} onClick={onGuestLogin}>
        Entrar como invitado
      </button>

      {/* Si en el futuro quieres reactivar Google:
      <button
        type="button"
        style={{ ...secondaryBtn, marginTop: 8 }}
        onClick={onGoogleLogin}
      >
        Continuar con Google
      </button>
      */}
    </div>
  );
}
