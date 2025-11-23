import { useEffect, useMemo, useState } from "react";
import motivationsJson from "./data/motivations.json";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";



const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const ALL = "Todas";

// 🔹 Cargamos TODOS los JSON de categorías/niveles
//    Ruta relativa a ESTE archivo (ajusta si lo tienes en otra carpeta)
const modules = import.meta.glob("./data/categories/*/*.json", { eager: true });

/**
 * modules tiene forma:
 * {
 *   "./data/categories/casa/A1.json": { default: [ ...palabras... ] },
 *   "./data/categories/casa/A2.json": { default: [ ... ] },
 *   "./data/categories/animales/A1.json": { default: [ ... ] },
 *   ...
 * }
 *
 * Vamos a convertir eso en un único array `dataJson`
 * con objetos { term, translation, definition, level, category }
 */
const dataJson = Object.entries(modules).flatMap(([path, mod]) => {
  // 1) Sacar categoría y nivel del path
  //    ./data/categories/casa/A1.json  ->  category = "casa", level = "A1"
  const match = path.match(/categories\/([^/]+)\/([^/]+)\.json$/);
  const categoryFromPath = match?.[1] || "general";
  const levelFromPath = match?.[2] || null;

  // 2) El JSON en sí (Vite lo pone en .default)
  const arr = mod.default || mod;

  // 3) Devolvemos cada palabra asegurando que tenga category y level
  return (arr || []).map((item) => ({
    ...item,
    category: item.category || categoryFromPath,
    level: item.level || levelFromPath,
  }));
});


// =========================
//  MATCHING "INTELIGENTE"
// =========================

// Normaliza: minúsculas, quita acentos, recorta espacios
const normalize = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

// Artículos que queremos ignorar
const ARTICLES = [
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "the",
  "a",
  "an",
];

// Quitar artículos al inicio / dentro de la frase
const stripArticles = (str) => {
  const words = str.split(/\s+/).filter(Boolean);
  const filtered = words.filter((w) => !ARTICLES.includes(w));
  return filtered.join(" ");
};

// Intento simple de pasar a singular (solo último término)
const singularizeLastWord = (str) => {
  const words = str.split(" ").filter(Boolean);
  if (!words.length) return str;

  const lastIndex = words.length - 1;
  let last = words[lastIndex];

  if (last.length > 3 && last.endsWith("es")) {
    last = last.slice(0, -2);
  } else if (last.length > 2 && last.endsWith("s")) {
    last = last.slice(0, -1);
  }

  words[lastIndex] = last;
  return words.join(" ");
};

// Forma "base" de una respuesta: normalizada, sin artículos y en singular
const toBaseForm = (s) => {
  let x = normalize(s);
  x = x.replace(/\s+/g, " ").trim();
  if (!x) return "";
  x = stripArticles(x);
  x = singularizeLastWord(x);
  return x;
};

// 👇 Palabra aprendida si alguna vez la has acertado
//const isMastered = (term, progress) =>
//  (progress[term]?.box ?? 0) > 0;


// Distancia de Levenshtein (para errores pequeños)
const levenshtein = (a, b) => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
};

// Comparación "inteligente" entre dos respuestas
const isFuzzyEqual = (userStr, goldStr) => {
  const u = toBaseForm(userStr);
  const g = toBaseForm(goldStr);

  if (!u || !g) return false;
  if (u === g) return true;

  const dist = levenshtein(u, g);
  const maxLen = Math.max(u.length, g.length);

  // Permitir 1 error en palabras cortas, 2 en largas
  const allowed = maxLen <= 4 ? 1 : 2;

  return dist <= allowed;
};

// Acepta varias soluciones separadas por ; o |
// Acepta varias soluciones separadas por ;, | o /
function matches(user, gold) {
  if (!gold) return false;

  const answers = gold
    .split(/[;|/]/)       // 👈 separa por ;   |   /
    .map((x) => x.trim())
    .filter(Boolean);

  return answers.some((ans) => isFuzzyEqual(user, ans));
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

  // --- 🔹 Navegación global ---
  const [user, setUser] = useState(null); // null = no logeado
  const [screen, setScreen] = useState("auth"); // "auth" | "home" | "trainer"

  // --- 🔹 Modos de práctica ---
  const [mode, setMode] = useState("write"); // "write" | "flashcard"
  //const [preferredMode, setPreferredMode] = useState("write");

  // --- 🔹 Dark mode ---
  const [darkMode, setDarkMode] = useState(false);

  // --- 🔹 Flashcards (modo test múltiple) ---
  const [flashOptions, setFlashOptions] = useState([]); // { text, correct }[]
  const [flashStatus, setFlashStatus] = useState("idle"); // "idle" | "correct" | "wrong"
  const [flashSelected, setFlashSelected] = useState(null); // índice del botón pulsado

  // mapa: { [sessionKey]: { [term]: true } }
const [writeDone, setWriteDone] = useState({});
const [flashDone, setFlashDone] = useState({});
const [hardDone, setHardDone] = useState({});


const sessionKey = `${level}_${category}`;


// Stats de la sesión actual de flashcards
const [flashStats, setFlashStats] = useState({
  correct: 0,
  wrong: 0,
  uniqueCorrectTerms: {}, // { [term]: true }
  failedTerms: {},        // { [term]: true }
});

// Si no es null, limita el pool de flashcards solo a esos términos
const [flashRepeatTerms, setFlashRepeatTerms] = useState(null); // null | { [term]: true }


// 🔹 Cargar datos del usuario desde Firestore
const loadUserData = async (uid) => {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();

      // Solo si el documento tiene estos campos, los aplicamos
      if (data.progress) setProgress(data.progress);
      if (data.hardWords) setHardWords(data.hardWords);
      if (typeof data.answeredCount === "number")
        setAnsweredCount(data.answeredCount);
      if (typeof data.streak === "number") setStreak(data.streak);
      if (typeof data.wrongCount === "number") setWrongCount(data.wrongCount);
    } else {
      // Primera vez que entra: creamos el doc vacío-ish
      await setDoc(ref, {
        createdAt: Date.now(),
        progress: {},
        hardWords: {},
        answeredCount: 0,
        wrongCount: 0,
        streak: 0,
      });
    }
  } catch (err) {
    console.error("Error al cargar datos de Firestore:", err);
  }
};



    // === HANDLERS AUTH GOOGLE ===
  const handleGoogleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const gUser = result.user;

    const userObj = {
      uid: gUser.uid,
      name: gUser.displayName || "Usuario",
      email: gUser.email || "",
      photoURL: gUser.photoURL || null,
      isGuest: false,
    };

    setUser(userObj);
    setScreen("home");

    // 👇 Cargar sus datos desde Firestore
    await loadUserData(gUser.uid);
  } catch (err) {
    console.error("Error al hacer login con Google:", err);
    alert("No se pudo iniciar sesión con Google.");
  }
};


  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
    setUser(null);
    setScreen("auth");
  };



  // Carga externa de frases motivacionales con fallback por si el JSON está vacío
  const MOTIVATION_MESSAGES = useMemo(() => {
    const arr = Array.isArray(motivationsJson)
      ? motivationsJson.filter(Boolean)
      : [];
    return arr.length
      ? arr
      : [
          "💪 ¡Ánimo! Vas en la dirección correcta.",
          "🌟 Puedes con esto. Una más y lo clavas.",
          "🚀 Los fallos te hacen mejorar. ¡Sigue!",
          "🧠 Repetir = recordar. ¡Buen trabajo!",
          "🔥 No te rindas: cada intento suma.",
          "🏆 Pasito a pasito se llega lejos.",
          "✨ Lo estás haciendo muy bien, ¡continúa!",
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

  // Guarda hardWords cuando cambien
  useEffect(() => {
    localStorage.setItem("hardWords:v1", JSON.stringify(hardWords));
  }, [hardWords]);

  // categorías únicas a partir del JSON (fallback a "general")
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


// 🔹 Pools por modo: write y flashcard (independientes)
const writePool = useMemo(() => {
  const doneForSession = writeDone[sessionKey] || {};
  return items.filter((w) => !doneForSession[w.term]);
}, [items, writeDone, sessionKey]);

const flashPool = useMemo(() => {
  const doneForSession = flashDone[sessionKey] || {};
  let base = items.filter((w) => !doneForSession[w.term]);

  // Si estamos en modo "repetir solo falladas", filtramos el pool
  if (flashRepeatTerms) {
    base = base.filter((w) => flashRepeatTerms[w.term]);
  }

  return base;
}, [items, flashDone, sessionKey, flashRepeatTerms]);


const hardPool = useMemo(() => {
  const doneForSession = hardDone[sessionKey] || {};
  return items.filter(
    (w) => hardWords[w.term] && !doneForSession[w.term]
  );
}, [items, hardWords, hardDone, sessionKey]);


// 🔹 Todas las palabras del nivel actual
const levelWords = useMemo(
  () => dataJson.filter((w) => w.level === level),
  [level]
);

// 🔹 Cuántas están aprendidas
const masteredCount = useMemo(
  () =>
    levelWords.filter((w) => {
      const st = progress[w.term];
      return (st?.box ?? 0) > 0;
    }).length,
  [levelWords, progress]
);

const totalLevelWords = levelWords.length;
const levelProgress = totalLevelWords > 0 ? (masteredCount / totalLevelWords) * 100 : 0;


// 🔹 Stats derivadas para el modo flashcard
const totalFlashWords = items.length;
const uniqueCorrectFlash = Object.keys(flashStats.uniqueCorrectTerms).length;
const remainingFlash = Math.max(totalFlashWords - uniqueCorrectFlash, 0);
const answeredFlash = flashStats.correct + flashStats.wrong;
const accuracyFlash =
  answeredFlash > 0 ? (flashStats.correct / answeredFlash) * 100 : 0;




  // Selección ponderada evitando repetir la actual
// Selección ponderada desde un pool concreto
    const pickFromPool = (pool, excludeTerm = null) => {
      const basePool =
        excludeTerm && pool.length > 1
          ? pool.filter((w) => w.term !== excludeTerm)
          : pool;

      if (!basePool.length) return null;

      const total = basePool.reduce((s, w) => s + w.__weight, 0);
      let r = Math.random() * total;
      for (const w of basePool) {
        r -= w.__weight;
        if (r <= 0) return w;
      }
      return basePool[basePool.length - 1];
    };


  const [current, setCurrent] = useState(null);

  // Reset al cambiar nivel o categoría
  // Reset al cambiar nivel o categoría
  useEffect(() => {
    nextCard();
    setAnswer("");
    setFeedback(null);
    setAttempt(0);
    setMotivation(null);
    setFlashStatus("idle");
    setFlashSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, category]);

  // 🔹 Cuando cambie el modo (write / flashcard / hard), elegimos una nueva tarjeta
useEffect(() => {
  // si no estamos en la pantalla de entrenamiento, no hace falta
  if (screen !== "trainer") return;

  nextCard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [mode]);



// 🔹 Resetear stats de flashcards al cambiar nivel/categoría o modo
// 🔹 Resetear stats de flashcards al cambiar nivel/categoría o modo
useEffect(() => {
  if (mode === "flashcard") {
    setFlashStats({
      correct: 0,
      wrong: 0,
      uniqueCorrectTerms: {},
      failedTerms: {},
    });
    setFlashRepeatTerms(null);

    // Opcional: limpiar sesión de done en este nivel/categoría
    setFlashDone((prev) => {
      const copy = { ...prev };
      delete copy[sessionKey];
      return copy;
    });
  }
}, [level, category, mode, sessionKey]);






  // Aviso cuando solo hay 1 ítem disponible en el filtro actual
  useEffect(() => {
    if (items.length === 1) {
      console.warn(
        "⚠️ Solo hay una palabra en este filtro. No se puede cambiar a otra."
      );
    }
  }, [items.length]);

  // 🔹 Sincronizar progreso con Firestore cuando el usuario está logueado
  useEffect(() => {
    if (!user || user.isGuest || !user.uid) return;

    const save = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        await setDoc(
          ref,
          {
            progress,
            hardWords,
            answeredCount,
            wrongCount,
            streak,
            updatedAt: Date.now(),
          },
          { merge: true } // 👈 no pisa otros campos
        );
      } catch (err) {
        console.error("Error guardando progreso en Firestore:", err);
      }
    };

  save();
}, [user, progress, hardWords, answeredCount, wrongCount, streak]);


  // Genera 3-4 opciones de respuesta para la tarjeta actual
  const prepareFlashOptions = (targetWord) => {
    if (!targetWord) {
      setFlashOptions([]);
      return;
    }

    let pool = items.filter((w) => w.term !== targetWord.term);
    pool = [...pool].sort(() => Math.random() - 0.5);

    const distractors = pool.slice(0, 5); // hasta 5 falsas

    const rawOptions = [
      { text: targetWord.translation, correct: true },
      ...distractors.map((w) => ({
        text: w.translation,
        correct: false,
      })),
    ];



    const shuffled = rawOptions.sort(() => Math.random() - 0.5);
    setFlashOptions(shuffled);
  };

  // modeOverride es opcional; si no lo pasas, usa el mode actual
const nextCard = (modeOverride = null) => {
  const effectiveMode = modeOverride ?? mode;

  let pool;
  if (effectiveMode === "flashcard") {
    pool = flashPool;
  } else if (effectiveMode === "hard") {
    pool = hardPool;
  } else {
    // "write" por defecto
    pool = writePool;
  }

  const n = pickFromPool(pool, current?.term || null);

  if (!n) {
    setCurrent(null);
    setFlashOptions([]);
    return;
  }

  setCurrent(n);
  setAnswer("");
  setFeedback(null);
  setAttempt(0);
  setMotivation(null);

  setFlashStatus("idle");
  setFlashSelected(null);

  prepareFlashOptions(n);
};





  const updateLeitner = (term, wasCorrect) => {
  setProgress((p) => {
    const st = p[term] || { box: 0, seen: 0 };
    let box = st.box ?? 0;
    box = wasCorrect ? Math.min(4, box + 1) : Math.max(0, box - 1);
    return {
      ...p,
      [term]: { box, seen: (st.seen ?? 0) + 1, ts: Date.now() },
    };
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

  if (mode === "write") {
    // marcar como hecha en modo escribir
    setWriteDone((prev) => {
      const prevSession = prev[sessionKey] || {};
      return {
        ...prev,
        [sessionKey]: {
          ...prevSession,
          [current.term]: true,
        },
      };
    });
  } else if (mode === "hard") {
    // marcar como hecha en modo difíciles
    setHardDone((prev) => {
      const prevSession = prev[sessionKey] || {};
      return {
        ...prev,
        [sessionKey]: {
          ...prevSession,
          [current.term]: true,
        },
      };
    });
  }

  setTimeout(nextCard, 1300);
  return;
}


    // ❌ RESPUESTA INCORRECTA (pero la racha solo se rompe en el 2º fallo)
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

  // Para modo flashcards: marcar si la sabías o no
  const handleFlashcardResult = (wasCorrect, chosenIndex) => {
  if (!current) return;

  setFlashSelected(chosenIndex);
  setFlashStatus(wasCorrect ? "correct" : "wrong");

  if (wasCorrect) {
    updateLeitner(current.term, true);
    setStreak((prev) => prev + 1);
    setAnsweredCount((prev) => prev + 1);

    // Marcar como "hecha" en flashcards
    setFlashDone((prev) => {
      const prevSession = prev[sessionKey] || {};
      return {
        ...prev,
        [sessionKey]: {
          ...prevSession,
          [current.term]: true,
        },
      };
    });

    setFlashStats((prev) => ({
      correct: prev.correct + 1,
      wrong: prev.wrong,
      uniqueCorrectTerms: {
        ...prev.uniqueCorrectTerms,
        [current.term]: true,
      },
      // no tocamos failedTerms aquí: nos interesa saber
      // si alguna vez fue fallada en esta sesión
      failedTerms: prev.failedTerms,
    }));
  } else {
    updateLeitner(current.term, false);
    setStreak(0);
    setWrongCount((prev) => prev + 1);
    setHardWords((prev) => ({
      ...prev,
      [current.term]: (prev[current.term] ?? 0) + 1,
    }));

    setFlashStats((prev) => ({
      ...prev,
      wrong: prev.wrong + 1,
      failedTerms: {
        ...prev.failedTerms,
        [current.term]: true,
      },
    }));
  }

  setTimeout(() => {
    nextCard();
  }, 700);
};

const handleRepeatAllFlash = () => {
  // Reset stats y pool completo
  setFlashStats({
    correct: 0,
    wrong: 0,
    uniqueCorrectTerms: {},
    failedTerms: {},
  });
  setFlashRepeatTerms(null);

  // Limpiamos palabras marcadas como hechas en este nivel/categoría
  setFlashDone((prev) => {
    const copy = { ...prev };
    delete copy[sessionKey];
    return copy;
  });

  nextCard();
};

const handleRepeatFailedFlash = () => {
  const failedTerms = Object.keys(flashStats.failedTerms || {});
  if (!failedTerms.length) {
    // Si no hubo falladas, es lo mismo que repetir todo
    handleRepeatAllFlash();
    return;
  }

  // Creamos mapa de términos que queremos practicar
  const map = failedTerms.reduce((acc, term) => {
    acc[term] = true;
    return acc;
  }, {});

  setFlashRepeatTerms(map);

  // Reset stats (pero mantenemos failedTerms para mostrar lista)
  setFlashStats({
    correct: 0,
    wrong: 0,
    uniqueCorrectTerms: {},
    failedTerms: flashStats.failedTerms,
  });

  // Limpiamos "hechas" para que puedan volver a salir
  setFlashDone((prev) => {
    const copy = { ...prev };
    delete copy[sessionKey];
    return copy;
  });

  nextCard();
};



  // === Tema claro / oscuro ===
  const pageBg = darkMode ? "#1c1e25f5" : "#f1f5f9";
  const cardBg = "#ffffff";
  const titleColor = darkMode ? "#e5e7eb" : "#000000";
  const inputBg = darkMode ? "#020617" : "#2f3133";
  const inputText = darkMode ? "#e5e7eb" : "#ffffff";

  // === Estilos ===
  const styles = {
    page: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: pageBg,
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
      background: cardBg,
      borderRadius: "16px",
      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.08)",
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
      background: inputBg,
      color: inputText,
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

  // ======================
  //  PANTALLAS SECUNDARIAS
  // ======================

  const ScreenAuth = () => (
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
        onClick={handleGoogleLogin}
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
        onClick={() => {
          setUser({
            uid: null,
            name: "Invitado",
            email: "",
            photoURL: null,
            isGuest: true,
          });
          setScreen("home");
        }}
      >
        🚪 Entrar sin registrarse
      </button>


    </div>
  );

 

  const ScreenHome = () => (
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
          onClick={() => {
            //setPreferredMode("write");
            setMode("write");
            setScreen("trainer");
          }}
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
          }}
          onClick={() => {
            setMode("flashcard");
            setScreen("trainer");
          }}
        >
          🃏 Practicar con Flashcards
      </button>

      {/* 👇 NUEVO botón perfil */}
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
    onClick={() => setScreen("user")}
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
        onClick={handleLogout}
      >
        Cerrar sesión
      </button>
    </div>
  );

  const ScreenUser = () => {
  // calcular stats por nivel
  const levelStats = LEVELS.map((lv) => {
    const words = dataJson.filter((w) => w.level === lv);
    const total = words.length;
    const mastered = words.filter((w) => {
      const st = progress[w.term];
      return (st?.box ?? 0) > 0;
    }).length;
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { level: lv, total, mastered, pct };
  });

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
          {user?.isGuest ? "Invitado (no guarda en la nube)" : "Conectado con Google"}
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
        <button
          style={styles.btnSecondary}
          onClick={() => setScreen("home")}
        >
          ⬅️ Volver al inicio
        </button>

        <button
          style={{
            ...styles.btnSecondary,
            borderColor: "#dc2626",
            color: "#dc2626",
          }}
          onClick={handleLogout}
        >
          🚪 Cerrar sesión
        </button>
      </div>
    </div>
  );
};


  // === UI ===
  return (
    <div style={styles.page}>
      {/* 🔹 PANTALLA LOGIN */}
      {screen === "auth" && <ScreenAuth />}

      {/* 🔹 PANTALLA HOME (selección de modo) */}
      {screen === "home" && <ScreenHome />}

      {screen === "user" && <ScreenUser />}

      {/* 🔹 PANTALLA TRAINER (lo de siempre) */}
      {screen === "trainer" && (
        <>
          {/* HEADER */}
          <div style={styles.header}>

          {/* 🔹 BADGE DE USUARIO (foto + estado) */}
            {user && (
              <div style={styles.userBadge}>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.name}
                    style={styles.avatar}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div style={styles.avatarFallback}>
                    {user.isGuest ? "👤" : (user.name?.[0] ?? "?")}
                  </div>
                )}
                <div style={styles.userInfo}>
                  <div style={styles.userName}>{user.name}</div>
                  <div style={styles.userTag}>
                    {user.isGuest ? "Modo invitado" : "Conectado con Google"}
                  </div>
                </div>
              </div>
            )}


            {/* Racha ARRIBA DEL TODO */}
            <div style={styles.streakBoxTop}>
              <div style={{ fontSize: "13px", color: "#64748b" }}>Racha</div>
              <div style={styles.streakNumberTop}>{streak}</div>
            </div>

            {/* Título */}
            <h3
              style={{
                margin: 10,
                marginTop: 4,
                color: titleColor,
                textAlign: "center",
              }}
            >
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
                <label style={{ marginRight: 6, color: titleColor }}>
                  Nivel:
                </label>
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
                <label style={{ marginRight: 6, color: titleColor }}>
                  Categoría:
                </label>
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

            {/* Toggle de modo + Dark mode */}
            <div style={styles.modeToggle}>
  <button
  style={mode === "write" ? styles.modeBtnActive : styles.modeBtn}
  onClick={() => {
    setMode("write");
    setFeedback(null);
    setAttempt(0);
    setMotivation(null);
    setFlashStatus("idle");
    setFlashSelected(null);
  }}
>
  ✍️ Escribir
</button>

<button
  style={mode === "flashcard" ? styles.modeBtnActive : styles.modeBtn}
  onClick={() => {
    setMode("flashcard");
    setFeedback(null);
    setAttempt(0);
    setFlashStatus("idle");
    setFlashSelected(null);
  }}
>
  🃏 Flashcards
</button>

<button
  style={mode === "hard" ? styles.modeBtnActive : styles.modeBtn}
  onClick={() => {
    setMode("hard");
    setFeedback(null);
    setAttempt(0);
    setMotivation(null);
    setFlashStatus("idle");
    setFlashSelected(null);
  }}
>
  ⭐ Difíciles
</button>

</div>



            <button
              style={styles.darkToggle}
              onClick={() => setDarkMode((d) => !d)}
            >
              {darkMode ? "🌙 Dark" : "☀️ Light"}
            </button>



          </div>

          {/* TARJETA */}
          <div
            style={styles.container}
            className={
              "flashcard-container " +
              (mode === "flashcard" && flashStatus === "correct"
                ? "flashcard-correct "
                : "") +
              (mode === "flashcard" && flashStatus === "wrong"
                ? "flashcard-wrong "
                : "")
            }
          >

            {items.length === 0 && (
              <p>No hay palabras para el nivel/categoría seleccionados.</p>
            )}

            {items.length > 0 && current && (
              <>
                {/* MODO ESCRIBIR */}
                {/* MODO ESCRIBIR y MODO DIFÍCILES (misma UI) */}
{(mode === "write" || mode === "hard") && current && (
  <>
    <div aria-live="polite">
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          letterSpacing: 0.3,
        }}
      >
        {mode === "write"
          ? "Tradúceme esta"
          : "Palabra difícil – escríbela correctamente"}
      </div>

      {/* Barra de progreso SOLO en modo write */}
      {mode === "write" && (
        <>
          <div style={styles.progressBarOuter}>
            <div
              style={{
                ...styles.progressBarInner,
                width: `${Math.min(levelProgress, 100)}%`,
              }}
            />
          </div>

          <p
            style={{
              fontSize: 11,
              color: "#0b0b0cff",
              marginTop: 4,
            }}
          >
            Nivel {level}: {masteredCount} / {totalLevelWords} palabras
            aprendidas
          </p>
        </>
      )}

      <div style={styles.wordBig}>{current.term}</div>
    </div>

    {/* Nubecita de MOTIVACIÓN */}
    {motivation && (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{ ...styles.bubble, ...styles.bubbleMotivation }}
          role="note"
          aria-live="polite"
        >
          <div style={{ ...styles.bubbleTip, ...styles.bubbleMotivationTip }} />
          {motivation}
        </div>
      </div>
    )}

    {/* Definición en PRIMER FALLO */}
    {feedback === "first_wrong" && (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={styles.bubble} role="note">
          <div style={styles.bubbleTip} />
          {current.definition || "Definition not available."}
        </div>
      </div>
    )}

    {/* Input */}
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

    {/* Botones */}
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <button style={styles.btnPrimary} onClick={handleCheck}>
        Comprobar
      </button>
      <button style={styles.btnSecondary} onClick={nextCard} title="Saltar">
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
  </>
)}


{/* 🔚 MENSAJE DE FIN DE MODO (WRITE / FLASHCARD / HARD) */}
{items.length > 0 && !current && (
  <div style={{ textAlign: "center", padding: "20px 10px" }}>
    
    {/* WRITE */}
    {mode === "write" && (
      <>
        <p style={{ fontSize: 16, marginBottom: 8 }}>
          🎉 Ya has completado todas las palabras de este nivel en el modo escribir.
        </p>

        {/* Resumen */}
        <div
          style={{
            fontSize: 12,
            color: "#64748b",
            marginBottom: 10,
            lineHeight: 1.4,
          }}
        >
          <div>
            Nivel {level}: {masteredCount} / {totalLevelWords} palabras
            aprendidas (modo escribir).
          </div>
          <div>
            Progreso del nivel:{" "}
            {totalLevelWords > 0 ? Math.round(levelProgress) : 0}%
          </div>
        </div>

        {/* Datos del test */}
        <div
          style={{
            fontSize: 12,
            color: "#64748b",
            marginBottom: 12,
            lineHeight: 1.4,
          }}
        >
          {flashStats.correct + flashStats.wrong > 0 ? (
            <>
              <div>Último test de este nivel:</div>
              <div>
                ✓ Aciertos:{" "}
                <span style={{ color: "#16a34a" }}>
                  {flashStats.correct}
                </span>
              </div>
              <div>
                ✗ Fallos:{" "}
                <span style={{ color: "#dc2626" }}>
                  {flashStats.wrong}
                </span>
              </div>
              <div>
                🎯 Precisión:{" "}
                {answeredFlash > 0 ? accuracyFlash.toFixed(0) : 0}%
              </div>
            </>
          ) : (
            <div>
              Aún no has hecho el test de este nivel. Puedes usar el modo 🃏
              Flashcards para repasar.
            </div>
          )}
        </div>

        <p style={{ fontSize: 13, color: "#64748b" }}>
          Puedes cambiar de nivel, de categoría o reiniciar este nivel si
          quieres volver a practicar.
        </p>
      </>
    )}

    {/* FLASHCARD */}
    {mode === "flashcard" && (
      <>
        <p style={{ fontSize: 16, marginBottom: 8 }}>
          ✅ Has completado todas las preguntas de test de este nivel.
        </p>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
          Para consolidar este nivel y pasar al siguiente, ahora completa las
          palabras en el modo ✍️ Escribir.
        </p>

        <div
          style={{
            fontSize: 12,
            color: "#64748b",
            marginBottom: 12,
            lineHeight: 1.4,
          }}
        >
          <div>Totales: {totalFlashWords}</div>
          <div>
            ✓ Aciertos:{" "}
            <span style={{ color: "#16a34a" }}>{flashStats.correct}</span>
          </div>
          <div>
            ✗ Fallos:{" "}
            <span style={{ color: "#dc2626" }}>{flashStats.wrong}</span>
          </div>
          <div>
            🎯 Precisión:{" "}
            {answeredFlash > 0 ? accuracyFlash.toFixed(0) : 0}%
          </div>
        </div>

        {Object.keys(flashStats.failedTerms || {}).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p
              style={{
                fontSize: 12,
                color: "#64748b",
                marginBottom: 6,
              }}
            >
              Palabras que te dieron problemas:
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 6,
                fontSize: 12,
              }}
            >
              {Object.keys(flashStats.failedTerms)
                .slice(0, 12)
                .map((term) => (
                  <span
                    key={term}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#f9fafb",
                    }}
                  >
                    {term}
                  </span>
                ))}
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          {Object.keys(flashStats.failedTerms || {}).length > 0 && (
            <button
              style={styles.btnPrimary}
              onClick={handleRepeatFailedFlash}
            >
              🔁 Repetir solo las falladas
            </button>
          )}
          <button
            style={styles.btnSecondary}
            onClick={handleRepeatAllFlash}
          >
            🔁 Repetir todo el test
          </button>
        </div>
      </>
    )}

    {/* HARD */}
    {mode === "hard" && (
      <>
        <p style={{ fontSize: 16, marginBottom: 8 }}>
          ⭐ No hay más palabras difíciles en este nivel/categoría.
        </p>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Ve al modo ✍️ Escribir o 🃏 Flashcards, o cambia de nivel/categoría.
        </p>
      </>
    )}
  </div>
)}





                {/* MODO FLASHCARDS – TEST MÚLTIPLE */}
{/* MODO FLASHCARDS – TEST MÚLTIPLE */}
{mode === "flashcard" && (
  <>
    {/* Texto aclaratorio del modo */}
    <div style={{ marginTop: 4, marginBottom: 8 }}>
      <p style={{ fontSize: 11, color: "#64748b" }}>
        🃏 Modo test (no afecta al progreso oficial del nivel)
      </p>
    </div>

    {/* Stats de la sesión de test */}
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 10,
        fontSize: 11,
        color: "#64748b",
        marginBottom: 8,
      }}
    >
      <span>Totales: {totalFlashWords}</span>
      <span>Te quedan: {remainingFlash}</span>
      <span style={{ color: "#16a34a" }}>✓ Aciertos: {flashStats.correct}</span>
      <span style={{ color: "#dc2626" }}>✗ Fallos: {flashStats.wrong}</span>

      <span>
        🎯 Precisión: {answeredFlash > 0 ? accuracyFlash.toFixed(0) : 0}%
      </span>
    </div>

    <div
      aria-live="polite"
      style={{ marginBottom: 16, marginTop: 8 }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          letterSpacing: 0.3,
        }}
      >
        Elige la traducción correcta
      </div>
      <div style={styles.wordBig}>{current.term}</div>
    </div>

    {/* grid de opciones, igual que ya lo tenías */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
        marginTop: 8,
        width: "100%",
        maxWidth: 420,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      {flashOptions.map((opt, idx) => {
        // 🎯 ESTILO BASE: pill SIEMPRE
        let btnStyle = {
          borderRadius: 999,
          border: "2px solid #00050aff",
          background: "#ffffff",
          color: "#334155",
          cursor: flashStatus === "idle" ? "pointer" : "default",

          width: "100%",
          margin: "2px",
          boxSizing: "border-box",

          // Tamaño fijo y texto centrado
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px 16px",
          height: "52px",
          fontSize: 14,
          textAlign: "center",

          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",

          transition:
            "transform 0.2s ease, background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
        };

        if (flashStatus !== "idle") {
          const isSelected = flashSelected === idx;

          if (flashStatus === "correct" && isSelected) {
            btnStyle = {
              ...btnStyle,
              background: "#bbf7d0",
              color: "#166534",
              borderColor: "#16a34a",
              transform: "scale(1.03)",
            };
          }

          if (flashStatus === "wrong") {
            if (isSelected && !opt.correct) {
              // elegida y mala
              btnStyle = {
                ...btnStyle,
                background: "#fecaca",
                color: "#7f1d1d",
                borderColor: "#dc2626",
                transform: "scale(0.97)",
              };
            }
            if (opt.correct) {
              // la correcta
              btnStyle = {
                ...btnStyle,
                background: "#bbf7d0",
                color: "#166534",
                borderColor: "#16a34a",
              };
            }
          }
        }

        return (
          <div
            key={idx}
            role="button"
            className="flash-option"
            style={btnStyle}
            onClick={() => {
              if (flashStatus !== "idle") return; // ignorar clicks extra
              handleFlashcardResult(opt.correct, idx);
            }}
          >
            {opt.text}
          </div>
        );
      })}
    </div>
  </>
)}








                {/* Info común abajo */}
                <p style={styles.small}>
                  {/* Contador opcional para debug; puedes ocultarlo */}
                  wrongs: {wrongCount}
                </p>

                <p
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 10,
                  }}
                >
                  Palabras completadas: {answeredCount}
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
