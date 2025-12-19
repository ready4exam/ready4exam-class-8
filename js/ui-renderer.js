import { cleanKatexMarkers } from './utils.js';

let els = {};
const AR_LABELS = {
    A: "Both A and R are true and R is the correct explanation of A.",
    B: "Both A and R are true but R is not the correct explanation of A.",
    C: "A is true but R is false.",
    D: "A is false but R is true."
};

/* -----------------------------------
   INITIALIZE DOM ELEMENTS
----------------------------------- */
export function initializeElements() {
    els = {
        list: document.getElementById("question-list"),
        header: document.getElementById("chapter-name-display"),
        diff: document.getElementById("difficulty-display"),
        status: document.getElementById("status-message"),
        quiz: document.getElementById("quiz-content"),
        results: document.getElementById("results-screen"),
        paywall: document.getElementById("paywall-screen"),
        prev: document.getElementById("prev-btn"),
        next: document.getElementById("next-btn"),
        submit: document.getElementById("submit-btn"),
        counter: document.getElementById("question-counter"),
        scoreBox: document.getElementById("score-display"),
        analysisModal: document.getElementById("analysis-modal"),
        analysisContent: document.getElementById("analysis-content")
    };

    // Initialize Review Container safely
    if (!document.getElementById("review-container") && els.results) {
        const rc = document.createElement("div");
        rc.id = "review-container";
        rc.className = "w-full max-w-4xl text-left mt-10 hidden space-y-6";
        els.results.appendChild(rc);
        els.reviewContainer = rc;
    }
}

/* -----------------------------------
   OPTION HTML GENERATOR
----------------------------------- */
function generateOptionHtml(q, opt, selected, submitted, labelText) {
    const text = labelText || q.options[opt] || "";
    const isSel = selected === opt;
    const isCorrect = submitted && q.correct_answer === opt;
    const isWrong = submitted && isSel && !isCorrect;
    
    const borderCls = isCorrect ? "border-green-600 bg-green-50 shadow-green-100" : 
                      isWrong ? "border-red-600 bg-red-50 shadow-red-100" : 
                      selected === opt ? "border-blue-500 bg-blue-50 shadow-blue-100" : 
                      "border-gray-100 bg-white hover:border-blue-300";

    return `
        <label class="block cursor-pointer group">
            <input type="radio" name="q-${q.id}" value="${opt}" class="hidden" ${submitted ? 'disabled' : ''}>
            <div class="flex items-start p-4 border-2 rounded-xl transition-all ${borderCls}">
                <span class="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-100 text-gray-700 font-bold mr-4 group-hover:bg-blue-100">${opt}</span>
                <span class="font-medium pt-1 text-gray-800 leading-snug">${cleanKatexMarkers(text)}</span>
            </div>
        </label>`;
}

/* -----------------------------------
   MAIN QUESTION RENDERER
----------------------------------- */
export function renderQuestion(q, idx, selected, submitted) {
    const type = (q.question_type || "").toLowerCase();

    // 1. PROFESSIONAL AR LAYOUT
    if (type.includes("ar") || type.includes("assertion")) {
        const assertion = q.text.replace(/Assertion\s*\(A\)\s*:/gi, "").trim();
        
        els.list.innerHTML = `
            <div class="space-y-6 text-left animate-fadeIn">
                <div class="text-xl font-extrabold text-gray-900 leading-snug">
                    Q${idx}. Assertion (A): ${assertion}
                    <div class="text-sm font-bold text-blue-600 mt-2 italic">Regarding the assertion and reason, choose the correct option.</div>
                </div>
                <div class="bg-blue-50 p-6 rounded-2xl border-l-4 border-blue-600 shadow-sm">
                    <span class="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 block">Reason (R)</span>
                    <div class="text-lg font-semibold text-gray-800 leading-relaxed">${q.scenario_reason}</div>
                </div>
                <div class="grid gap-3">
                    ${['A','B','C','D'].map(o => generateOptionHtml(q, o, selected, submitted, AR_LABELS[o])).join("")}
                </div>
            </div>`;
        return;
    }

    // 2. CASE STUDY HINT LAYOUT
    // Re-ordered: Question on LEFT, Study Hint on RIGHT
    if (type.includes("case")) {
        els.list.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-left animate-fadeIn">
                <div class="space-y-6 order-2 md:order-1">
                    <div class="text-xl font-extrabold text-gray-900 leading-snug">Q${idx}: ${q.text}</div>
                    <div class="grid gap-3">
                        ${['A','B','C','D'].map(o => generateOptionHtml(q, o, selected, submitted)).join("")}
                    </div>
                </div>
                <div class="p-6 bg-yellow-50 rounded-2xl border border-yellow-100 shadow-inner order-1 md:order-2 h-fit">
                    <h3 class="font-black mb-3 text-yellow-700 uppercase text-xs tracking-widest border-b border-yellow-200 pb-2">💡 Study Hint</h3>
                    <p class="text-yellow-900 leading-relaxed font-medium italic">${q.scenario_reason}</p>
                </div>
            </div>`;
        return;
    }

    // 3. STANDARD MCQ
    els.list.innerHTML = `
        <div class="max-w-3xl mx-auto space-y-6 text-left animate-fadeIn">
            <div class="text-xl font-extrabold text-gray-900 leading-snug">Q${idx}: ${cleanKatexMarkers(q.text)}</div>
            <div class="grid gap-3">
                ${['A','B','C', 'D'].map(o => generateOptionHtml(q, o, selected, submitted)).join("")}
            </div>
        </div>`;
}

/* -----------------------------------
   RESULTS & ANALYSIS
----------------------------------- */
export function renderResults(stats, diff) {
    showView("results-screen");
    if (els.scoreBox) els.scoreBox.textContent = `${stats.correct} / ${stats.total}`;

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
            if (els.analysisContent) {
                els.analysisContent.innerHTML = `<table class="w-full"><tbody>${rows.join('')}</tbody></table>`;
                els.analysisModal?.classList.remove('hidden');
            }
        };
    }
}

/* -----------------------------------
   MISTAKE REVIEW SECTION
----------------------------------- */
export function renderAllQuestionsForReview(qs, ua) {
    if (!els.reviewContainer) return;
    els.reviewContainer.classList.remove("hidden");

    els.reviewContainer.innerHTML = `
        <div class="border-b pb-4 mb-8">
            <h3 class="text-xl font-black text-gray-900 uppercase tracking-tighter">Mistake Analysis & Correction</h3>
        </div>` + 
    qs.map((q, i) => {
        const userChoice = ua[q.id];
        const correctChoice = q.correct_answer;
        const isCorrect = userChoice === correctChoice;
        const isAR = q.question_type.toLowerCase().includes('ar');
        
        const userText = userChoice ? (isAR ? AR_LABELS[userChoice] : q.options[userChoice]) : "Not Attempted";
        const correctText = isAR ? AR_LABELS[correctChoice] : q.options[correctChoice];
        
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
    els.reviewContainer.scrollIntoView({ behavior: "smooth" });
}

/* -----------------------------------
   UTILITY UI UPDATES
----------------------------------- */
export function updateHeader(t, d) { 
    if (els.header) els.header.textContent = t; 
    if (els.diff) els.diff.textContent = `Difficulty: ${d}`; 
}

export function showView(v) { 
    [els.quiz, els.results, els.paywall].forEach(x => x?.classList.add("hidden")); 
    if (v === "quiz-content") els.quiz?.classList.remove("hidden"); 
    if (v === "results-screen") els.results?.classList.remove("hidden"); 
    if (v === "paywall-screen") els.paywall?.classList.remove("hidden"); 
}

export function showStatus(msg, cls = "text-blue-600") { 
    if (els.status) {
        els.status.textContent = msg; 
        els.status.className = `p-4 font-bold ${cls}`; 
        els.status.classList.remove("hidden"); 
    }
}

export function updateNavigation(i, t, s) { 
    els.prev?.classList.toggle("hidden", i === 0); 
    els.next?.classList.toggle("hidden", i === t - 1); 
    els.submit?.classList.toggle("hidden", s || i !== t - 1); 
    if (els.counter) els.counter.textContent = `${String(i + 1).padStart(2, "0")} / ${t}`; 
}

export function attachAnswerListeners(fn) { 
    if (els.list) {
        els.list.onchange = e => { 
            if (e.target.type === "radio") fn(e.target.name.substring(2), e.target.value); 
        }; 
    }
}

export function updateAuthUI(user) {
    if (els.welcomeUser && user) {
        els.welcomeUser.textContent = `Welcome, ${user.email.split('@')[0]}`;
        els.welcomeUser.classList.remove("hidden");
    }
}
