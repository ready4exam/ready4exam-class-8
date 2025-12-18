import { cleanKatexMarkers } from './utils.js';

let els = {};
let isInit = false;

/* -----------------------------------
   STYLES
----------------------------------- */
const OPTION_BASE =
  "option-label flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 shadow-sm";
const CORRECT = " border-success-green bg-green-50";
const WRONG = " border-danger-red bg-red-50";
const SELECTED = " border-blue-500 bg-blue-50";

/* -----------------------------------
   ASSERTION–REASON RESOLVER (FINAL)
----------------------------------- */
function resolveAR(q) {
  const text = cleanKatexMarkers(q.text || "");
  const reasonText = cleanKatexMarkers(q.scenario_reason || "");

  // Case 1: Assertion + Reason inside question_text
  if (/Assertion\s*\(A\)/i.test(text) && /Reason\s*\(R\)/i.test(text)) {
    const parts = text.split(/Reason\s*\(R\)\s*:/i);
    return {
      assertion: parts[0].replace(/Assertion\s*\(A\)\s*:/i, "").trim(),
      reason: (parts[1] || "").trim()
    };
  }

  // Case 2: Assertion in text, Reason in scenario_reason
  if (reasonText && reasonText !== "EMPTY") {
    return {
      assertion: text.replace(/Regarding.*option\.?/i, "").trim(),
      reason: reasonText.trim()
    };
  }

  // Invalid AR → block rendering
  return null;
}

/* -----------------------------------
   OPTION HTML
----------------------------------- */
function optionHtml(q, opt, selected, submitted, label) {
  const isSel = selected === opt;
  const isCorrect = submitted && q.correct_answer === opt;
  const isWrong = submitted && isSel && !isCorrect;

  const cls = `${OPTION_BASE}${
    isCorrect ? CORRECT :
    isWrong ? WRONG :
    isSel ? SELECTED :
    " border-gray-100 bg-white hover:border-blue-300"
  }`;

  return `
    <label class="block">
      <input type="radio" name="q-${q.id}" value="${opt}" class="hidden"
        ${isSel ? "checked" : ""} ${submitted ? "disabled" : ""}>
      <div class="${cls}">
        <span class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 font-bold mr-4">${opt}</span>
        <span class="font-medium">${label}</span>
      </div>
    </label>`;
}

/* -----------------------------------
   INIT
----------------------------------- */
export function initializeElements() {
  if (isInit) return;

  els = {
    list: document.getElementById("question-list"),
    counter: document.getElementById("question-counter"),
    prev: document.getElementById("prev-btn"),
    next: document.getElementById("next-btn"),
    submit: document.getElementById("submit-btn"),
    quiz: document.getElementById("quiz-content"),
    results: document.getElementById("results-screen"),
    paywall: document.getElementById("paywall-screen"),
    status: document.getElementById("status-message"),
    header: document.getElementById("chapter-name-display"),
    diff: document.getElementById("difficulty-display"),
    reviewContainer: null
  };

  if (!document.getElementById("review-container") && els.results) {
    const d = document.createElement("div");
    d.id = "review-container";
    d.className = "w-full max-w-4xl mt-10 hidden space-y-6";
    els.results.appendChild(d);
    els.reviewContainer = d;
  }

  isInit = true;
}

/* -----------------------------------
   VIEW
----------------------------------- */
export function showView(v) {
  initializeElements();
  [els.quiz, els.results, els.paywall].forEach(x => x?.classList.add("hidden"));
  if (v === "quiz-content") els.quiz?.classList.remove("hidden");
  if (v === "results-screen") els.results?.classList.remove("hidden");
  if (v === "paywall-screen") els.paywall?.classList.remove("hidden");
}

/* -----------------------------------
   HEADER / STATUS
----------------------------------- */
export function updateHeader(t, d) {
  initializeElements();
  els.header.textContent = t;
  els.diff.textContent = `Difficulty: ${d}`;
}

export function showStatus(msg, cls = "text-blue-600") {
  initializeElements();
  els.status.textContent = msg;
  els.status.className = `p-4 font-bold ${cls}`;
  els.status.classList.remove("hidden");
}

export function hideStatus() {
  els.status?.classList.add("hidden");
}

/* -----------------------------------
   QUESTION RENDER (FINAL)
----------------------------------- */
export function renderQuestion(q, idx, selected, submitted) {
  initializeElements();
  const type = (q.question_type || "").toLowerCase();

  // MASTER AR
  if (type.includes("assertion") || type.includes("ar")) {
    const ar = resolveAR(q);
    if (ar) {
      els.list.innerHTML = `
        <div class="space-y-6 text-left">
          <div class="text-xl font-black">Q${idx}. Assertion (A): ${ar.assertion}</div>
          <div class="bg-blue-50 p-6 rounded-xl border-l-4 border-cbse-blue">
            <div class="text-xs font-black uppercase mb-2">Reason (R)</div>
            <div class="text-lg font-semibold">${ar.reason}</div>
          </div>
          <div class="grid gap-3">
            ${optionHtml(q,"A",selected,submitted,"Both A and R are true and R is the correct explanation of A.")}
            ${optionHtml(q,"B",selected,submitted,"Both A and R are true but R is not the correct explanation of A.")}
            ${optionHtml(q,"C",selected,submitted,"A is true but R is false.")}
            ${optionHtml(q,"D",selected,submitted,"A is false but R is true.")}
          </div>
        </div>`;
      return;
    }
  }

  // FALLBACK MCQ
  els.list.innerHTML = `
    <div class="space-y-6 text-left">
      <div class="text-xl font-black">Q${idx}: ${cleanKatexMarkers(q.text)}</div>
      <div class="grid gap-3">
        ${["A","B","C","D"].map(o =>
          optionHtml(q,o,selected,submitted,cleanKatexMarkers(q.options[o]))
        ).join("")}
      </div>
    </div>`;
}

/* -----------------------------------
   ANSWERS
----------------------------------- */
export function attachAnswerListeners(fn) {
  initializeElements();
  els.list.onchange = e => {
    if (e.target.type === "radio") {
      fn(e.target.name.substring(2), e.target.value);
    }
  };
}

/* -----------------------------------
   NAV
----------------------------------- */
export function updateNavigation(i, t, s) {
  els.prev.classList.toggle("hidden", i === 0);
  els.next.classList.toggle("hidden", i === t - 1);
  els.submit.classList.toggle("hidden", s || i !== t - 1);
  els.counter.textContent = `${String(i + 1).padStart(2, "0")} / ${t}`;
}

/* -----------------------------------
   RESULTS + REVIEW
----------------------------------- */
export function renderResults() {
  showView("results-screen");
}

export function renderAllQuestionsForReview(qs, ua) {
  initializeElements();
  els.reviewContainer.classList.remove("hidden");

  els.reviewContainer.innerHTML = qs.map((q,i)=>{
    const w = ua[q.id];
    const c = q.correct_answer;
    return `
      <div class="p-6 bg-white rounded-xl shadow">
        <p class="font-bold mb-3">Q${i+1}: ${cleanKatexMarkers(q.text)}</p>
        <p class="text-red-600 font-bold">❌ ${cleanKatexMarkers(q.options[w])}</p>
        <p class="text-green-700 font-bold">✅ ${cleanKatexMarkers(q.options[c])}</p>
        <p class="text-blue-700 text-sm mt-2">🧠 Correct option follows the concept tested.</p>
      </div>`;
  }).join("");

  els.reviewContainer.scrollIntoView({ behavior: "smooth" });
}
