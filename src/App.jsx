import { useEffect, useMemo, useState } from "react";
import dataJson from "./data/words.json";
import motivationsJson from "./data/motivations.json";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const ALL = "Todas";

// Normaliza: minúsculas, quita acentos, recorta espacios
const normalize = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

function matches(user, gold) {
  const u = normalize(user);
  const goldSet = new Set(
    (gold || "")
      .replace(/\|/g, ";")
      .split(";")
      .map((x) => normalize(x))
      .filter(Boolean)
  );
  return goldSet.has(u);
}

export default function App() {
  const [level, setLevel] = useState("A1");
  const [category, setCategory] = useState(ALL);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // "ok" | "first_wrong" | "second_wrong" | null
  const [attempt, setAttempt] = useState(0); // 0 = primer intento; 1 = segundo

  // contador global de fallos y frase motivadora seleccionada
  const [wrongCount, setWrongCount] = useState(0);
  const [motivation, setMotivation] = useState(null); // string | null
  const [streak, setStreak] = useState(0);

  // progreso
  const [answeredCount, setAnsweredCount] = useState(0);

  // palabras “difíciles”
  const [hardWords, setHardWords] = useState({});


  


  // Carga externa de frases motivacionales con fallback por si el JSON está vacío
  const MOTIVATION_MESSAGES = useMemo(() => {
    const arr = Array.isArray(motivationsJson) ? motivationsJson.filter(Boolean) : [];
    return arr.length
      ? arr
      : [
          "💪 ¡Ánimo! Vas en la dirección correcta.",
          "🌟 Puedes con esto. Una más y lo clavas.",
          "🚀 Los fallos te hacen mejorar. ¡Sigue!",
          "🧠 Repetir = recordar. ¡Buen trabajo!",
          "🔥 No te rindas: cada intento suma.",
          "🏆 Pasito a pasito se llega lejos.",
          "✨ Lo estás haciendo muy bien, ¡continúa!"
        ];
  }, []);

  // progreso simple por término: { [term]: { box: 0..4, seen: n, ts } }
  const [progress, setProgress] = useState(() => {
    try {
      const saved = localStorage.getItem("progress:v1");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Guarda progreso Leitner
  useEffect(() => {
    localStorage.setItem("progress:v1", JSON.stringify(progress));
  }, [progress]);

  // Cargar hardWords al iniciar la app
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hardWords:v1");
      if (saved) {
        setHardWords(JSON.parse(saved));
      }
    } catch {
      setHardWords({});
    }
  }, []);

  // Guarda hardWords cuando cambien  🔥 (ESTE ES EL NUEVO)
  useEffect(() => {
    localStorage.setItem("hardWords:v1", JSON.stringify(hardWords));
  }, [hardWords]);



  // categorías únicas a partir del JSON (fallback a "general")
  const CATEGORIES = useMemo(() => {
    const set = new Set();
    for (const w of dataJson) set.add((w.category || "general").trim());
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b, "es"))];
  }, []);

  // Filtra por nivel Y categoría y calcula pesos por Leitner inverso
  const items = useMemo(() => {
    const filtered = dataJson.filter((w) => {
      const okLevel = level ? w.level === level : true;
      const cat = (w.category || "general").trim();
      const okCat = category === ALL ? true : cat === category;
      return okLevel && okCat;
    });
    return filtered.map((w) => {
      const st = progress[w.term] || { box: 0 };
      const weight = Math.max(1, 5 - (st.box ?? 0)); // box 0 => 5, box 4 => 1
      return { ...w, __weight: weight };
    });
  }, [level, category, progress]);

  // Selección ponderada evitando repetir la actual
  const pickWeighted = (excludeTerm = null) => {
    const pool =
      excludeTerm && items.length > 1
        ? items.filter((w) => w.term !== excludeTerm)
        : items;

    if (!pool.length) return null;

    const total = pool.reduce((s, w) => s + w.__weight, 0);
    let r = Math.random() * total;
    for (const w of pool) {
      r -= w.__weight;
      if (r <= 0) return w;
    }
    return pool[pool.length - 1];
  };

  const [current, setCurrent] = useState(null);

  // Reset al cambiar nivel o categoría
  useEffect(() => {
    const n = pickWeighted();
    setCurrent(n);
    setAnswer("");
    setFeedback(null);
    setAttempt(0);
    setMotivation(null); // ocultar motivación al cambiar filtro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, category]);

  // Aviso cuando solo hay 1 ítem disponible en el filtro actual
  useEffect(() => {
    if (items.length === 1) {
      console.warn("⚠️ Solo hay una palabra en este filtro. No se puede cambiar a otra.");
    }
  }, [items.length]);

  const nextCard = () => {
    const n = pickWeighted(current?.term || null);
    setCurrent(n);
    setAnswer("");
    setFeedback(null);
    setAttempt(0);
    setMotivation(null);
  };

  const updateLeitner = (term, wasCorrect) => {
    setProgress((p) => {
      const st = p[term] || { box: 0, seen: 0 };
      let box = st.box ?? 0;
      box = wasCorrect ? Math.min(4, box + 1) : Math.max(0, box - 1);
      return { ...p, [term]: { box, seen: (st.seen ?? 0) + 1, ts: Date.now() } };
    });
  };

  const chooseRandomMotivation = () =>
    MOTIVATION_MESSAGES[Math.floor(Math.random() * MOTIVATION_MESSAGES.length)];

  const handleCheck = () => {
  if (!current) return;
  const ok = matches(answer, current.translation);

  // ✅ RESPUESTA CORRECTA
  if (ok) {
    setFeedback("ok");
    updateLeitner(current.term, true);

    // ⭐ SUMAR RACHA
    setStreak((prev) => prev + 1);

    // ⭐ SUMAR PALABRAS COMPLETADAS (aciertos)
    setAnsweredCount((prev) => prev + 1);

    setTimeout(nextCard, 700);
    return;
  }

  // ❌ el resto de tu lógica de fallo se queda igual
  const newWrong = wrongCount + 1;
  setWrongCount(newWrong);

  if (newWrong % 5 === 0) {
    setMotivation(chooseRandomMotivation());
  } else {
    setMotivation(null);
  }

  if (attempt === 0) {
    setAttempt(1);
    setFeedback("first_wrong");
  } else {
    setFeedback("second_wrong");
    setStreak(0);
    updateLeitner(current.term, false);
    setHardWords((prev) => ({
      ...prev,
      [current.term]: (prev[current.term] ?? 0) + 1,
    }));
  }
};



  const revealAndNext = () => {
  setAttempt(0);
  setFeedback("");
  setMotivation(null);
  setAnswer("");
  nextCard();
};

  // === Estilos ===
  const styles = {
    page: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "#f1f5f9",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: "20px",
    },

    header: { textAlign: "center" },
    select: { padding: "6px 8px", borderRadius: "8px" },

    container: {
      position: "relative",
      background: "white",
      borderRadius: "16px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
      width: "min(92vw, 520px)",
      padding: "24px 20px",
      textAlign: "center",
    },

      streakBox: {
  position: "absolute",
  right: "10px",
  top: "10px",
  background: "#ffffff",
  padding: "8px 12px",
  borderRadius: "12px",
  boxShadow: "0 6px 15px rgba(0,0,0,0.15)",
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
  background: "#2563eb",
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
  boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
  textAlign: "center",
  border: "1px solid #e2e8f0",
  minWidth: "80px",
  margin: "0 auto",        // <--- CENTRADO HORIZONTALMENTE
  marginBottom: "10px",    // espacio debajo del racha box
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
      color: attempt === 1 ? "#dc2626" : "#0f172a",
      transition: "color 0.2s ease",
    },

    input: {
      width: "calc(100% - 24px)",
      maxWidth: "460px",
      padding: "12px",
      borderRadius: "10px",
      border: "1px solid #cbd5e1",
      textAlign: "center",
      margin: "0 auto 12px",
      display: "block",
      fontSize: "16px",
      background: "#2f3133",
      color: "white",
    },

    btnPrimary: {
      background: "#2563eb",
      color: "white",
      padding: "10px 16px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      marginRight: "8px",
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

    // Nubecitas
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
      boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
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
  };


// === UI ===
return (
  <div style={styles.page}>
    
    {/* HEADER */}
<div style={styles.header}>

  {/* Racha ARRIBA DEL TODO */}
  <div style={styles.streakBoxTop}>
    <div style={{ fontSize: "13px", color: "#64748b" }}>Racha</div>
    <div style={styles.streakNumberTop}>{streak}</div>
  </div>

  {/* Título */}
  <h3 style={{ margin: 10, marginTop: 4, color: "#000", textAlign: "center" }}>
    📚 Vocab Trainer
  </h3>

  {/* CONTROLES: NIVEL + CATEGORÍA */}
  <div
    style={{
      marginTop: 8,
      display: "flex",
      gap: 12,
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
    }}
  >
    <div>
      <label style={{ marginRight: 6, color: "#000" }}>Nivel:</label>
      <select
        style={styles.select}
        value={level}
        onChange={(e) => setLevel(e.target.value)}
      >
        {LEVELS.map((lv) => (
          <option key={lv} value={lv}>
            {lv}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label style={{ marginRight: 6, color: "#000" }}>Categoría:</label>
      <select
        style={styles.select}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  </div>

</div>



      {/* TARJETA */}
<div style={styles.container}>
  {items.length === 0 && (
    <p>No hay palabras para el nivel/categoría seleccionados.</p>
  )}



  {items.length > 0 && current && (
    <>
      <div aria-live="polite">
        <div
          style={{ color: "#64748b", fontSize: 12, letterSpacing: 0.3 }}
        >
          Tradúceme esta
        </div>

        {/* BARRA DE PROGRESO */}
        <div style={styles.progressBarOuter}>
          <div
            style={{
              ...styles.progressBarInner,
              width:
                items.length > 0
                  ? `${Math.min(
                      (answeredCount / items.length) * 100,
                      100
                    )}%`
                  : "0%",
            }}
          />
        </div>

        <div style={styles.wordBig}>{current.term}</div>
      </div>

      {/* Nubecita de MOTIVACIÓN (aparece cada 5 fallos) */}
      {motivation && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{ ...styles.bubble, ...styles.bubbleMotivation }}
            role="note"
            aria-live="polite"
          >
            <div
              style={{
                ...styles.bubbleTip,
                ...styles.bubbleMotivationTip,
              }}
            />
            {motivation}
          </div>
        </div>
      )}

      {/* Nubecita con definición en el PRIMER FALLO */}
      {feedback === "first_wrong" && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={styles.bubble} role="note">
            <div style={styles.bubbleTip} />
            {current.definition || "Definition not available."}
          </div>
        </div>
      )}

      <input
        style={styles.input}
        placeholder="Tu traducción…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCheck()}
        autoFocus
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
      />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          flexWrap: "wrap", // 🔹 para que en móvil no se rompa
        }}
      >
        <button style={styles.btnPrimary} onClick={handleCheck}>
          Comprobar
        </button>
        <button
          style={styles.btnSecondary}
          onClick={nextCard}
          title="Saltar"
        >
          Saltar
        </button>
      </div>

      {feedback === "ok" && (
        <p style={styles.feedbackOk}>✅ ¡Correcto!</p>
      )}

      {feedback === "second_wrong" && (
        <>
          <p style={styles.feedbackBad}>❌ Incorrecto (2 intentos)</p>
          <p style={styles.def}>
            No te preocupes, te volverá a aparecer.
            <br />
            Significado: <em>{current.translation}</em>
          </p>
          <button
            style={{ ...styles.btnSecondary, marginTop: 10 }}
            onClick={revealAndNext}
          >
            Siguiente
          </button>
        </>
      )}

      <p style={styles.small}>
        {/* Contador opcional para debug; puedes ocultarlo */}
        wrongs: {wrongCount}
      </p>

      <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>
        Palabras completadas: {answeredCount}
      </p>
    </>
  )}
</div>

    </div>
  );
}
