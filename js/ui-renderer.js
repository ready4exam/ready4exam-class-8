import { cleanKatexMarkers } from './utils.js';

let els = {};
let isInit = false;

/* -----------------------------------
   UI STYLING CONSTANTS
----------------------------------- */
const OPTION_BASE_CLS = "option-label flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 shadow-sm";
const CORRECT_CLS = " border-success-green bg-green-50 shadow-green-100";
const WRONG_CLS = " border-danger-red bg-red-50 shadow-red-100";
const SELECTED_CLS = " border-blue-500 bg-blue-50 shadow-blue-100";

/* -----------------------------------
   INTERNAL HELPERS
----------------------------------- */
function normalizeReasonText(txt) {
  if (!txt) return "";
  const pattern = /^\s*(Reasoning|Reason|Context|Assertion|Assertion \(A\)|Reason \(R\)|Scenario|Suggestion text|Consider the impact of|Consider the)\s*(\(R\)|\(A\))?\s*[:\-]\s*/gi;
  return txt.replace(pattern, "").replace(pattern, "").trim();
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
    btnSimple: document.getElementById("btn-simple"),
    btnMedium: document.getElementById("btn-medium"),
    btnAdvanced: document.getElementById("btn-advanced"),
    welcomeUser: document.getElementById("user-welcome"),
    paywallScreen: document.getElementById("paywall-screen")
  };

  // FIXED: No longer using insertBefore to prevent Node errors
  if (!document.getElementById("review-container") && els.reviewScreen) {
    const rc = document.createElement("div");
    rc.id = "review-container";
    rc.className = "w-full max-w-3xl text-left mt-10 hidden space-y-4";
    els.reviewScreen.appendChild(rc);
    els.reviewContainer = rc;
  }
  isInit = true;
}

/**
 * Professional Result Rendering with Category Analysis
 */
export function renderResults(stats, currentLevel) {
    initializeElements();
    
    // 1. Switch Views
    showView("results-screen");

    // 2. Update Basic Info
    if (els.score) els.score.textContent = `${stats.correct} / ${stats.total}`;

    // 3. Update Tier Buttons (Try Again Logic)
    const tiers = ['Simple', 'Medium', 'Advanced'];
    tiers.forEach(t => {
        const btn = document.getElementById(`btn-${t.toLowerCase()}`);
        if (btn) btn.innerHTML = (currentLevel === t) ? `🔄 ${t} (Try Again)` : `🚀 ${t}`;
    });

    // 4. Update Curiosity Box
    if (els.curiosityBox) {
        if (currentLevel === 'Simple') {
            els.curiosityBox.innerHTML = "<b>Foundation Built!</b> You've mastered the basics. Moving to <b>Medium</b> will now test your cause-and-effect reasoning.";
        } else if (currentLevel === 'Medium') {
            els.curiosityBox.innerHTML = "<b>Excellent Logic!</b> You are analyzing connections well. The <b>Advanced</b> tier awaits with high-stakes Case Studies.";
        } else {
            const mastery = (stats.correct / stats.total) >= 0.9;
            els.curiosityBox.innerHTML = mastery ? 
                "🔥 <b>LEGENDARY MASTERY!</b> You have conquered the peak. Mastery questions are now unlocked below." : 
                "<b>Peak Performance!</b> You are inches away from Mastery. Reach 90% in Advanced to unlock the Elite Bank.";
            if (mastery) document.getElementById('btn-mastery')?.classList.remove('hidden');
        }
    }

    // 5. Setup Cognitive Feedback Modal
    const analysisBtn = document.getElementById('btn-show-analysis');
    if (analysisBtn) {
        analysisBtn.onclick = () => {
            if (!els.analysisModal || !els.analysisContent) return;
            
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
                            <td class="text-center">${data.c}</td>
                            <td class="text-center text-red-500">${data.w}</td>
                            <td class="text-right"><span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold">${acc}%</span></td>
                        </tr>
                    `);
                }
            });

            els.analysisContent.innerHTML = `
                <table class="w-full mb-8">
                    <thead>
                        <tr class="text-xs uppercase text-gray-400 border-b">
                            <th class="text-left pb-2">Category</th>
                            <th class="pb-2">Correct</th>
                            <th class="pb-2">Wrong</th>
                            <th class="text-right pb-2">Accuracy</th>
                        </tr>
                    </thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
                <div class="space-y-4">
                    <div class="p-4 bg-green-50 rounded-2xl border border-green-100">
                        <h4 class="text-xs font-black text-green-700 uppercase mb-1">What is Strong</h4>
                        <p class="text-sm text-green-900 font-medium">${stats.correct/stats.total > 0.7 ? 'Concept Application: You apply theory to practice effectively.' : 'Foundational Recall: Your core definitions are solid.'}</p>
                    </div>
                    <div class="p-4 bg-red-50 rounded-2xl border border-red-100">
                        <h4 class="text-xs font-black text-red-700 uppercase mb-1">Needs Improvement</h4>
                        <p class="text-sm text-red-900 font-medium">${stats.ar.w > stats.mcq.w ? 'Logical Linking: Use the "Because Test" for Assertion-Reason questions.' : 'Fact Precision: Focus on keywords in multiple choice options.'}</p>
                    </div>
                </div>
            `;
            els.analysisModal.classList.remove('hidden');
        };
    }
}

/* -----------------------------------
   STATUS & HEADER UPDATES
----------------------------------- */
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

export function updateHeader(topicDisplayTitle, diff) {
  initializeElements();
  if (els.chapterNameDisplay) els.chapterNameDisplay.textContent = topicDisplayTitle;
  if (els.diffBadge) els.diffBadge.textContent = `Difficulty: ${diff || "--"}`;
}

/* -----------------------------------
   QUESTION RENDERING
----------------------------------- */
export function renderQuestion(q, idxOneBased, selected, submitted) {
  initializeElements();
  if (!els.list) return;
  const type = (q.question_type || "").toLowerCase();

  // Assertion-Reason Template
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
          <div class="text-xl font-extrabold text-gray-900 leading-snug mb-4">Q${idxOneBased}. Assertion (A): ${assertion}</div>
          <div class="bg-blue-50/50 p-5 rounded-2xl border-l-4 border-cbse-blue shadow-sm">
            <span class="text-cbse-blue font-black uppercase text-[10px] block mb-1 tracking-widest">Reason (R)</span>
            <div class="text-gray-800 leading-relaxed font-medium">${reason}</div>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3">${html}</div>
      </div>`;
    return;
  }

  // Standard MCQ Template
  const qText = cleanKatexMarkers(q.text);
  const html = ["A", "B", "C", "D"].map(o => generateOptionHtml(q, o, selected, submitted)).join("");
  els.list.innerHTML = `
    <div class="space-y-6 animate-fadeIn text-left">
      <div class="text-xl font-extrabold text-gray-900 leading-snug">Q${idxOneBased}: ${qText}</div>
      <div class="grid grid-cols-1 gap-3">${html}</div>
    </div>`;
}

/* -----------------------------------
   NAVIGATION & LISTENERS
----------------------------------- */
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

export function renderAllQuestionsForReview(questions, userAnswers = {}) {
  initializeElements();
  if (!els.reviewContainer) return;
  els.reviewContainer.classList.remove('hidden');
  const html = questions.map((q, i) => {
    const ca = (q.correct_answer || "").toUpperCase();
    const ua = (userAnswers[q.id] || "").toUpperCase();
    const isCorrect = ua === ca;
    return `
      <div class="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <p class="font-black text-gray-800 mb-3 text-lg">Q${i + 1}: ${cleanKatexMarkers(q.text)}</p>
        <div class="flex gap-4 text-sm font-bold">
          <span class="px-3 py-1 rounded-lg ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">Your: ${ua || "N/A"}</span>
          <span class="px-3 py-1 rounded-lg bg-gray-100 text-gray-600">Correct: ${ca}</span>
        </div>
      </div>`;
  }).join("");
  els.reviewContainer.innerHTML = `<h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Detailed Question Review</h3>${html}`;
}
