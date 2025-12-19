import { initializeServices, getAuthUser } from "./config.js"; 
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import { checkAccess, initializeAuthListener } from "./auth-paywall.js";

let quizState = {
    classId: "",
    subject: "",
    topicSlug: "",
    difficulty: "",
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: {},
    isSubmitted: false
};

/**
 * Parses URL parameters to set quiz state and cleans the header slug.
 */
function parseUrlParameters() {
    const params = new URLSearchParams(location.search);
    quizState.topicSlug = params.get("table") || params.get("topic") || "";
    quizState.difficulty = params.get("difficulty") || "Simple";
    quizState.classId = params.get("class") || "11";
    quizState.subject = params.get("subject") || "Physics";

    // FIXED: Capture entire chapter name and prevent Subject repetition in Header
    let chapterPart = quizState.topicSlug.replace(/[_\d]/g, " ").replace(/quiz/ig, "").trim();
    
    // Deduplicate: Remove subject from the start if it repeats (e.g., "Physics Physics")
    const subjectRegex = new RegExp(`^${quizState.subject}\\s*`, 'i');
    chapterPart = chapterPart.replace(subjectRegex, "").trim();
    const cleanName = chapterPart.replace(/\b\w/g, c => c.toUpperCase());
    
    const fullTitle = `Class ${quizState.classId}: ${quizState.subject} - ${cleanName} Worksheet`;
    UI.updateHeader(fullTitle, quizState.difficulty);
}

/**
 * Fetches data and handles complex AR string separation for specific database tables.
 */
async function loadQuiz() {
    try {
        UI.showStatus("Preparing worksheet...", "text-blue-600 font-bold");
        const rawQuestions = await fetchQuestions(quizState.topicSlug, quizState.difficulty);
        
        quizState.questions = rawQuestions.map(q => {
            let processedText = q.question_text || "";
            let processedReason = q.scenario_reason_text || "";
            const type = (q.question_type || "").toLowerCase();

            // FIXED: Handle Assertion and Reason separation across multiple fields
            if (type.includes("ar") || type.includes("assertion")) {
                // Check if combined in scenario_reason_text
                if (processedReason.includes("Assertion (A):") && processedReason.includes("Reason (R):")) {
                    const parts = processedReason.split(/Reason\s*\(R\)\s*:/i);
                    processedText = parts[0].replace(/Assertion\s*\(A\)\s*:/i, "").trim();
                    processedReason = parts[1].trim();
                } 
                // Check if combined in question_text
                else if (processedText.includes("Reason (R):")) {
                    const parts = processedText.split(/Reason\s*\(R\)\s*:/i);
                    processedText = parts[0].trim();
                    processedReason = parts[1].trim();
                }
            }

            return {
                id: q.id,
                question_type: type,
                text: processedText,
                scenario_reason: processedReason, 
                correct_answer: (q.correct_answer_key || "").toUpperCase(),
                options: { 
                    A: q.option_a || "", B: q.option_b || "", 
                    C: q.option_c || "", D: q.option_d || "" 
                }
            };
        });

        if (quizState.questions.length > 0) {
            UI.hideStatus(); // Clears "Preparing worksheet..." on load
            renderQuestion();
            UI.showView("quiz-content");
        }
    } catch (e) {
        UI.showStatus(`Error: ${e.message}`, "text-red-600");
    }
}

function renderQuestion() {
    const q = quizState.questions[quizState.currentQuestionIndex];
    UI.renderQuestion(q, quizState.currentQuestionIndex + 1, quizState.userAnswers[q.id], quizState.isSubmitted);
    UI.updateNavigation(quizState.currentQuestionIndex, quizState.questions.length, quizState.isSubmitted);
}

function handleAnswerSelection(id, opt) {
    if (!quizState.isSubmitted) {
        quizState.userAnswers[id] = opt;
        renderQuestion();
    }
}

function handleNavigation(delta) {
    quizState.currentQuestionIndex += delta;
    renderQuestion();
}

/**
 * Calculates category performance for cognitive feedback.
 */
async function handleSubmit() {
    quizState.isSubmitted = true;
    const stats = {
        total: quizState.questions.length,
        correct: quizState.questions.filter(q => quizState.userAnswers[q.id] === q.correct_answer).length,
        mcq: { c: 0, w: 0, t: 0 }, ar: { c: 0, w: 0, t: 0 }, case: { c: 0, w: 0, t: 0 }
    };

    quizState.questions.forEach(q => {
        const type = q.question_type.toLowerCase();
        const isCorrect = quizState.userAnswers[q.id] === q.correct_answer;
        let cat = type.includes('ar') ? 'ar' : type.includes('case') ? 'case' : 'mcq';
        stats[cat].t++;
        isCorrect ? stats[cat].c++ : stats[cat].w++;
    });

    UI.renderResults(stats, quizState.difficulty);
}

/**
 * Event listeners including fixed navigation logic.
 */
function attachDomEvents() {
    document.addEventListener("click", e => {
        const btn = e.target.closest("button, a");
        if (!btn) return;

        if (btn.id === "prev-btn") handleNavigation(-1);
        if (btn.id === "next-btn") handleNavigation(1);
        if (btn.id === "submit-btn") handleSubmit();
        if (btn.id === "btn-review-errors") UI.renderAllQuestionsForReview(quizState.questions, quizState.userAnswers);
        
        // FIXED: Reliable Back to Chapter Selection
        if (btn.id === "back-to-chapters-btn") {
            const subject = quizState.subject || "Physics";
            window.location.href = `chapter-selection.html?subject=${encodeURIComponent(subject)}`;
        }
    });
}

/**
 * App Lifecycle Initialization
 */
async function init() {
  UI.initializeElements();
  parseUrlParameters();
  attachDomEvents();
  UI.attachAnswerListeners(handleAnswerSelection);
  
  await initializeServices(); 
  await initializeAuthListener(user => {
      if (user) loadQuiz();
      else UI.showView("paywall-screen");
  });
}

document.addEventListener("DOMContentLoaded", init);
