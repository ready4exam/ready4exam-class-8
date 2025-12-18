// js/ui-renderer.js
import { cleanKatexMarkers } from './utils.js';

let els = {};
let isInit = false;

/* -----------------------------------
   UI STYLING CONSTANTS
----------------------------------- */
const OPTION_BASE_CLS = "option-label flex items-start p-3 border-2 rounded-lg cursor-pointer transition";
const CORRECT_CLS = " border-green-600 bg-green-50";
const WRONG_CLS = " border-red-600 bg-red-50";
const SELECTED_CLS = " border-blue-500 bg-blue-50";

/* -----------------------------------
   INTERNAL HELPERS
----------------------------------- */
function normalizeReasonText(txt) {
  if (!txt) return "";
  // Aggressive cleaning to prevent duplicate labels
  const pattern = /^\s*(Reasoning|Reason|Context|Assertion|Assertion \(A\)|Reason \(R\)|Scenario|Suggestion text|Consider the impact of|Consider the)\s*(\(R\)|\(A\))?\s*[:\-]\s*/gi;
  return txt.replace(pattern, "").replace(pattern, "").trim();
}

function generateOptionHtml(q, opt, selected, submitted, optionText) {
  const txt = optionText ? optionText : cleanKatexMarkers(q.options[opt] || "");
  const isSel = selected === opt;
  const isCorrect = submitted && q.correct_answer?.toUpperCase() === opt;
  const isWrong = submitted && isSel && !isCorrect;
  const cls = `${OPTION_BASE_CLS}${isCorrect ? CORRECT_CLS : isWrong ? WRONG_CLS : isSel ? SELECTED_CLS : ""}`;

  return `
    <label class="block">
      <input type="radio" name="q-${q.id}" value="${opt}" class="hidden" ${isSel ? "checked" : ""} ${submitted ? "disabled" : ""}>
      <div class="${cls}">
        <span class="font-bold mr-3">${opt}.</span>
        <span class="text-gray-800">${txt}</span>
      </div>
    </label>`;
}

/* -----------------------------------
   CORE EXPORTS (REQUIRED BY QUIZ-ENGINE.JS)
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
    els.reviewScreen.insertBefore(rc, els.reviewScreen.querySelector(".flex") || null);
    els.reviewContainer = rc;
  }
  isInit = true;
}

/**
 * FIXED: Explicitly exported showStatus to resolve quiz-engine.js errors
 */
export function showStatus(msg, cls = "text-gray-700") {
  initializeElements();
  if (!els.status) return;
  els.status.innerHTML = msg;
  els.status.className = `p-3 text-center font-semibold ${cls}`;
  els.status.classList.remove("hidden");
}

export function hideStatus() {
  initializeElements();
  if (els.status) els.status.classList.add("hidden");
}

export function showAuthLoading(message = "Preparing your challenge...") {
  initializeElements();
  let overlay = document.getElementById("auth-loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "auth-loading-overlay";
    overlay.className = "fixed inset-0 bg-white flex flex-col items-center justify-center z-50 animate-fadeIn";
    overlay.innerHTML = `
      <div class="flex flex-col items-center max-w-sm px-6 text-center">
        <div class="relative mb-8">
          <div class="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-75"></div>
          <div class="relative bg-blue-600 p-6 rounded-full shadow-xl">
             <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
             </svg>
          </div>
        </div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Think Like a Pro!</h2>
        <p class="text-blue-600 font-medium animate-pulse mb-6">${message}</p>
        <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
           <div class="bg-blue-600 h-full animate-progress-bar"></div>
        </div>
      </div>
      <style>
        @keyframes progress-anim { 0% { width: 0%; } 50% { width: 70%; } 100% { width: 100%; } }
        .animate-progress-bar { animation: progress-anim 2s infinite ease-in-out; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      </style>`;
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

export function updateHeader(topicDisplayTitle, diff) {
  initializeElements();
  if (els.title) els.title.textContent = topicDisplayTitle;
  if (els.diffBadge) {
    els.diffBadge.textContent = `Difficulty: ${diff || "--"}`;
    els.diffBadge.classList.remove("hidden");
  }
}

export function renderQuestion(q, idxOneBased, selected, submitted) {
  initializeElements();
  if (!els.list) return;

  const type = (q.question_type || "").toLowerCase();

  /* ================= ASSERTION–REASON (FIXED) ================= */
  if (type === "ar" || q.text.toLowerCase().includes("assertion")) {
    const assertion = normalizeReasonText(cleanKatexMarkers(q.text));
    const reason = normalizeReasonText(cleanKatexMarkers(q.scenario_reason || q.explanation));
    const arOptions = {
      A: "Both A and R are true and R is the correct explanation of A.",
      B: "Both A and R are true but R is not the correct explanation of A.",
      C: "A is true but R is false.",
      D: "A is false but R is true.",
    };
    const html = ["A", "B", "C", "D"].map(o => generateOptionHtml(q, o, selected, submitted, arOptions[o])).join("");

    els.list.innerHTML = `
      <div class="space-y-6 animate-fadeIn text-left">
        <div>
          <div class="text-lg font-bold text-gray-900 leading-relaxed mb-4">
            Q${idxOneBased}. Assertion (A): ${assertion}
          </div>
          <div class="bg-gray-50 p-3 rounded border-l-4 border-blue-500">
            <span class="text-blue-800 font-bold uppercase text-xs block mb-1">Reason (R)</span>
            <div class="text-gray-800 leading-relaxed">${reason}</div>
          </div>
        </div>
        <div class="space-y-3">${html}</div>
      </div>`;
    return;
  }

  /* ================= CASE BASED (USING HINT) ================= */
  if (type.includes("case")) {
    const scenario = normalizeReasonText(cleanKatexMarkers(q.scenario_reason));
    const question = cleanKatexMarkers(q.text);
    const hint = normalizeReasonText(cleanKatexMarkers(q.explanation));
    const html = ["A", "B", "C", "D"].map(o => generateOptionHtml(q, o, selected, submitted)).join("");

    els.list.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn text-left">
        <div class="p-5 bg-gray-50 rounded-xl border border-gray-200 max-h-96 overflow-y-auto shadow-inner">
          <h3 class="font-bold mb-3 text-indigo-700 uppercase text-xs border-b pb-2 tracking-wider">Context</h3>
          <p class="text-gray-800 text-sm leading-relaxed">${scenario}</p>
        </div>
        <div class="space-y-6">
          <div class="text-lg font-bold text-gray-900 leading-relaxed">Q${idxOneBased}: ${question}</div>
          <div class="space-y-3">${html}</div>
          ${hint && !submitted ? `<div class="mt-4 p-3 bg-blue-50 border border-blue-100 rounded text-gray-700 text-sm"><span class="font-bold text-blue-700 uppercase text-xs block mb-1">💡 Hint</span>${hint}</div>` : ""}
        </div>
      </div>`;
    return;
  }

  /* ================= NORMAL MCQ ================= */
  const qText = cleanKatexMarkers(q.text);
  const hint = normalizeReasonText(cleanKatexMarkers(q.explanation));
  const html = ["A", "B", "C", "D"].map(o => generateOptionHtml(q, o, selected, submitted)).join("");

  els.list.innerHTML = `
    <div class="space-y-6 animate-fadeIn text-left">
      <div class="text-lg font-bold text-gray-900 leading-relaxed">Q${idxOneBased}: ${qText}</div>
      ${hint && !submitted ? `<div class="text-sm italic bg-gray-50 p-2 rounded text-gray-600"><b>💡 Hint:</b> ${hint}</div>` : ""}
      <div class="space-y-3">${html}</div>
    </div>`;
}

export function attachAnswerListeners(handler) {
  initializeElements();
  if (!els.list) return;
  if (els._listener) els.list.removeEventListener("change", els._listener);
  els._listener = (e) => { if (e.target?.type === "radio") handler(e.target.name.substring(2), e.target.value); };
  els.list.addEventListener("change", els._listener);
}

export function updateNavigation(index, total, submitted) {
  initializeElements();
  const show = (btn, cond) => btn && btn.classList.toggle("hidden", !cond);
  show(els.prevButton, index > 0);
  show(els.nextButton, index < total - 1);
  show(els.submitButton, !submitted && index === total - 1);
  if (els.counter) els.counter.textContent = `${index + 1} / ${total}`;
}

export function showResults(score, total) {
  initializeElements();
  if (els.score) els.score.textContent = `${score} / ${total}`;
  showView("results-screen");
}

export function getResultFeedback({ score, total, difficulty }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  return {
    title: pct >= 90 ? "Excellent!" : pct >= 60 ? "Good effort!" : "Keep practicing!",
    message: `You scored ${pct}% on ${difficulty || 'this challenge'}.`,
    percentage: pct,
  };
}

export function showView(viewName) {
  initializeElements();
  const views = { "quiz-content": els.quizContent, "results-screen": els.reviewScreen, "paywall-screen": els.paywallScreen };
  Object.values(views).forEach((v) => v?.classList.add("hidden"));
  views[viewName]?.classList.remove("hidden");
}

export function updateAuthUI(user) {
  initializeElements();
  if (!els.authNav) return;
  const welcomeEl = els.welcomeUser;
  if (user) {
    welcomeEl.textContent = `Welcome, ${user.displayName?.split(" ")[0] || "Student"}!`;
    welcomeEl.classList.remove("hidden");
    document.getElementById("logout-nav-btn")?.classList.remove("hidden");
  } else {
    welcomeEl.classList.add("hidden");
    document.getElementById("logout-nav-btn")?.classList.add("hidden");
  }
}

export function showResultFeedback(feedback, requestMoreHandler) {
  initializeElements();
  if (!els.reviewScreen) return;
  let container = document.getElementById("result-feedback-container");
  if (container) container.remove();
  container = document.createElement("div");
  container.id = "result-feedback-container";
  container.className = "w-full max-w-3xl mx-auto mt-6 p-5 rounded-lg border border-indigo-100 bg-indigo-50 text-center";
  container.innerHTML = `<h3 class="text-xl font-bold text-indigo-800 mb-2">${feedback.title}</h3><p class="text-gray-700 mb-2">${feedback.message}</p><p class="text-xs text-indigo-600 font-semibold italic mb-4">Mastery unlocked.</p>`;
  if (feedback.percentage >= 90) {
    const btn = document.createElement("button");
    btn.className = "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-full transition shadow-md";
    btn.textContent = "Request Challenging Questions";
    btn.onclick = () => requestMoreHandler(feedback);
    container.appendChild(btn);
  }
  els.reviewScreen.insertBefore(container, els.reviewScreen.querySelector(".flex") || null);
}

export function renderAllQuestionsForReview(questions, userAnswers = {}) {
  initializeElements();
  if (!els.reviewContainer) return;
  const html = questions.map((q, i) => {
    const ca = (q.correct_answer || "").toUpperCase();
    const ua = (userAnswers[q.id] || "").toUpperCase();
    const correct = ua === ca;
    return `
      <div class="mb-5 p-4 bg-white rounded-lg border border-gray-100 shadow-sm animate-fadeIn">
        <p class="font-bold text-base mb-2">Q${i + 1}: ${cleanKatexMarkers(q.text)}</p>
        <p class="text-sm">Your Answer: <span class="${correct ? 'text-green-600' : 'text-red-600'} font-bold">${ua || "No Attempt"}</span></p>
        <p class="text-sm">Correct Answer: <span class="text-green-700 font-bold">${ca}</span></p>
      </div>`;
  }).join("");
  els.reviewContainer.innerHTML = html;
}
