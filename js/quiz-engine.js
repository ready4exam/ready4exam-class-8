import { initializeServices, getInitializedClients } from "./config.js"; 
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import { initializeAuthListener, requireAuth } from "./auth-paywall.js";
import { showExpiredPopup } from "./firebase-expiry.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* -----------------------------------
    1. STRICT GATEKEEPER (Security)
----------------------------------- */
export async function checkClassAccess(classId, subject) {
    try {
        const { auth, db } = getInitializedClients(); 
        
        const user = auth.currentUser;
        if (!user) return { allowed: false, reason: "no_user" };

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            return { allowed: false, reason: "no_record" };
        }

        const data = snap.data();
        
        // Admin Bypass - Ensure your current email is included here
        const ADMIN_EMAILS = ["keshav.karn@gmail.com", "ready4urexam@gmail.com"];
        if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
            return { allowed: true };
        }

        // Logic: Check Active Classes
        const paidClasses = data.paidClasses || {};
        const isClassActive = paidClasses[classId.toString()] === true; 
        const lockedClasses = Object.keys(paidClasses).filter(key => paidClasses[key] === true);
        const isLockedToSomething = lockedClasses.length > 0;

        if (isClassActive) {
            return { allowed: true };
        } 
        else if (isLockedToSomething) {
            console.log(`User is locked to Class ${lockedClasses[0]}, but requested Class ${classId}`);
            return { allowed: false, reason: "exclusive_member" };
        } 
        else {
            try {
                // OPTIMIZATION: Auto-lock as a non-blocking background task to remove UI lag
                updateDoc(userRef, {
                    [`paidClasses.${classId}`]: true
                }).catch(err => console.error("Background auto-lock failed:", err));
                
                return { allowed: true };
            } catch (err) {
                console.error("Auto-lock failed:", err);
                return { allowed: false, reason: "write_error" };
            }
        }
    } catch (error) {
        console.error("Access Check Failed:", error);
        return { allowed: false, reason: "error" };
    }
}

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

let questionsPromise = null;

/* -----------------------------------
    2. HEADER & URL PARSING
----------------------------------- */
function parseUrlParameters() {
    const params = new URLSearchParams(location.search);
    
    quizState.difficulty = params.get("difficulty") || "Simple";
    quizState.classId = params.get("class") || "11";
    quizState.subject = params.get("subject") || "Physics";
    quizState.topicSlug = params.get("table") || params.get("topic") || "";

    let displayChapter = params.get("chapter_name");

    if (!displayChapter) {
        displayChapter = quizState.topicSlug
            .replace(/[_-]/g, " ")
            .replace(/quiz|worksheet/ig, "")
            .trim();
            
        const subjectRegex = new RegExp(`^${quizState.subject}\\s*`, "i");
        displayChapter = displayChapter.replace(subjectRegex, "").trim();
    } else {
        displayChapter = decodeURIComponent(displayChapter);
    }

    displayChapter = displayChapter.replace(/\b\w/g, c => c.toUpperCase());
    displayChapter = displayChapter.replace(/\bAnd\b/g, "and"); 

    const fullTitle = `Class ${quizState.classId} : ${quizState.subject} - ${displayChapter} Worksheet`;
    UI.updateHeader(fullTitle, quizState.difficulty);
}

/* -----------------------------------
    3. LOAD QUIZ
----------------------------------- */
async function loadQuiz() {
    try {
        UI.showStatus("Preparing worksheet...", "text-blue-600 font-bold");

        // loadQuiz awaits the promise started during init()
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
    4. RENDER QUESTION
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
    5. ANSWER HANDLERS
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
    6. SUBMIT & RESULTS
----------------------------------- */
async function handleSubmit() {
    quizState.isSubmitted = true;
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
    7. EVENTS
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
    8. INITIALIZATION (Fixed for Optimized Fetch)
----------------------------------- */
async function init() {
    UI.initializeElements();
    parseUrlParameters(); 
    attachDomEvents();
    UI.attachAnswerListeners(handleAnswerSelection);

    try {
        // Step 1: Initialize services first to avoid configuration errors
        await initializeServices(); 

        // Step 2: Parallel fetch starts now that services are ready
        questionsPromise = fetchQuestions(quizState.topicSlug, quizState.difficulty);

        wireGoogleLogin();

        // Step 3: Verify identity and access
        await initializeAuthListener(async user => {
            if (user) {
                UI.updateAuthUI(user);
                const access = await checkClassAccess(quizState.classId, quizState.subject);
                
                if (access.allowed) {
                    await loadQuiz(); 
                } else {
                    UI.hideStatus();
                    UI.showView("paywall-screen"); 
                    showExpiredPopup(access.reason);
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
