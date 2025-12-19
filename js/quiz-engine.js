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

function parseUrlParameters() {
    const params = new URLSearchParams(location.search);
    quizState.topicSlug = params.get("table") || params.get("topic") || "";
    quizState.difficulty = params.get("difficulty") || "Simple";
    quizState.classId = params.get("class") || "8"; // Defaults to 8 if missing
    quizState.subject = params.get("subject") || "Science"; // Defaults to Science if missing

    // FIXED: Dynamic Header Slug reconstruction
    const chapterName = quizState.topicSlug
        .replace(/[_\d]/g, " ")
        .replace(/quiz/ig, "")
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
    
    const fullTitle = `Class ${quizState.classId}: ${quizState.subject} - ${chapterName} Worksheet`;
    UI.updateHeader(fullTitle, quizState.difficulty);
}

async function loadQuiz() {
    try {
        UI.showStatus("Preparing worksheet...");
        const rawQuestions = await fetchQuestions(quizState.topicSlug, quizState.difficulty);
        
        quizState.questions = rawQuestions.map(q => {
            let processedText = q.question_text || "";
            let processedReason = "";
            const type = (q.question_type || "").toLowerCase();

            // FIXED: AR String Separation Logic
            // If the database has combined the Assertion and Reason in one field
            if (type.includes("ar") && processedText.includes("Reason (R):")) {
                const parts = processedText.split(/Reason\s*\(R\)\s*:/i);
                processedText = parts[0].trim(); 
                processedReason = parts[1].trim(); 
            } else {
                // Fallback if they are already separate
                processedReason = q.scenario_reason_text || "";
            }

            return {
                id: q.id,
                question_type: type,
                text: processedText,
                scenario_reason: processedReason, 
                correct_answer: (q.correct_answer_key || "").toUpperCase(),
                options: {
                    A: q.option_a || "",
                    B: q.option_b || "",
                    C: q.option_c || "",
                    D: q.option_d || ""
                }
            };
        });

        if (quizState.questions.length > 0) {
            renderQuestion();
            UI.showView("quiz-content");
        } else {
            throw new Error("No questions available for this level.");
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

async function handleSubmit() {
    quizState.isSubmitted = true;
    const stats = {
        total: quizState.questions.length,
        correct: quizState.questions.filter(q => quizState.userAnswers[q.id] === q.correct_answer).length,
        mcq: { c: 0, w: 0, t: 0 },
        ar: { c: 0, w: 0, t: 0 },
        case: { c: 0, w: 0, t: 0 }
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

function attachDomEvents() {
    document.addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn) return;
        if (btn.id === "prev-btn") handleNavigation(-1);
        if (btn.id === "next-btn") handleNavigation(1);
        if (btn.id === "submit-btn") handleSubmit();
        if (btn.id === "btn-review-errors") UI.renderAllQuestionsForReview(quizState.questions, quizState.userAnswers);
    });
}

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
