import { cleanKatexMarkers } from './utils.js';

let els = {};
let isInit = false;

/* -----------------------------------
   UI STYLING CONSTANTS
----------------------------------- */
const OPTION_BASE_CLS =
  "option-label flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 shadow-sm";
const CORRECT_CLS = " border-success-green bg-green-50 shadow-green-100";
const WRONG_CLS = " border-danger-red bg-red-50 shadow-red-100";
const SELECTED_CLS = " border-blue-500 bg-blue-50 shadow-blue-100";

/* -----------------------------------
   HELPERS
----------------------------------- */
function splitAssertionReason(text = "") {
  const clean = cleanKatexMarkers(text);
  const parts = clean.split(/Reason\s*\(R\)\s*:/i);
  return {
    assertion: parts[0].replace(/Assertion\s*\(A\)\s*:/i, "").trim(),
    reason: (parts[1] || "").trim()
  };
}

function generateOptionHtml(q, opt, selected, submitted, optionText) {
  const txt = optionText || cleanKatexMarkers(q.options?.[opt] || "");
  const isSel = selected === opt;
  const isCorrect = submitted && q.correct_answer === opt;
  const isWrong = submitted && isSel && !isCorrect;

  const cls = `${OPTION_BASE_CLS}${
    isCorrect ? CORRECT_CLS :
    isWrong ? WRONG_CLS :
    isSel ? SELECTED_CLS :
    " border-gray-100 bg-white hover:border-blue-300"
  }`;

  return `
    <label class="block group">
      <input type="radio" name="q-${q.id}" value="${opt}" class="hidden"
        ${isSel ? "checked" : ""} ${submitted ? "disabled" : ""}>
      <div class="${cls}">
        <span class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 font-bold mr-4">${opt}</span>
        <span class="text-gray-800 font-medium pt-1">${txt}</span>
      </div>
    </label>`;
}

/* -----------------------------------
   INIT
----------------------------------- */
export function initializeElements() {
  if (isInit) return;

  els = {
    diffBadge: document.getElementById("difficulty-display"),
    status: document.getElementById("status-message"),
    list: document.getElementById("question-list"),
    counter: document.getElementById("question-counter"),
    prevButton: document.getElementById("prev-btn"),
    nextButton: document.getElementById("next-btn"),
    submitButton: document.getElementById("submit-btn"),
    reviewScreen: document.getElementById("results-screen"),
    quizContent: document.getElementById("quiz-content"),
    chapterNameDisplay: document.getElementById("chapter-name-display"),
    analysisModal: document.getElementById("analysis-modal"),
    analysisContent: document.getElementById("analysis-content"),
    welcomeUser: document.getElementById("user-welcome"),
    reviewContainer: null
  };

  if (!document.getElementById("review-container") && els.reviewScreen) {
    const rc = document.createElement("div");
    rc.id = "review-container";
    rc.className = "w-full max-w-4xl text-left mt-10 hidden space-y-6";
    els.reviewScreen.appendChild(rc);
    els.reviewContainer = rc;
  }

  isInit = true;
}

/* -----------------------------------
   VIEW CONTROL
----------------------------------- */
export function showView(view) {
  initializeElements();
  [els.quizContent, els.reviewScreen, document.getElementById("paywall-screen")]
    .forEach(v => v?.classList.add("hidden"));

  if (view === "quiz-content") els.quizContent?.classList.remove("hidden");
  if (view === "results-screen") els.reviewScreen?.classList.remove("hidden");
  if (view === "paywall-screen") document.getElementById("paywall-screen")?.classList.remove("hidden");
}

/* -----------------------------------
   STATUS
----------------------------------- */
export function showStatus(msg, cls = "text-blue-600") {
  initializeElements();
  els.status.textContent = msg;
  els.status.className = `text-center p-4 font-bold ${cls}`;
  els.status.classList.remove("hidden");
}

export function hideStatus() {
  els.status?.classList.add("hidden");
}

/* -----------------------------------
   HEADER
----------------------------------- */
export function updateHeader(title, diff) {
  initializeElements();
  els.chapterNameDisplay.textContent = title;
  els.diffBadge.textContent = `Difficulty: ${diff}`;
}

/* -----------------------------------
   AUTH UI
----------------------------------- */
export function updateAuthUI(user) {
  initializeElements();
  if (user && els.welcomeUser) {
    els.welcomeUser.textContent = `Welcome, ${user.email.split("@")[0]}`;
    els.welcomeUser.classList.remove("hidden");
  }
}

/* -----------------------------------
   QUESTION RENDER
----------------------------------- */
export function renderQuestion(q, idx, selected, submitted) {
  initializeElements();
  const type = (q.question_type || "").toLowerCase();

  // ASSERTION–REASON
  if (type.includes("assertion") || type.includes("ar")) {
    const { assertion, reason } = splitAssertionReason(q.text);

    const arOptions = {
      A: "Both A and R are true and R is the correct explanation of A.",
      B: "Both A and R are true but R is not the correct explanation of A.",
      C: "A is true but R is false.",
      D: "A is false but R is true."
    };

    els.list.innerHTML = `
      <div class="space-y-6">
        <div class="text-xl font-black">Q${idx}. Assertion (A): ${assertion}</div>
        <div class="bg-blue-50 p-6 rounded-xl border-l-4 border-cbse-blue">
          <div class="text-xs font-black uppercase mb-2 text-cbse-blue">Reason (R)</div>
          <div class="text-lg font-semibold">${reason}</div>
        </div>
        <div class="grid gap-3">
          ${["A","B","C","D"].map(o =>
            generateOptionHtml(q, o, selected, submitted, arOptions[o])
          ).join("")}
        </div>
      </div>`;
    return;
  }

  // MCQ / CASE
  els.list.innerHTML = `
    <div class="space-y-6">
      <div class="text-xl font-black">Q${idx}: ${cleanKatexMarkers(q.text)}</div>
      <div class="grid gap-3">
        ${["A","B","C","D"].map(o =>
          generateOptionHtml(q, o, selected, submitted)
        ).join("")}
      </div>
    </div>`;
}

/* -----------------------------------
   ANSWER LISTENER
----------------------------------- */
export function attachAnswerListeners(handler) {
  initializeElements();
  els.list.onchange = e => {
    if (e.target.type === "radio") {
      handler(e.target.name.substring(2), e.target.value);
    }
  };
}

/* -----------------------------------
   NAVIGATION
----------------------------------- */
export function updateNavigation(index, total, submitted) {
  els.prevButton.classList.toggle("hidden", index === 0);
  els.nextButton.classList.toggle("hidden", index === total - 1);
  els.submitButton.classList.toggle("hidden", submitted || index !== total - 1);
  els.counter.textContent = `${String(index + 1).padStart(2, "0")} / ${total}`;
}

/* -----------------------------------
   RESULTS + REVIEW
----------------------------------- */
export function renderResults() {
  showView("results-screen");
}

export function renderAllQuestionsForReview(questions, userAnswers) {
  initializeElements();
  els.reviewContainer.classList.remove("hidden");

  els.reviewContainer.innerHTML = questions.map((q, i) => {
    const ua = userAnswers[q.id];
    const ca = q.correct_answer;
    const wrongText = ua ? cleanKatexMarkers(q.options[ua]) : "Not Attempted";
    const correctText = cleanKatexMarkers(q.options[ca]);

    return `
      <div class="p-6 bg-white rounded-xl shadow">
        <p class="font-bold mb-3">Q${i+1}: ${cleanKatexMarkers(q.text)}</p>
        <p class="text-red-600 font-bold">❌ Your Answer: ${wrongText}</p>
        <p class="text-green-700 font-bold">✅ Correct Answer: ${correctText}</p>
        <p class="text-blue-700 text-sm mt-2">
          🧠 Why: The correct option matches the concept tested in this question.
        </p>
      </div>`;
  }).join("");

  els.reviewContainer.scrollIntoView({ behavior: "smooth" });
}
