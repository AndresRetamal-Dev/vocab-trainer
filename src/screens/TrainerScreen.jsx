import React from "react";
import "../styles/trainer.css";

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
  onBackHome,
  onLogout,
}) {
  // Helpers para clases de animación
  const wordWriteClass =
    feedback === "ok"
      ? "trainer-word anim-correct-bounce"
      : feedback === "first_wrong"
      ? "trainer-word anim-shake"
      : "trainer-word";

  const wordFlashClass =
    flashStatus === "correct"
      ? "trainer-word anim-correct-bounce"
      : "trainer-word";

  return (
    <div className="trainer-root">
      {/* TÍTULO PRINCIPAL */}
      <h2
        style={{
          fontSize: "26px",
          marginBottom: "12px",
          textAlign: "center",
          color: titleColor,
          fontWeight: 700,
        }}
      >
        📚 Vocab Trainer
      </h2>

            {/* HEADER */}
      <div className="trainer-header">
        {/* Fila superior: usuario + botones + tema */}
        <div className="trainer-header-top">
          {/* 🔹 BADGE DE USUARIO */}
          {user && (
            <div style={styles.userBadge} className="trainer-user-badge">
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
                  {user.isGuest
                    ? "Invitado (no guarda en la nube)"
                    : "Cuenta registrada (email/contraseña)"}
                </div>
              </div>
            </div>
          )}

          {/* Botones arriba a la derecha */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <button
              style={styles.darkToggle}
              className="trainer-dark-toggle"
              onClick={() => setDarkMode((d) => !d)}
            >
              {darkMode ? "🌙 Dark" : "☀️ Light"}
            </button>

            <button
              style={styles.btnSecondary}
              onClick={onBackHome}
            >
              🏠 Inicio
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


        {/* CONTROLES: NIVEL + CATEGORÍA */}
        <div className="selector-group">
          <div className="selector-box">
            <span className="selector-label">🎯 Nivel:</span>
            <select
              className="selector-select"
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

          <div className="selector-box">
            <span className="selector-label">🗂️ Categoría:</span>
            <select
              className="selector-select"
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


        {/* MODO: WRITE / FLASH / HARD */}
        <div className="trainer-modes-row">
          <button
            className={
              mode === "write"
                ? "trainer-mode-btn trainer-mode-btn--active"
                : "trainer-mode-btn"
            }
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
            className={
              mode === "flashcard"
                ? "trainer-mode-btn trainer-mode-btn--active"
                : "trainer-mode-btn"
            }
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
            className={
              mode === "hard"
                ? "trainer-mode-btn trainer-mode-btn--active"
                : "trainer-mode-btn"
            }
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
      </div>

      {/* TARJETA */}
      <div
        style={styles.container}
        className={
          "trainer-card flashcard-container " +
          (mode === "flashcard" && flashStatus === "correct"
            ? "flashcard-correct "
            : "") +
          (mode === "flashcard" && flashStatus === "wrong"
            ? "flashcard-wrong "
            : "")
        }
      >
        <div className="trainer-card-inner">
          {items.length === 0 && (
            <p>No hay palabras para el nivel/categoría seleccionados.</p>
          )}

          {/* HAY PALABRAS Y TARJETA ACTUAL */}
          {items.length > 0 && current && (
            <>
              {/* MODO ESCRIBIR y MODO DIFÍCILES */}
              {(mode === "write" || mode === "hard") && (
                <>
                  <div aria-live="polite" style={{ width: "100%" }}>

                    <p
                      style={{
                        fontSize: "20px",
                        fontWeight: "600",
                        color: "#ef4444",
                        marginTop: "4px",
                        marginBottom: "8px",
                        textAlign: "center",
                      }}
                    >
                      🔥 Racha: {streak}
                    </p>

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
                            textAlign: "center",
                          }}
                        >
                          Nivel {level}: {masteredCount} / {totalLevelWords}{" "}
                          palabras aprendidas
                        </p>
                      </>
                    )}

                    <div
                      className={wordWriteClass}
                      style={{
                        ...styles.wordBig,
                        color:
                          attempt === 1 ? "#dc2626" : styles.wordBig.color,
                      }}
                    >
                      {current.term}
                    </div>
                  </div>

                  {/* Nubecita de MOTIVACIÓN */}
                  {motivation && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                      }}
                    >
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                      }}
                    >
                      <div style={styles.bubble} role="note">
                        <div style={styles.bubbleTip} />
                        {current.definition || "Definition not available."}
                      </div>
                    </div>
                  )}

                  {/* Input */}
                  <input
                    style={styles.input}
                    className={feedback === "first_wrong" ? "anim-shake" : ""}
                    placeholder="Tu traducción…"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                    autoFocus
                    inputMode="text"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />

                  {/* Botón principal */}
                  <div className="trainer-buttons-row">
                    <button
                      style={styles.btnPrimary}
                      className={
                        streak >= 13
                          ? "btn-check-tension-super"
                          : streak >= 8
                          ? "btn-check-tension-strong"
                          : streak >= 5
                          ? "btn-check-tension"
                          : ""
                      }
                      onClick={handleCheck}
                    >
                      Comprobar
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

              {/* MODO FLASHCARDS */}
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
                    style={{ marginBottom: 16, marginTop: 8, width: "100%" }}
                  >

                    <p
                      style={{
                        fontSize: "20px",
                        fontWeight: "600",
                        color: "#ef4444",
                        marginTop: "4px",
                        marginBottom: "8px",
                        textAlign: "center",
                      }}
                    >
                      🔥 Racha: {streak}
                    </p>

                    <div
                      className={wordFlashClass}
                      style={{
                        ...styles.wordBig,
                        color: styles.wordBig.color,
                      }}
                    >
                      {current.term}
                    </div>
                  </div>

                  {/* grid de opciones */}
                  <div className="trainer-flash-grid">
                    {flashOptions.map((opt, idx) => {
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
                            btnStyle = {
                              ...btnStyle,
                              background: "#fecaca",
                              color: "#7f1d1d",
                              borderColor: "#dc2626",
                              transform: "scale(0.97)",
                            };
                          }
                          if (opt.correct) {
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
              <div className="trainer-footer">
                <div className="trainer-stats-column">
                  <div className="trainer-stat-pill">
                    ❌ Fallos:{" "}
                    <span className="trainer-stat-number">
                      {wrongCount}
                    </span>
                  </div>

                  <div className="trainer-stat-pill">
                    ✅ Completadas:{" "}
                    <span className="trainer-stat-number">
                      {answeredCount}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 🔚 MENSAJE DE FIN DE MODO */}
          {items.length > 0 && !current && (
            <div
              style={{
                textAlign: "center",
                padding: "20px 10px",
                width: "100%",
              }}
            >
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
                      Nivel {level}: {masteredCount} / {totalLevelWords}{" "}
                      palabras aprendidas (modo escribir).
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
                          {answeredFlash > 0
                            ? accuracyFlash.toFixed(0)
                            : 0}
                          %
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
                    ✅ Has completado todas las preguntas de test de este
                    nivel.
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
                      {answeredFlash > 0
                        ? accuracyFlash.toFixed(0)
                        : 0}
                      %
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
                    {Object.keys(flashStats.failedTerms || {}).length >
                      0 && (
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
      </div>
    </div>
  );
}
