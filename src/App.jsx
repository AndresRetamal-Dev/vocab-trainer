// src/App.jsx
import { useState, useEffect } from "react";
import {
  signInWithRedirect,
  signOut,
  onAuthStateChanged,  
  getRedirectResult,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import UserScreen from "./screens/UserScreen";
import TrainerScreen from "./screens/TrainerScreen";

import useTrainer from "./hooks/useTrainer";

export default function App() {
  // --- 🔹 Estado global de la app ---
  const [user, setUser] = useState(null); // null = no logueado
  const [screen, setScreen] = useState("auth"); // "auth" | "home" | "user" | "trainer"

  // --- 🔹 Dark mode ---
  const [darkMode, setDarkMode] = useState(false);

  // --- 🔹 Hook del trainer (toda la lógica de estudio está aquí) ---
  const trainer = useTrainer(user);
  const { streak, answeredCount, levelStats, loadUserData, setMode } = trainer;


  // Redirigir automáticamente al trainer cuando haya usuario logueado (no invitado)
useEffect(() => {
  if (user && !user.isGuest && (screen === "auth" || screen === "home")) {
    setMode("write");
    setScreen("trainer");
  }
}, [user, screen, setMode]);


// === Escuchar cambios de autenticación + leer resultado del redirect ===
useEffect(() => {
  let unsub;

  const initAuth = async () => {
    try {
      // 1️⃣ Primero: comprobar si venimos de un signInWithRedirect
      const redirectResult = await getRedirectResult(auth);

      if (redirectResult?.user) {
        const firebaseUser = redirectResult.user;

        const userObj = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || "Usuario",
          email: firebaseUser.email || "",
          photoURL: firebaseUser.photoURL || null,
          isGuest: false,
        };

        setUser(userObj);
        setMode("write");     // empezar en modo escribir
        setScreen("trainer"); // ir directo al entrenador

        if (loadUserData) {
          await loadUserData(firebaseUser.uid);
        }
      }
    } catch (err) {
      console.error("Error en getRedirectResult:", err);
    }

    // 2️⃣ Después: registrar el listener normal de cambios de auth
    unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userObj = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || "Usuario",
            email: firebaseUser.email || "",
            photoURL: firebaseUser.photoURL || null,
            isGuest: false,
          };

          setUser(userObj);
          setMode("write");
          setScreen("trainer");

          if (loadUserData) {
            await loadUserData(firebaseUser.uid);
          }
        } else {
          setUser(null);
          setScreen("auth");
        }
      } catch (err) {
        console.error("Error en onAuthStateChanged:", err);
      }
    });
  };

  initAuth();

  return () => {
    if (unsub) unsub();
  };
}, [loadUserData, setMode]);



  // === HANDLER LOGIN GOOGLE (solo redirect) ===
  const handleGoogleLogin = async () => {
    try {
      // Modo recomendado para móvil: redirect
      await signInWithRedirect(auth, googleProvider);
      // Cuando vuelva de Google y Firebase complete el login,
      // onAuthStateChanged se encargará de actualizar user + screen.
    } catch (err) {
      console.error("Error al hacer login con Google (redirect):", err);
      alert(
        `No se pudo iniciar sesión con Google.\n\n` +
          `code: ${err.code || "sin código"}\n` +
          `msg: ${err.message || "sin mensaje"}`
      );
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
    // onAuthStateChanged pondrá user=null y screen="auth"
  };

  const handleGuestLogin = () => {
    setUser({
      uid: null,
      name: "Invitado",
      email: "",
      photoURL: null,
      isGuest: true,
    });
    setScreen("home");
  };

  const startWriteMode = () => {
    trainer.setMode("write");
    setScreen("trainer");
  };

  const startFlashMode = () => {
    trainer.setMode("flashcard");
    setScreen("trainer");
  };

  // === Tema claro / oscuro ===
  const pageBg = darkMode ? "#1c1e25f5" : "#f1f5f9";
  const cardBg = "#ffffff";
  const titleColor = darkMode ? "#e5e7eb" : "#000000";
  const inputBg = darkMode ? "#020617" : "#2f3133";
  const inputText = darkMode ? "#e5e7eb" : "#ffffff";

  // === Estilos compartidos ===
  const styles = {
    page: {
      minHeight: "100vh",
      width: "100%",
      background: pageBg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "16px 0 24px",
      boxSizing: "border-box",
      overflowX: "hidden",
    },

    header: { textAlign: "center" },
    select: { padding: "6px 8px", borderRadius: "8px" },

    container: {
      position: "relative",
      background: cardBg,
      borderRadius: "16px",
      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.08)",
      width: "100%",
      maxWidth: "520px",
      padding: "24px 20px",
      textAlign: "center",
      boxSizing: "border-box",
      margin: "0 auto",
    },

    streakBox: {
      position: "absolute",
      right: "10px",
      top: "10px",
      background: "#ffffff",
      padding: "8px 12px",
      borderRadius: "12px",
      boxShadow: "0 6px 15px rgba(0, 0, 0, 0.15)",
      textAlign: "center",
      width: "70px",
      border: "1px solid #e2e8f0",
      zIndex: 10,
    },

    progressBarOuter: {
      width: "100%",
      height: 6,
      background: "#e2e8f0",
      borderRadius: 4,
      margin: "8px 0 4px",
    },

    progressBarInner: {
      height: "100%",
      background: "#2bcf47ff",
      borderRadius: 4,
      transition: "width 0.25s ease-out",
    },

    headerTop: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "16px",
      marginBottom: "10px",
      flexWrap: "wrap",
    },

    streakBoxTop: {
      background: "#ffffff",
      padding: "12px 18px",
      borderRadius: "14px",
      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.15)",
      textAlign: "center",
      border: "1px solid #e2e8f0",
      minWidth: "80px",
      margin: "0 auto",
      marginBottom: "10px",
    },

    userBadge: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginBottom: 10,
    },

    avatar: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      objectFit: "cover",
      border: "2px solid #2563eb",
    },

    avatarFallback: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#e2e8f0",
      border: "2px solid #2563eb",
      fontSize: 20,
    },

    userInfo: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
    },

    userName: {
      fontSize: 14,
      fontWeight: 600,
      color: "#0f172a",
    },

    userTag: {
      fontSize: 11,
      color: "#64748b",
    },

    streakNumberTop: {
      fontSize: "30px",
      fontWeight: "800",
      color: "#2563eb",
      marginTop: "4px",
    },

    streakNumber: {
      fontSize: "26px",
      fontWeight: "700",
      color: "#2563eb",
      marginTop: "4px",
    },

    wordBig: {
      fontWeight: 800,
      fontSize: "30px",
      margin: "6px 0 12px",
      color: "#0f172a",
      transition: "color 0.2s ease",
    },

    input: {
      width: "100%",
      maxWidth: "460px",
      padding: "12px",
      borderRadius: "10px",
      border: "1px solid #cbd5e1",
      textAlign: "center",
      margin: "0 auto 12px",
      display: "block",
      fontSize: "16px",
      background: inputBg,
      color: inputText,
      boxSizing: "border-box",
    },

    btnPrimary: {
      background: "#8831cfd7",
      color: "white",
      padding: "10px 18px",
      borderRadius: "12px",
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      transition: "transform 0.15s ease, background 0.2s ease",
    },

    btnPrimaryHover: {
      background: "#be54c2ff",
      transform: "scale(1.03)",
    },

    btnSecondary: {
      background: "white",
      color: "#334155",
      padding: "10px 16px",
      borderRadius: "10px",
      border: "1px solid #cbd5e1",
      cursor: "pointer",
    },

    small: { fontSize: "12px", color: "#64748b", marginTop: "8px" },
    feedbackOk: { color: "#16a34a", fontWeight: 600, marginTop: "10px" },
    feedbackBad: { color: "#dc2626", fontWeight: 600, marginTop: "10px" },
    def: { color: "#475569", fontSize: "14px", marginTop: "6px" },

    bubble: {
      position: "relative",
      display: "inline-block",
      margin: "0 auto 12px",
      background: "#fff",
      color: "#0f172a",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      padding: "10px 12px",
      maxWidth: "420px",
      boxShadow: "0 8px 20px rgba(0, 0, 0, 0.08)",
      fontSize: "14px",
      lineHeight: 1.35,
    },
    bubbleTip: {
      position: "absolute",
      top: "-6px",
      left: "50%",
      transform: "translateX(-50%) rotate(45deg)",
      width: "12px",
      height: "12px",
      background: "#fff",
      borderLeft: "1px solid #e2e8f0",
      borderTop: "1px solid #e2e8f0",
    },
    bubbleMotivation: {
      background: "#fffbea",
      border: "1px solid #fde68a",
      color: "#78350f",
    },
    bubbleMotivationTip: {
      background: "#fffbea",
      borderLeft: "1px solid #fde68a",
      borderTop: "1px solid #fde68a",
    },

    modeRow: {
      marginTop: 12,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },

    modeToggle: {
      display: "inline-flex",
      background: "#e2e8f0",
      borderRadius: 999,
      padding: 2,
    },

    modeBtn: {
      border: "none",
      padding: "6px 12px",
      borderRadius: 999,
      background: "transparent",
      cursor: "pointer",
      fontSize: 12,
      color: "#475569",
    },

    modeBtnActive: {
      border: "none",
      padding: "6px 12px",
      borderRadius: 999,
      background: "#2563eb",
      cursor: "pointer",
      fontSize: 12,
      color: "white",
    },

    darkToggle: {
      borderRadius: 999,
      border: "1px solid #cbd5e1",
      padding: "6px 10px",
      fontSize: 12,
      cursor: "pointer",
      background: darkMode ? "#020617" : "#ffffff",
      color: darkMode ? "#e5e7eb" : "#0f172a",
    },
  };

  // === UI ===
  return (
    <div style={styles.page}>
      {/* 🔹 PANTALLA LOGIN */}
      {screen === "auth" && (
        <AuthScreen
          titleColor={titleColor}
          onGoogleLogin={handleGoogleLogin}
          onGuestLogin={handleGuestLogin}
        />
      )}

      {/* 🔹 PANTALLA HOME (selección de modo) */}
      {screen === "home" && (
        <HomeScreen
          titleColor={titleColor}
          user={user}
          onPracticeWrite={startWriteMode}
          onPracticeFlash={startFlashMode}
          onOpenUser={() => setScreen("user")}
          onLogout={handleLogout}
        />
      )}

      {/* 🔹 PANTALLA USER / PERFIL */}
      {screen === "user" && (
        <UserScreen
          titleColor={titleColor}
          user={user}
          answeredCount={answeredCount}
          streak={streak}
          levelStats={levelStats}
          styles={styles}
          onBackHome={() => setScreen("home")}
          onLogout={handleLogout}
        />
      )}

      {/* 🔹 PANTALLA TRAINER */}
      {screen === "trainer" && (
        <TrainerScreen
          user={user}
          titleColor={titleColor}
          styles={styles}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          {...trainer} // 👈 todo el estado y handlers del hook
        />
      )}
    </div>
  );
}
