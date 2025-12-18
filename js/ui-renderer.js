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
    assertion: parts[0]
      .replace(/Assertion\s*\(A\)\s*:/i, "")
      .trim(),
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
        <span class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 font-bold mr-4">
          ${opt}
        </span>
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
    list: document.getElementById("question-list"),
    counter: document.getElementById("question-counter"),
    prevButton: document.getElementById("prev-btn"),
    nextButton: document.getElementById("next-btn"),
    submitButton: document.getElementById("submit-btn"),
    reviewScreen: document.getElementById("results-screen"),
    quizContent: document.getElementById("quiz-content"),
    reviewContainer: null
  };

  if (!document.getElementById("review-container") && els.reviewScreen) {
    const div = document.createElement("div");
    div.id = "review-container";
    div.className = "w-full max-w-4xl mt-10 space-y-6 hidden";
    els.reviewScreen.appendChild(div);
    els.reviewContainer = div;
  }

  isInit = true;
}

/* -----------------------------------
   RENDER QUESTION
----------------------------------- */
export function renderQuestion(q, index, selected, submitted) {
  initializeElements();
  const type = (q.question_type || "").toLowerCase();

  // ✅ ASSERTION–REASON
  if (type.includes("assertion") || type.includes("ar")) {
    const { assertion, reason } = splitAssertionReason(q.text);

    const arOptions = {
      A: "Both A and R are true and R is the correct explanation of A.",
      B: "Both A and R are true but R is not the correct explanation of A.",
      C: "A is true but R is false.",
      D: "A is false but R is true."
    };

    const optionsHtml = ["A","B","C","D"]
      .map(o => generateOptionHtml(q, o, selected, submitted, arOptions[o]))
      .join("");

    els.list.innerHTML = `
      <div class="space-y-6 text-left">
        <div class="text-xl font-black">Q${index}. Assertion (A): ${assertion}</div>
        <div class="bg-blue-50 p-6 rounded-xl border-l-4 border-cbse-blue">
          <div class="text-xs font-black uppercase mb-2 text-cbse-blue">Reason (R)</div>
          <div class="text-lg font-semibold">${reason}</div>
        </div>
        <div class="grid gap-3">${optionsHtml}</div>
      </div>`;
    return;
  }

  // ✅ MCQ / CASE
  const optionsHtml = ["A","B","C","D"]
    .map(o => generateOptionHtml(q, o, selected, submitted))
    .join("");

  els.list.innerHTML = `
    <div class="space-y-6 text-left">
      <div class="text-xl font-black">Q${index}: ${cleanKatexMarkers(q.text)}</div>
      <div class="grid gap-3">${optionsHtml}</div>
    </div>`;
}

/* -----------------------------------
   REVIEW MY MISTAKES (ENHANCED)
----------------------------------- */
export function renderAllQuestionsForReview(questions, userAnswers = {}) {
  initializeElements();
  if (!els.reviewContainer) return;

  els.reviewContainer.classList.remove("hidden");

  const html = questions.map((q, i) => {
    const uaKey = userAnswers[q.id];
    const caKey = q.correct_answer;
    const isCorrect = uaKey === caKey;

    const uaText = uaKey
      ? cleanKatexMarkers(q.options?.[uaKey] || uaKey)
      : "Not Attempted";
    const caText = cleanKatexMarkers(q.options?.[caKey] || caKey);

    let why = "";
    if (!isCorrect) {
      if (q.question_type?.includes("assertion") || q.question_type?.includes("ar")) {
        why = "The correct option correctly explains the logical link between the Assertion and the Reason.";
      } else if (q.question_type?.includes("case")) {
        why = "The correct option best matches the case context and scientific principle involved.";
      } else {
        why = "The correct option aligns with the fundamental concept tested in this question.";
      }
    }

    return `
      <div class="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <p class="font-black text-gray-800 mb-4 text-lg">
          Q${i + 1}: ${cleanKatexMarkers(q.text)}
        </p>

        ${
          isCorrect
            ? `<div class="inline-block px-4 py-2 rounded-xl bg-green-100 text-green-700 font-bold">
                 ✔ Correctly Answered
               </div>`
            : `
              <div class="space-y-3">
                <div class="px-4 py-3 rounded-xl bg-red-100 text-red-700 font-bold">
                  ❌ Your Answer (${uaKey}): ${uaText}
                </div>
                <div class="px-4 py-3 rounded-xl bg-green-100 text-green-700 font-bold">
                  ✅ Correct Answer (${caKey}): ${caText}
                </div>
                <div class="px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-semibold text-sm border border-blue-100">
                  🧠 Why: ${why}
                </div>
              </div>`
        }
      </div>
    `;
  }).join("");

  els.reviewContainer.innerHTML = `
    <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">
      Review of Mistakes
    </h3>
    ${html}
  `;

  els.reviewContainer.scrollIntoView({ behavior: "smooth" });
}

/* -----------------------------------
   NAVIGATION
----------------------------------- */
export function updateNavigation(index, total, submitted) {
  els.prevButton?.classList.toggle("hidden", index === 0);
  els.nextButton?.classList.toggle("hidden", index === total - 1);
  els.submitButton?.classList.toggle("hidden", submitted || index !== total - 1);
  if (els.counter)
    els.counter.textContent = `${String(index + 1).padStart(2, "0")} / ${total}`;
}
