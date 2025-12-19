import { cleanKatexMarkers } from './utils.js';

let els = {};
let isInit = false;

/* -----------------------------------
   UI STYLING CONSTANTS
----------------------------------- */
const OPTION_BASE_CLS = "option-label flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 shadow-sm";
const CORRECT_CLS = " border-green-600 bg-green-50 shadow-green-100";
const WRONG_CLS = " border-red-600 bg-red-50 shadow-red-100";
const SELECTED_CLS = " border-blue-500 bg-blue-50 shadow-blue-100";

/* -----------------------------------
   INTERNAL HELPERS
----------------------------------- */
function normalizeReasonText(txt) {
  if (!txt || txt === "EMPTY") return "";
  // Removes redundant "Reason (R):" labels to prevent double-labeling
  const pattern = /^\s*(Reasoning|Reason|Context|Assertion|Assertion \(A\)|Reason \(R\))\s*[:\-]\s*/gi;
  return txt.replace(pattern, "").replace(/Reason \(R\):/gi, "").trim();
}

function generateOptionHtml(q, opt, selected, submitted, optionText) {
  const txt = optionText ? optionText : cleanKatexMarkers(q.options[opt] || "");
  const isSel = selected === opt;
  const isCorrect = submitted && q.correct_answer?.toUpperCase() === opt;
  const isWrong = submitted && isSel && !isCorrect;
  const cls = `${OPTION_BASE_CLS}${isCorrect ? CORRECT_CLS : isWrong ? WRONG_CLS : isSel ? SELECTED_CLS : " border-gray-100 bg-white hover:border-blue-300"}`;

  return `
    <label class="block group">
      <input type="radio" name="q-${q.id}" value="${opt}" class="hidden" ${isSel ? "checked" : ""} ${submitted ? "disabled" : ""}>
      <div class="${cls}">
        <span class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-700 font-bold mr-4 group-hover:bg-blue-100 transition-colors">${opt}</span>
        <span class="text-gray-800 font-medium pt-1">${txt}</span>
      </div>
    </label>`;
}

/* -----------------------------------
   CORE EXPORTS
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
    score: document.getElementById("score-display"),
    curiosityBox: document.getElementById("curiosity-box"),
    quizContent: document.getElementById("quiz-content"),
    chapterNameDisplay: document.getElementById("chapter-name-display"),
    analysisModal: document.getElementById("analysis-modal"),
    analysisContent: document.getElementById("analysis-content"),
    welcomeUser: document.getElementById("user-welcome")
  };

  // Safe container injection to avoid Node errors
  if (!document.getElementById("review-container") && els.reviewScreen) {
    const rc = document.createElement("div");
    rc.id = "review-container";
    rc.className = "w-full max-w-4xl text-left mt-10 hidden space-y-8";
    els.reviewScreen.appendChild(rc); 
    els.reviewContainer = rc;
  }
  isInit = true;
}

export function renderQuestion(q, idxOneBased, selected, submitted) {
  initializeElements();
  if (!els.list) return;
  const type = (q.question_type || "").toLowerCase();

  // 1. PROFESSIONAL ASSERTION-REASON LAYOUT
  if (type.includes("ar") || type.includes("assertion") || q.text.toLowerCase().includes("assertion")) {
    const assertion = q.text.replace(/Assertion \(A\):/gi, "").trim();
    const reason = normalizeReasonText(q.scenario_reason);
    const arOptions = {
      A: "Both A and R are true and R is the correct explanation of A.",
      B: "Both A and R are true but R is not the correct explanation of A.",
      C: "A is true but R is false.",
      D: "A is false but R is true.",
    };
    const html = ["A", "B", "C", "D"].map(o => generateOptionHtml(q, o, selected, submitted, arOptions[o])).join("");
    
    els.list.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn text-left">
        <div>
          <div class="text-xl font-extrabold text-gray-900 leading-snug mb-4">Q${idxOneBased}. Assertion (A): ${assertion}</div>
          <div class="bg-blue-50/50 p-6 rounded-2xl border-l-4 border-blue-700 shadow-sm">
            <span class="text-blue-700 font-black uppercase text-[10px] block mb-2 tracking-widest">REASON (R)</span>
            <div class="text-gray-800 leading-relaxed font-semibold text-lg">${reason}</div>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3">${html}</div>
      </div>`;
    return;
  }

  // 2. TWO-PANE CASE BASED LAYOUT
  if (type.includes("case") || (q.scenario_reason && q.scenario_reason !== "EMPTY")) {
    const html = ["A", "B", "C", "D"].map(o => generateOptionHtml(q, o, selected, submitted)).join("");
    els.list.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn text-left">
        <div class="p-6 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner max-h-[60vh] overflow-y-auto">
          <h3 class="font-black mb-4 text-blue-800 uppercase text-xs tracking-widest border-b pb-2">Context / Case Study</h3>
          <p class="text-gray-800 leading-relaxed font-medium">${q.scenario_reason}</p>
        </div>
        <div class="space-y-6">
          <div class="text-xl font-extrabold text-gray-900 leading-snug">Q${idxOneBased}: ${q.text}</div>
          <div class="grid grid-cols-1 gap-3">${html}</div>
        </div>
      </div>`;
    return;
  }

  // 3. STANDARD MCQ
  const html = ["A", "B", "C", "D"].map(o => generateOptionHtml(q, o, selected, submitted)).join("");
  els.list.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-6 text-left animate-fadeIn">
      <div class="text-xl font-extrabold text-gray-900 leading-snug">Q${idxOneBased}: ${q.text}</div>
      <div class="grid grid-cols-1 gap-3">${html}</div>
    </div>`;
}

// FIXED: Review function showing Answer Text (Right/Wrong) for all questions
export function renderAllQuestionsForReview(questions, userAnswers = {}) {
  initializeElements();
  if (!els.reviewContainer) return;
  els.reviewContainer.classList.remove('hidden');
  
  const arLabels = {
    A: "Both A and R are true and R is the correct explanation of A.",
    B: "Both A and R are true but R is not the correct explanation of A.",
    C: "A is true but R is false.",
    D: "A is false but R is true.",
  };

  const html = questions.map((q, i) => {
    const ca = (q.correct_answer || "").toUpperCase();
    const ua = (userAnswers[q.id] || "").toUpperCase();
    const isCorrect = ua === ca;
    const isAR = (q.question_type || "").toLowerCase().includes('ar');

    // Fetch full text for correct/wrong answers
    const correctText = isAR ? arLabels[ca] : (q.options[ca] || ca);
    const userText = ua ? (isAR ? arLabels[ua] : (q.options[ua] || ua)) : "Not Attempted";

    return `
      <div class="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm mb-6">
        <div class="flex items-center gap-3 mb-4">
            <span class="w-8 h-8 rounded-full ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} flex items-center justify-center font-bold text-sm">${i+1}</span>
            <p class="font-black text-gray-900 text-lg">${cleanKatexMarkers(q.text.replace(/Assertion \(A\):/gi, "A:"))}</p>
        </div>
        
        <div class="space-y-3">
          <div class="flex items-start gap-4 p-4 rounded-2xl ${isCorrect ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}">
            <span class="text-[10px] font-black uppercase py-1 px-2 rounded ${isCorrect ? 'bg-green-600' : 'bg-red-600'} text-white mt-1">YOURS</span>
            <p class="font-bold ${isCorrect ? 'text-green-800' : 'text-red-800'}">${cleanKatexMarkers(userText)}</p>
          </div>
          
          ${!isCorrect ? `
          <div class="flex items-start gap-4 p-4 rounded-2xl bg-green-50 border border-green-100">
            <span class="text-[10px] font-black uppercase py-1 px-2 rounded bg-green-600 text-white mt-1">CORRECT</span>
            <p class="font-bold text-green-800">${cleanKatexMarkers(correctText)}</p>
          </div>` : ''}
        </div>
      </div>`;
  }).join("");

  els.reviewContainer.innerHTML = `
    <div class="border-b pb-4 mb-8">
        <h3 class="text-xl font-black text-gray-900 uppercase tracking-tighter">Mistake Analysis & Correction</h3>
        <p class="text-sm text-gray-500 font-medium mt-1">Review your logic against the correct curriculum standards.</p>
    </div>
    ${html}`;
  els.reviewContainer.scrollIntoView({ behavior: 'smooth' });
}

export function renderResults(stats, currentLevel) {
    initializeElements();
    showView("results-screen");
    if (els.score) els.score.textContent = `${stats.correct} / ${stats.total}`;

    const analysisBtn = document.getElementById('btn-show-analysis');
    if (analysisBtn) {
        analysisBtn.onclick = () => {
            const rows = [];
            const categories = [
                { key: 'mcq', label: 'MCQ (Basic Facts)' },
                { key: 'ar', label: 'Assertion-Reason (Logic)' },
                { key: 'case', label: 'Case-Based (Context)' }
            ];
            categories.forEach(cat => {
                const data = stats[cat.key];
                if (data && data.t > 0) {
                    const acc = Math.round((data.c / data.t) * 100);
                    rows.push(`
                        <tr class="border-b border-gray-100">
                            <td class="py-4 font-bold text-gray-700">${cat.label}</td>
                            <td class="text-center font-bold text-green-600">${data.c}</td>
                            <td class="text-center font-bold text-red-500">${data.w}</td>
                            <td class="text-right font-black text-blue-700">${acc}%</td>
                        </tr>`);
                }
            });
            els.analysisContent.innerHTML = `<table class="w-full"><tbody>${rows.join('')}</tbody></table>`;
            els.analysisModal.classList.remove('hidden');
        };
    }
}

export function showStatus(msg, cls = "text-gray-700") {
  initializeElements();
  if (els.status) {
    els.status.innerHTML = msg;
    els.status.className = `p-3 text-center font-semibold ${cls}`;
    els.status.classList.remove("hidden");
  }
}

export function hideStatus() {
  initializeElements();
  if (els.status) els.status.classList.add("hidden");
}

export function updateHeader(t, d) {
  initializeElements();
  if (els.header) els.header.textContent = t;
  if (els.diffBadge) els.diffBadge.textContent = `Difficulty: ${d}`;
}

export function attachAnswerListeners(handler) {
  initializeElements();
  if (!els.list) return;
  els.list.onchange = (e) => { if (e.target?.type === "radio") handler(e.target.name.substring(2), e.target.value); };
}

export function updateNavigation(index, total, submitted) {
  initializeElements();
  const show = (btn, cond) => btn && btn.classList.toggle("hidden", !cond);
  show(els.prevButton, index > 0);
  show(els.nextButton, index < total - 1);
  show(els.submitButton, !submitted && index === total - 1);
  if (els.counter) els.counter.textContent = `${(index + 1).toString().padStart(2, '0')} / ${total}`;
}

export function showView(viewName) {
  initializeElements();
  [els.quizContent, els.reviewScreen, els.paywallScreen].forEach(v => v?.classList.add("hidden"));
  if (viewName === "results-screen") els.reviewScreen?.classList.remove("hidden");
  if (viewName === "quiz-content") els.quizContent?.classList.remove("hidden");
  if (viewName === "paywall-screen") els.paywallScreen?.classList.remove("hidden");
}

export function updateAuthUI(user) {
  initializeElements();
  if (els.welcomeUser && user) {
    els.welcomeUser.textContent = `Welcome, ${user.email.split('@')[0]}`;
    els.welcomeUser.classList.remove("hidden");
  }
}
