// js/ui-renderer.js
import { cleanKatexMarkers } from './utils.js';

let els = {};
let isInit = false;

/* -----------------------------------
   UI STYLING CONSTANTS
----------------------------------- */
const OPTION_BASE_CLS =
  "option-label flex items-start p-3 border-2 rounded-lg cursor-pointer transition";
const CORRECT_CLS = " border-green-600 bg-green-50";
const WRONG_CLS = " border-red-600 bg-red-50";
const SELECTED_CLS = " border-blue-500 bg-blue-50";

/* -----------------------------------
   TEXT NORMALIZER
----------------------------------- */
function normalizeReasonText(txt) {
  if (!txt) return "";
  const pattern =
    /^\s*(Reasoning|Reason|Context|Assertion|Assertion \(A\)|Reason \(R\)|Scenario|Suggestion text|Consider the impact of|Consider the)\s*(\(R\)|\(A\))?\s*[:\-]\s*/gi;
  return txt.replace(pattern, "").replace(pattern, "").trim();
}

/* -----------------------------------
   ELEMENT INITIALIZATION
----------------------------------- */
export function initializeElements() {
  if (isInit) return;

  els = {
    title: document.getElementById("quiz-page-title"),
    diffBadge: document.getElementById("difficulty-display"),
    status: document.getElementById("status-message"),
    list: document.getElementById("question-list"),
    counter: document.getElementById("question-counter"),
    prevButton: document.getElementById("prev-btn"),
    nextButton: document.getElementById("next-btn"),
    submitButton: document.getElementById("submit-btn"),
    reviewScreen: document.getElementById("results-screen"),
    score: document.getElementById("score-display"),
    authNav: document.getElementById("auth-nav-container"),
    paywallScreen: document.getElementById("paywall-screen"),
    paywallContent: document.getElementById("paywall-content"),
    quizContent: document.getElementById("quiz-content"),
    reviewContainer: document.getElementById("review-container"),
    welcomeUser: document.getElementById("welcome-user"),
    miniTitle: document.getElementById("quiz-title"),
    chapterNameDisplay: document.getElementById("chapter-name-display"),
  };

  if (!els.reviewContainer && els.reviewScreen) {
    const rc = document.createElement("div");
    rc.id = "review-container";
    rc.className = "w-full max-w-3xl text-left mb-8";
    els.reviewScreen.insertBefore(
      rc,
      els.reviewScreen.querySelector(".flex") || null
    );
    els.reviewContainer = rc;
  }

  isInit = true;
}

/* -----------------------------------
   STATUS MESSAGE HANDLER (FIX)
----------------------------------- */
export function showStatus(message = "", type = "info") {
  initializeElements();
  if (!els.status) return;

  const base =
    "px-4 py-2 rounded-md text-sm font-medium transition";

  const styles = {
    info: "bg-blue-50 text-blue-700 border border-blue-200",
    success: "bg-green-50 text-green-700 border border-green-200",
    error: "bg-red-50 text-red-700 border border-red-200",
    warning: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  };

  els.status.className = `${base} ${styles[type] || styles.info}`;
  els.status.textContent = message;
  els.status.classList.remove("hidden");
}

export function hideStatus() {
  initializeElements();
  if (els.status) els.status.classList.add("hidden");
}

/* -----------------------------------
   LOADING OVERLAY
----------------------------------- */
export function showAuthLoading(message = "Preparing your challenge...") {
  initializeElements();
  let overlay = document.getElementById("auth-loading-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "auth-loading-overlay";
    overlay.className =
      "fixed inset-0 bg-white flex flex-col items-center justify-center z-50";

    overlay.innerHTML = `
      <div class="flex flex-col items-center max-w-sm px-6 text-center">
        <div class="relative mb-8">
          <div class="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-75"></div>
          <div class="relative bg-blue-600 p-6 rounded-full shadow-xl">
            <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13">
              </path>
            </svg>
          </div>
        </div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">
          Think Like a Pro!
        </h2>
        <p class="text-blue-600 font-medium animate-pulse mb-6">
          ${message}
        </p>
        <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
          <div class="bg-blue-600 h-full animate-progress-bar"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector("p").textContent = message;
    overlay.classList.remove("hidden");
  }
}

export function hideAuthLoading() {
  const overlay = document.getElementById("auth-loading-overlay");
  if (overlay) overlay.classList.add("hidden");
}

/* -----------------------------------
   OPTION RENDERER
----------------------------------- */
function generateOptionHtml(q, opt, selected, submitted, optionText) {
  const txt = optionText
    ? optionText
    : cleanKatexMarkers(q.options[opt] || "");

  const isSel = selected === opt;
  const isCorrect =
    submitted && q.correct_answer?.toUpperCase() === opt;
  const isWrong = submitted && isSel && !isCorrect;

  const cls = `${OPTION_BASE_CLS}${
    isCorrect
      ? CORRECT_CLS
      : isWrong
      ? WRONG_CLS
      : isSel
      ? SELECTED_CLS
      : ""
  }`;

  return `
    <label class="block">
      <input type="radio"
             name="q-${q.id}"
             value="${opt}"
             class="hidden"
             ${isSel ? "checked" : ""}
             ${submitted ? "disabled" : ""}>
      <div class="${cls}">
        <span class="font-bold mr-3">${opt}.</span>
        <span class="text-gray-800">${txt}</span>
      </div>
    </label>
  `;
}

/* -----------------------------------
   QUESTION RENDERER
----------------------------------- */
export function renderQuestion(q, idxOneBased, selected, submitted) {
  initializeElements();
  if (!els.list) return;

  const mapped = {
    id: q.id,
    question_type: (q.question_type || q.type || "").toLowerCase(),
    text: q.text || q.question_text || q.prompt || "",
    scenario_reason: q.scenario_reason || q.context || q.passage || "",
    explanation: q.explanation || q.reason || "",
    correct_answer: (q.correct_answer || q.answer || "").toUpperCase(),
    options: {
      A: q.options?.A || q.option_a || "",
      B: q.options?.B || q.option_b || "",
      C: q.options?.C || q.option_c || "",
      D: q.options?.D || q.option_d || "",
    },
  };

  const type = mapped.question_type;
  const optKeys = ["A", "B", "C", "D"];

  /* ============ ASSERTION–REASON ============ */
  if (type === "ar" || mapped.text.toLowerCase().includes("assertion")) {
    const assertion = normalizeReasonText(cleanKatexMarkers(mapped.text));
    const reason = normalizeReasonText(
      cleanKatexMarkers(mapped.scenario_reason || mapped.explanation)
    );

    const arOptions = {
      A: "Both A and R are true and R is the correct explanation of A.",
      B: "Both A and R are true but R is not the correct explanation of A.",
      C: "A is true but R is false.",
      D: "A is false but R is true.",
    };

    const html = optKeys
      .map(opt =>
        generateOptionHtml(mapped, opt, selected, submitted, arOptions[opt])
      )
      .join("");

    els.list.innerHTML = `
      <div class="space-y-6">
        <div class="p-4 bg-white rounded border">
          <div class="font-bold mb-2">Q${idxOneBased}.</div>
          <div class="mb-3"><b>Assertion (A):</b> ${assertion}</div>
          <div class="bg-gray-50 p-3 border-l-4 border-blue-500">
            <span class="font-bold text-xs uppercase block mb-1">Reason (R)</span>
            ${reason}
          </div>
        </div>
        <div class="space-y-3">${html}</div>
      </div>
    `;
    return;
  }

  /* ============ CASE BASED ============ */
  if (type === "case" || type === "case based") {
    const scenario = normalizeReasonText(cleanKatexMarkers(mapped.scenario_reason));
    const question = cleanKatexMarkers(mapped.text);
    const hint = normalizeReasonText(cleanKatexMarkers(mapped.explanation));

    const optionsHtml = optKeys
      .map(opt => generateOptionHtml(mapped, opt, selected, submitted))
      .join("");

    els.list.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-gray-50 p-4 border rounded">
          <b>Context</b>
          <p class="mt-2 text-sm">${scenario}</p>
        </div>
        <div>
          <div class="font-bold mb-3">Q${idxOneBased}: ${question}</div>
          <div class="space-y-3">${optionsHtml}</div>
          ${
            hint && !submitted
              ? `<div class="mt-4 p-3 bg-blue-50 border rounded text-sm">
                   <b>Hint:</b> ${hint}
                 </div>`
              : ""
          }
        </div>
      </div>
    `;
    return;
  }

  /* ============ NORMAL MCQ ============ */
  const qText = cleanKatexMarkers(mapped.text);
  const reason = normalizeReasonText(cleanKatexMarkers(mapped.explanation));

  const optionsHtml = optKeys
    .map(opt => generateOptionHtml(mapped, opt, selected, submitted))
    .join("");

  els.list.innerHTML = `
    <div class="space-y-6">
      <div class="font-bold">Q${idxOneBased}: ${qText}</div>
      ${reason && !submitted ? `<div class="text-sm italic">Hint: ${reason}</div>` : ""}
      <div class="space-y-3">${optionsHtml}</div>
      ${
        submitted && reason
          ? `<div class="mt-3 p-3 bg-gray-50 border text-sm">
               <b>Reasoning:</b> ${reason}
             </div>`
          : ""
      }
    </div>
  `;
}

/* -----------------------------------
   ANSWER HANDLING
----------------------------------- */
export function attachAnswerListeners(handler) {
  initializeElements();
  if (!els.list) return;

  if (els._listener)
    els.list.removeEventListener("change", els._listener);

  els._listener = (e) => {
    if (e.target?.type === "radio") {
      handler(e.target.name.substring(2), e.target.value);
    }
  };

  els.list.addEventListener("change", els._listener);
}

/* -----------------------------------
   NAVIGATION
----------------------------------- */
export function updateNavigation(index, total, submitted) {
  initializeElements();
  const show = (btn, cond) =>
    btn && btn.classList.toggle("hidden", !cond);

  show(els.prevButton, index > 0);
  show(els.nextButton, index < total - 1);
  show(els.submitButton, !submitted && index === total - 1);

  if (els.counter)
    els.counter.textContent = `${index + 1} / ${total}`;
}

/* -----------------------------------
   RESULTS + VIEW
----------------------------------- */
export function showResults(score, total) {
  initializeElements();
  if (els.score) els.score.textContent = `${score} / ${total}`;
  showView("results-screen");
}

export function showView(viewName) {
  initializeElements();
  const views = {
    "quiz-content": els.quizContent,
    "results-screen": els.reviewScreen,
    "paywall-screen": els.paywallScreen,
  };

  Object.values(views).forEach(v => v?.classList.add("hidden"));
  views[viewName]?.classList.remove("hidden");
}
