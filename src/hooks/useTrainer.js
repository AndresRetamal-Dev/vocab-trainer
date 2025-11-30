// src/hooks/useTrainer.js
import { useEffect, useMemo, useState } from "react";
import motivationsJson from "../data/motivations.json";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { matches } from "../utils/matching";

// Constantes compartidas
export const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
export const ALL = "Todas";

// 🔹 Cargamos TODOS los JSON: data/languages/<lang>/categories/<category>/<level>.json
const modules = import.meta.glob(
  "../data/languages/*/categories/*/*.json",
  { eager: true }
);

/**
 * modules tiene forma:
 * {
 *   "../data/categories/casa/A1.json": { default: [ ...palabras... ] },
 *   "../data/categories/casa/A2.json": { default: [ ... ] },
 *   "../data/categories/animales/A1.json": { default: [ ... ] },
 *   ...
 * }
 *
 * Lo convertimos en un único array `dataJson`
 * con objetos { term, translation, definition, level, category }
 */
export const dataJson = Object.entries(modules).flatMap(([path, mod]) => {
  const match = path.match(
    /languages\/([^/]+)\/categories\/([^/]+)\/([^/]+)\.json$/
  );
  const languageFromPath = match?.[1] || "en";
  const categoryFromPath = match?.[2] || "general";
  const levelFromPath = match?.[3] || null;

  const arr = mod.default || mod;

  return (arr || []).map((item) => ({
    ...item,
    category: item.category || categoryFromPath,
    level: item.level || levelFromPath,
    language: item.language || languageFromPath,
  }));
});


export default function useTrainer(user, language = "en") {
  // === ESTADO PRINCIPAL DEL ENTRENADOR ===
  const [level, setLevel] = useState("A1");
  const [category, setCategory] = useState(ALL);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // "ok" | "first_wrong" | "second_wrong" | null
  const [attempt, setAttempt] = useState(0); // 0 = primer intento; 1 = segundo

  const [wrongCount, setWrongCount] = useState(0);
  const [motivation, setMotivation] = useState(null);
  const [streak, setStreak] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  const [hardWords, setHardWords] = useState({});
    const [mode, setMode] = useState("write"); // "write" | "flashcard" | "hard"

  // Cuando cambia el idioma, volvemos a A1 / Todas
  useEffect(() => {
    setLevel("A1");
    setCategory(ALL);
  }, [language]);

  // Flashcards (modo test)
  const [flashOptions, setFlashOptions] = useState([]);

  const [flashStatus, setFlashStatus] = useState("idle"); // "idle" | "correct" | "wrong"
  const [flashSelected, setFlashSelected] = useState(null);

  // Sesiones por modo
  const [writeDone, setWriteDone] = useState({});
  const [flashDone, setFlashDone] = useState({});
  const [hardDone, setHardDone] = useState({});

  const sessionKey = `${language}_${level}_${category}`;

  // Stats de la sesión actual de flashcards
  const [flashStats, setFlashStats] = useState({
    correct: 0,
    wrong: 0,
    uniqueCorrectTerms: {}, // { [term]: true }
    failedTerms: {}, // { [term]: true }
  });

  // Si no es null, limita el pool de flashcards solo a esos términos
  const [flashRepeatTerms, setFlashRepeatTerms] = useState(null);

  // Frases motivacionales
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

  // Progreso Leitner
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

  // Cargar hardWords al iniciar
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

  // Guardar hardWords
  useEffect(() => {
    localStorage.setItem("hardWords:v1", JSON.stringify(hardWords));
  }, [hardWords]);

  // CATEGORIES (solo del idioma actual)
  const CATEGORIES = useMemo(() => {
    const set = new Set();
    for (const w of dataJson) {
      if (w.language !== language) continue;
      set.add((w.category || "general").trim());
    }
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b, "es"))];
  }, [language]);


    // Filtrado por idioma + nivel/categoría + peso Leitner
    const items = useMemo(() => {
      const filtered = dataJson.filter((w) => {
        const okLang = w.language === language;
        const okLevel = level ? w.level === level : true;
        const cat = (w.category || "general").trim();
        const okCat = category === ALL ? true : cat === category;
        return okLang && okLevel && okCat;
      });


    return filtered.map((w) => {
      const st = progress[w.term] || { box: 0 };
      const weight = Math.max(1, 5 - (st.box ?? 0)); // box 0 => 5, box 4 => 1
      return { ...w, __weight: weight };
    });
    }, [language, level, category, progress]);


  // Pools por modo
  const writePool = useMemo(() => {
    const doneForSession = writeDone[sessionKey] || {};
    return items.filter((w) => !doneForSession[w.term]);
  }, [items, writeDone, sessionKey]);

  const flashPool = useMemo(() => {
    const doneForSession = flashDone[sessionKey] || {};
    let base = items.filter((w) => !doneForSession[w.term]);
    if (flashRepeatTerms) {
      base = base.filter((w) => flashRepeatTerms[w.term]);
    }
    return base;
  }, [items, flashDone, sessionKey, flashRepeatTerms]);

  const hardPool = useMemo(() => {
    const doneForSession = hardDone[sessionKey] || {};
    return items.filter((w) => hardWords[w.term] && !doneForSession[w.term]);
  }, [items, hardWords, hardDone, sessionKey]);

    // Todas las palabras del nivel actual (solo idioma actual)
  const levelWords = useMemo(
    () => dataJson.filter((w) => w.language === language && w.level === level),
    [language, level]
  );


  // Cuántas están aprendidas
  const masteredCount = useMemo(
    () =>
      levelWords.filter((w) => {
        const st = progress[w.term];
        return (st?.box ?? 0) > 0;
      }).length,
    [levelWords, progress]
  );

  const totalLevelWords = levelWords.length;
  const levelProgress =
    totalLevelWords > 0 ? (masteredCount / totalLevelWords) * 100 : 0;

  // Stats derivadas para flashcard
  const totalFlashWords = items.length;
  const uniqueCorrectFlash = Object.keys(flashStats.uniqueCorrectTerms).length;
  const remainingFlash = Math.max(totalFlashWords - uniqueCorrectFlash, 0);
  const answeredFlash = flashStats.correct + flashStats.wrong;
  const accuracyFlash =
    answeredFlash > 0 ? (flashStats.correct / answeredFlash) * 100 : 0;

  // Stats por nivel (para pantalla perfil)
  const levelStats = useMemo(() => {
    return LEVELS.map((lv) => {
      const words = dataJson.filter(
        (w) => w.language === language && w.level === lv
      );
      const total = words.length;
      const mastered = words.filter((w) => {
        const st = progress[w.term];
        return (st?.box ?? 0) > 0;
      }).length;
      const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
      return { level: lv, total, mastered, pct };
    });
  }, [language, progress]);


  // Palabra actual
  const [current, setCurrent] = useState(null);

  // === FIRESTORE: cargar datos de usuario ===
  const loadUserData = async (uid) => {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        if (data.progress) setProgress(data.progress);
        if (data.hardWords) setHardWords(data.hardWords);
        if (typeof data.answeredCount === "number")
          setAnsweredCount(data.answeredCount);
        if (typeof data.streak === "number") setStreak(data.streak);
        if (typeof data.wrongCount === "number") setWrongCount(data.wrongCount);
      } else {
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

  // Cargar datos de Firestore cuando el usuario cambia
  useEffect(() => {
    if (!user || user.isGuest || !user.uid) return;

    loadUserData(user.uid);
  }, [user]);


    // Resetear estado cuando se entra como invitado o se hace logout
  useEffect(() => {
    if (!user || user.isGuest || !user.uid) {
      // Cargar progreso local del invitado
      try {
        const localProgress = localStorage.getItem("progress:v1");
        setProgress(localProgress ? JSON.parse(localProgress) : {});
      } catch {
        setProgress({});
      }

      try {
        const localHard = localStorage.getItem("hardWords:v1");
        setHardWords(localHard ? JSON.parse(localHard) : {});
      } catch {
        setHardWords({});
      }

      // Resetear contadores
      setStreak(0);
      setAnsweredCount(0);
      setWrongCount(0);

      return;
    }
  }, [user]);


  // Sincronizar progreso con Firestore
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
          { merge: true }
        );
      } catch (err) {
        console.error("Error guardando progreso en Firestore:", err);
      }
    };

    save();
  }, [user, progress, hardWords, answeredCount, wrongCount, streak]);

  // Selección ponderada
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

  // Opciones flashcard
  const prepareFlashOptions = (targetWord) => {
    if (!targetWord) {
      setFlashOptions([]);
      return;
    }

    let pool = items.filter((w) => w.term !== targetWord.term);
    pool = [...pool].sort(() => Math.random() - 0.5);

    const distractors = pool.slice(0, 5);

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

  // Siguiente tarjeta
  const nextCard = (modeOverride = null) => {
    const effectiveMode = modeOverride ?? mode;

    let pool;
    if (effectiveMode === "flashcard") {
      pool = flashPool;
    } else if (effectiveMode === "hard") {
      pool = hardPool;
    } else {
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

  // Reset al cambiar nivel/categoría
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

  // Cambiar de modo => nueva tarjeta
  useEffect(() => {
    nextCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Reset stats flash al cambiar nivel/categoría o modo
  useEffect(() => {
    if (mode === "flashcard") {
      setFlashStats({
        correct: 0,
        wrong: 0,
        uniqueCorrectTerms: {},
        failedTerms: {},
      });
      setFlashRepeatTerms(null);

      setFlashDone((prev) => {
        const copy = { ...prev };
        delete copy[sessionKey];
        return copy;
      });
    }
  }, [level, category, mode, sessionKey]);

  // Resetear sesión de difíciles al cambiar nivel/categoría o cambiar a modo hard
  useEffect(() => {
    if (mode === "hard") {
      setHardDone((prev) => {
        const copy = { ...prev };
        delete copy[sessionKey];
        return copy;
      });
    }
  }, [level, category, mode, sessionKey]);


  // Aviso 1 solo ítem
  useEffect(() => {
    if (items.length === 1) {
      console.warn(
        "⚠️ Solo hay una palabra en este filtro. No se puede cambiar a otra."
      );
    }
  }, [items.length]);

  // Actualizar Leitner
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

  // Comprobar respuesta (modo write/hard)
  const handleCheck = () => {
    if (!current) return;
    const ok = matches(answer, current.translation);

    if (ok) {
      setFeedback("ok");
      updateLeitner(current.term, true);
      setStreak((prev) => prev + 1);
      setAnsweredCount((prev) => prev + 1);

      if (mode === "write") {
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

    // ❌ incorrecta
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

  // Resultado flashcard (correcta/incorrecta)
  const handleFlashcardResult = (wasCorrect, chosenIndex) => {
    if (!current) return;

    setFlashSelected(chosenIndex);
    setFlashStatus(wasCorrect ? "correct" : "wrong");

    if (wasCorrect) {
      // Flashcards no afectan al Leitner ni a la racha real
      // updateLeitner(current.term, true);
      // setStreak((prev) => prev + 1);
      // setAnsweredCount((prev) => prev + 1);

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
        failedTerms: prev.failedTerms,
      }));
    } else {
      // Flashcards no afectan al Leitner ni a la racha real
      // updateLeitner(current.term, false);
      // setStreak(0);
      // setWrongCount((prev) => prev + 1);
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
    setFlashStats({
      correct: 0,
      wrong: 0,
      uniqueCorrectTerms: {},
      failedTerms: {},
    });
    setFlashRepeatTerms(null);

    setFlashDone((prev) => {
      const copy = { ...prev };
      delete copy[sessionKey];
      return copy;
    });

    nextCard();
  };

  const handleRepeatFailedFlash = () => {
    const failedTermsKeys = Object.keys(flashStats.failedTerms || {});
    if (!failedTermsKeys.length) {
      handleRepeatAllFlash();
      return;
    }

    const map = failedTermsKeys.reduce((acc, term) => {
      acc[term] = true;
      return acc;
    }, {});

    setFlashRepeatTerms(map);

    setFlashStats({
      correct: 0,
      wrong: 0,
      uniqueCorrectTerms: {},
      failedTerms: flashStats.failedTerms,
    });

    setFlashDone((prev) => {
      const copy = { ...prev };
      delete copy[sessionKey];
      return copy;
    });

    nextCard();
  };

  // 🔙 Lo que el hook expone
  return {
    // constantes
    LEVELS,
    CATEGORIES,

    // estado principal
    level,
    setLevel,
    category,
    setCategory,
    mode,
    setMode,
    answer,
    setAnswer,
    feedback,
    setFeedback,
    attempt,
    setAttempt,
    wrongCount,
    motivation,
    setMotivation,
    streak,
    answeredCount,
    hardWords,
    current,
    flashOptions,
    flashStatus,
    setFlashStatus,
    flashSelected,
    setFlashSelected,

    // datos derivados
    items,
    masteredCount,
    totalLevelWords,
    levelProgress,
    totalFlashWords,
    remainingFlash,
    answeredFlash,
    accuracyFlash,
    flashStats,
    levelStats,

    // acciones
    handleCheck,
    revealAndNext,
    handleFlashcardResult,
    handleRepeatAllFlash,
    handleRepeatFailedFlash,
    nextCard,
  };
}

