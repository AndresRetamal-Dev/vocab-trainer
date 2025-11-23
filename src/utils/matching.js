// src/utils/matching.js

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

// Acepta varias soluciones separadas por ;, | o /
export function matches(user, gold) {
  if (!gold) return false;

  const answers = gold
    .split(/[;|/]/)
    .map((x) => x.trim())
    .filter(Boolean);

  return answers.some((ans) => isFuzzyEqual(user, ans));
}
