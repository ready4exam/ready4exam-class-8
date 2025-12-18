// js/ui-renderer.js
import { cleanKatexMarkers } from "./utils.js";

let els = {};
let isInit = false;

/* ================= UI CONSTANTS ================= */
const OPTION_BASE =
  "option-label flex items-start p-3 border-2 rounded-lg cursor-pointer transition";
const STYLES = {
  correct: " border-green-600 bg-green-50",
  wrong: " border-red-600 bg-red-50",
  selected: " border-blue-500 bg-blue-50",
};

/* ================= HELPERS ================= */
const strip = (t = "") =>
  t.replace(
    /^\s*(Reasoning|Reason|Context|Assertion|Assertion \(A\)|Reason \(R\)|Scenario)\s*[:\-]\s*/gi,
    ""
  ).trim();

/* ================= INIT ================= */
export function initializeElements() {
  if (isInit) return;
  els = {
    title: document.getElementById("quiz-page-title"),
    diff: document.getElementById("difficulty-display"),
    status: document.getElementById("status-message"),
    list: document.getElementById("question-list"),
    counter: document.getElementById("question-counter"),
    prev: document.getElementById("prev-btn"),
    next: document.getElementById("next-btn"),
    submit: document.getElementById("submit-btn"),
    quiz: document.getElementById("quiz-content"),
    results: document.getElementById("results-screen"),
    score: document.getElementById("score-display"),
    paywall: document.getElementById("paywall-screen"),
  };
  isInit = true;
}

/* ================= STATUS ================= */
export function showStatus(msg = "", type = "info") {
  initializeElements();
  if (!els.status) return;
  const map = {
    info: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-green-50 text-green-700 border-green-200",
    error: "bg-red-50 text-red-700 border-red-200",
    warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
  };
  els.status.className = `px-4 py-2 rounded border text-sm ${map[type] || map.info}`;
  els.status.textContent = msg;
  els.status.classList.remove("hidden");
}

/* ================= OPTION ================= */
function optionHTML(q, opt, sel, done, text) {
  const isSel = sel === opt;
  const isCorrect = done && q.correct === opt;
  const isWrong = done && isSel && !isCorrect;

  return `
  <label>
    <input type="radio" class="hidden" name="q-${q.id}" value="${opt}"
      ${isSel ? "checked" : ""} ${done ? "disabled" : ""}>
    <div class="${OPTION_BASE}${
      isCorrect ? STYLES.correct : isWrong ? STYLES.wrong : isSel ? STYLES.selected : ""
    }">
      <b class="mr-3">${opt}.</b>
      <span>${text || cleanKatexMarkers(q.options[opt] || "")}</span>
    </div>
  </label>`;
}

/* ================= QUESTION ================= */
export function renderQuestion(q, idx, selected, submitted) {
  initializeElements();
  if (!els.list) return;

  const data = {
    id: q.id,
    type: (q.question_type || q.type || "").toLowerCase(),
    text: cleanKatexMarkers(q.text || ""),
    context: strip(cleanKatexMarkers(q.scenario_reason || q.context || "")),
    explanation: strip(cleanKatexMarkers(q.explanation || "")),
    correct: (q.correct_answer || "").toUpperCase(),
    options: q.options || {},
  };

  const O = ["A", "B", "C", "D"];

  /* -------- ASSERTION–REASON -------- */
  if (data.type === "ar" || data.text.toLowerCase().includes("assertion")) {
    const AR = {
      A: "Both A and R are true and R is the correct explanation of A.",
      B: "Both A and R are true but R is not the correct explanation of A.",
      C: "A is true but R is false.",
      D: "A is false but R is true.",
    };

    els.list.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 border rounded">
          <b>Q${idx}.</b>
          <div class="mt-2"><b>Assertion (A):</b> ${data.text}</div>
          <div class="mt-2 p-3 bg-gray-50 border-l-4 border-blue-500">
            <b class="block text-xs uppercase mb-1">Reason (R)</b>
            ${data.context || data.explanation}
          </div>
        </div>
        ${O.map(o => optionHTML(data, o, selected, submitted, AR[o])).join("")}
      </div>`;
    return;
  }

  /* -------- CASE BASED -------- */
  if (data.type.includes("case")) {
    els.list.innerHTML = `
      <div class="grid md:grid-cols-2 gap-6">
        <div class="p-4 bg-gray-50 border rounded">
          <b>Context</b>
          <p class="mt-2 text-sm">${data.context}</p>
        </div>
        <div>
          <b>Q${idx}: ${data.text}</b>
          <div class="space-y-3 mt-3">
            ${O.map(o => optionHTML(data, o, selected, submitted)).join("")}
          </div>
          ${
            data.explanation && !submitted
              ? `<div class="mt-4 p-3 bg-blue-50 border rounded text-sm">
                   <b>Hint:</b> ${data.explanation}
                 </div>`
              : ""
          }
        </div>
      </div>`;
    return;
  }

  /* -------- NORMAL MCQ -------- */
  els.list.innerHTML = `
    <div class="space-y-4">
      <b>Q${idx}: ${data.text}</b>
      ${data.explanation && !submitted ? `<div class="text-sm italic">Hint: ${data.explanation}</div>` : ""}
      ${O.map(o => optionHTML(data, o, selected, submitted)).join("")}
      ${
        submitted && data.explanation
          ? `<div class="p-3 bg-gray-50 border text-sm"><b>Reasoning:</b> ${data.explanation}</div>`
          : ""
      }
    </div>`;
}

/* ================= ANSWERS ================= */
export function attachAnswerListeners(fn) {
  initializeElements();
  els.list.onchange = e => {
    if (e.target?.type === "radio")
      fn(e.target.name.slice(2), e.target.value);
  };
}

/* ================= NAV ================= */
export function updateNavigation(i, total, done) {
  initializeElements();
  els.counter.textContent = `${i + 1} / ${total}`;
  els.prev.classList.toggle("hidden", i === 0);
  els.next.classList.toggle("hidden", i === total - 1);
  els.submit.classList.toggle("hidden", done || i !== total - 1);
}

/* ================= RESULTS ================= */
export function showResults(score, total) {
  initializeElements();
  els.score.textContent = `${score} / ${total}`;
  showView("results");
}

export function getResultFeedback({ score, total, difficulty }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  return {
    title: pct >= 90 ? "Excellent!" : pct >= 60 ? "Good effort!" : "Keep practicing!",
    message: `You scored ${pct}%`,
    percentage: pct,
  };
}

/* ================= VIEW ================= */
export function showView(v) {
  initializeElements();
  els.quiz.classList.add("hidden");
  els.results.classList.add("hidden");
  els.paywall.classList.add("hidden");
  (els[v] || els[`${v}`])?.classList.remove("hidden");
}
