import React from "react";

export default function TrainerScreen({
  user,
  titleColor,
  styles,
  LEVELS,
  CATEGORIES,
  level,
  setLevel,
  category,
  setCategory,
  mode,
  setMode,
  darkMode,
  setDarkMode,
  streak,
  items,
  current,
  levelProgress,
  masteredCount,
  totalLevelWords,
  motivation,
  feedback,
  attempt,
  answer,
  setAnswer,

  handleCheck,
  nextCard,
  revealAndNext,
  flashStatus,
  flashSelected,
  totalFlashWords,
  remainingFlash,
  flashStats,
  answeredFlash,
  accuracyFlash,
  flashOptions,
  handleFlashcardResult,
  handleRepeatAllFlash,
  handleRepeatFailedFlash,
  wrongCount,
  answeredCount,
  setFeedback,
  setAttempt,
  setMotivation,
  setFlashStatus,
  setFlashSelected,
}) {
  return (
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
                {user.isGuest ? "👤" : user.name?.[0] ?? "?"}
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
            <label style={{ marginRight: 6, color: titleColor }}>Nivel:</label>
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

        {/* HAY PALABRAS Y TARJETA ACTUAL */}
        {items.length > 0 && current && (
          <>
            {/* MODO ESCRIBIR y MODO DIFÍCILES (misma UI) */}
            {(mode === "write" || mode === "hard") && (
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
                        Nivel {level}: {masteredCount} / {totalLevelWords}{" "}
                        palabras aprendidas
                      </p>
                    </>
                  )}

                  <div
                    style={{
                      ...styles.wordBig,
                      color: attempt === 1 ? "#dc2626" : styles.wordBig.color,
                    }}
                  >
                    {current.term}
                  </div>
                </div>

                {/* Nubecita de MOTIVACIÓN */}
                {motivation && (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div
                      style={{
                        ...styles.bubble,
                        ...styles.bubbleMotivation,
                      }}
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
                    <p style={styles.feedbackBad}>
                      ❌ Incorrecto (2 intentos)
                    </p>
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

            {/* MODO FLASHCARDS – TEST MÚLTIPLE */}
            {mode === "flashcard" && (
              <>
                {/* Texto aclaratorio del modo */}
                <div style={{ marginTop: 4, marginBottom: 8 }}>
                    <p style={{ fontSize: 11, color: "#64748b" }}>
                    🃏 Modo test (también cuenta para tu progreso Leitner)
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
                  <span style={{ color: "#16a34a" }}>
                    ✓ Aciertos: {flashStats.correct}
                  </span>
                  <span style={{ color: "#dc2626" }}>
                    ✗ Fallos: {flashStats.wrong}
                  </span>

                  <span>
                    🎯 Precisión:{" "}
                    {answeredFlash > 0 ? accuracyFlash.toFixed(0) : 0}%
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
                                    <div
                    style={{
                      ...styles.wordBig,
                      color: attempt === 1 ? "#dc2626" : styles.wordBig.color,
                    }}
                  >
                    {current.term}
                  </div>

                </div>

                {/* grid de opciones */}
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
                      cursor:
                        flashStatus === "idle" ? "pointer" : "default",

                      width: "100%",
                      margin: "2px",
                      boxSizing: "border-box",

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
                          if (flashStatus !== "idle") return;
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

        {/* 🔚 MENSAJE DE FIN DE MODO (WRITE / FLASHCARD / HARD) */}
        {items.length > 0 && !current && (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            {/* WRITE */}
            {mode === "write" && (
              <>
                <p style={{ fontSize: 16, marginBottom: 8 }}>
                  🎉 Ya has completado todas las palabras de este nivel en el
                  modo escribir.
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
                    {totalLevelWords > 0
                      ? Math.round(levelProgress)
                      : 0}
                    %
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
                      Aún no has hecho el test de este nivel. Puedes usar el
                      modo 🃏 Flashcards para repasar.
                    </div>
                  )}
                </div>

                <p style={{ fontSize: 13, color: "#64748b" }}>
                  Puedes cambiar de nivel, de categoría o reiniciar este nivel
                  si quieres volver a practicar.
                </p>
              </>
            )}

            {/* FLASHCARD */}
            {mode === "flashcard" && (
              <>
                <p style={{ fontSize: 16, marginBottom: 8 }}>
                  ✅ Has completado todas las preguntas de test de este nivel.
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    marginBottom: 10,
                  }}
                >
                  Para consolidar este nivel y pasar al siguiente, ahora
                  completa las palabras en el modo ✍️ Escribir.
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
                  Ve al modo ✍️ Escribir o 🃏 Flashcards, o cambia de
                  nivel/categoría.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
