// template/js/quiz-engine.js
import { initializeServices } from "./config.js"; 
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import { initializeAuthListener, requireAuth } from "./auth-paywall.js";
import { checkClassAccess } from "./firebase-expiry.js";

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

// Global promise to hold question data while Auth is processing
let questionsPromise = null;

/* -----------------------------------
   PARSE URL PARAMETERS (Fully Dynamic)
----------------------------------- */
function parseUrlParameters() {
    const params = new URLSearchParams(location.search);
    quizState.topicSlug = params.get("table") || params.get("topic") || "";
    quizState.difficulty = params.get("difficulty") || "Simple";
    quizState.classId = params.get("class") || "11";
    quizState.subject = params.get("subject") || "Physics";

    // 1. Dynamic Cleanup: Remove underscores/numbers and strip the "quiz" suffix
    let cleanChapter = quizState.topicSlug
        .replace(/[_\d]/g, " ")
        .replace(/quiz/ig, "")
        .trim();

    // 2. Dynamic Subject Stripping: If the slug starts with the subject name, remove it
    const subjectRegex = new RegExp(`^${quizState.subject}\\s*`, "i");
    cleanChapter = cleanChapter.replace(subjectRegex, "").trim();

    // 3. Dynamic Title Casing: Convert "acids bases salts" to "Acids Bases Salts"
    cleanChapter = cleanChapter.replace(/\b\w/g, c => c.toUpperCase());

    // 4. Grammar Refinement: Standardize common chemical/mathematical chapter naming
    cleanChapter = cleanChapter.replace(/And/g, "and"); // keep 'and' lowercase for aesthetics
    if (cleanChapter.toLowerCase().includes("acids bases salts")) {
        cleanChapter = "Acid, Bases and Salts";
    }

    // Maintains Final Format: Class 10: Science - Acid, Bases and Salts Worksheet
    const fullTitle = `Class ${quizState.classId}: ${quizState.subject} - ${cleanChapter} Worksheet`;

    UI.updateHeader(fullTitle, quizState.difficulty);
}

/* -----------------------------------
   LOAD QUIZ
----------------------------------- */
async function loadQuiz() {
    try {
        UI.showStatus("Preparing worksheet...", "text-blue-600 font-bold");

        // Wait for the promise that was started in init()
        const processedQuestions = await questionsPromise;
        quizState.questions = processedQuestions;

        if (quizState.questions.length > 0) {
            UI.hideStatus();
            renderQuestion();
            UI.showView("quiz-content");
        }
    } catch (e) {
        UI.showStatus(`Error: ${e.message}`, "text-red-600");
    }
}

/* -----------------------------------
   RENDER QUESTION
----------------------------------- */
function renderQuestion() {
    const q = quizState.questions[quizState.currentQuestionIndex];
    UI.renderQuestion(
        q,
        quizState.currentQuestionIndex + 1,
        quizState.userAnswers[q.id],
        quizState.isSubmitted
    );
    UI.updateNavigation(
        quizState.currentQuestionIndex,
        quizState.questions.length,
        quizState.isSubmitted
    );
}

/* -----------------------------------
   ANSWER HANDLERS
----------------------------------- */
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

/* -----------------------------------
   SUBMIT QUIZ
----------------------------------- */
async function handleSubmit() {
    quizState.isSubmitted = true;

    // Single-pass stats calculation for mobile performance
    const stats = {
        total: quizState.questions.length,
        correct: 0,
        mcq: { c: 0, w: 0, t: 0 },
        ar:  { c: 0, w: 0, t: 0 },
        case:{ c: 0, w: 0, t: 0 }
    };

    quizState.questions.forEach(q => {
        const type = q.question_type.toLowerCase();
        const isCorrect = quizState.userAnswers[q.id] === q.correct_answer;
        const cat = type.includes("ar") ? "ar" : type.includes("case") ? "case" : "mcq";

        stats[cat].t++;
        if (isCorrect) {
            stats.correct++;
            stats[cat].c++;
        } else {
            stats[cat].w++;
        }
    });

    UI.renderResults(stats, quizState.difficulty);
    saveResult({ 
        ...quizState, 
        score: stats.correct, 
        total: stats.total,
        topic: quizState.topicSlug 
    });
}

/* -----------------------------------
   DOM EVENTS
----------------------------------- */
function attachDomEvents() {
    document.addEventListener("click", e => {
        const btn = e.target.closest("button, a");
        if (!btn) return;

        if (btn.id === "prev-btn") handleNavigation(-1);
        if (btn.id === "next-btn") handleNavigation(1);
        if (btn.id === "submit-btn") handleSubmit();
        if (btn.id === "btn-review-errors") {
            UI.renderAllQuestionsForReview(quizState.questions, quizState.userAnswers);
        }
        if (btn.id === "back-to-chapters-btn") {
            const subject = quizState.subject || "Physics";
            window.location.href = `chapter-selection.html?subject=${encodeURIComponent(subject)}`;
        }
    });
}

/* -----------------------------------
   GOOGLE LOGIN WIRE
----------------------------------- */
function wireGoogleLogin() {
    const btn = document.getElementById("google-signin-btn");
    if (btn) {
        btn.onclick = async () => {
            await requireAuth();
            location.reload();
        };
    }
}

/* -----------------------------------
   INIT
----------------------------------- */
async function init() {
    // 1. Initial UI Setup
    UI.initializeElements();
    parseUrlParameters();
    attachDomEvents();
    UI.attachAnswerListeners(handleAnswerSelection);

    try {
        // 2. Parallel initialization: Start services first
        await initializeServices();
        
        // 3. Immediately trigger question fetch (Services are now ready)
        questionsPromise = fetchQuestions(quizState.topicSlug, quizState.difficulty);

        wireGoogleLogin();

        // 4. Handle Auth and Access while data fetches in background
        await initializeAuthListener(async user => {
            if (user) {
                const access = await checkClassAccess(quizState.classId, quizState.subject);
                if (access.allowed) {
                    loadQuiz(); 
                } else {
                    alert(access.reason || "Access Restricted.");
                    location.href = "index.html";
                }
            } else {
                UI.showView("paywall-screen");
            }
        });
    } catch (err) {
        console.error("Initialization failed:", err);
        UI.showStatus("System error during startup.", "text-red-600");
    }
}

document.addEventListener("DOMContentLoaded", init);
