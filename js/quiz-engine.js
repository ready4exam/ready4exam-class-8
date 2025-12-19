// -----------------------------------------------------------------------------
// UNIVERSAL QUIZ ENGINE - FULL REPLACEMENT (AR + CASE + MISTAKE REVIEW)
// -----------------------------------------------------------------------------

import { initializeServices, getAuthUser } from "./config.js";
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import {
  checkAccess, initializeAuthListener,
  signInWithGoogle, signOut
} from "./auth-paywall.js";
import curriculumData from "./curriculum.js";

const CLASS_ID = "8";

// ===========================================================
// QUIZ STATE
// ===========================================================
let quizState = {
  classId: CLASS_ID,
  subject: "",
  topicSlug: "",
  difficulty: "",
  questions: [],
  currentQuestionIndex: 0,
  userAnswers: {},
  isSubmitted: false,
  score: 0,
};

// ===========================================================
// CHAPTER & URL LOGIC
// ===========================================================
let curriculumLookupMap = null;

function findCurriculumMatch(topicSlug) {
  const clean = s => s?.toLowerCase().replace(/quiz/g, "").replace(/[_\s-]/g, "").trim();
  const target = clean(topicSlug);

  if (!curriculumLookupMap) {
    curriculumLookupMap = new Map();
    for (const subject in curriculumData) {
      const subjectNode = curriculumData[subject];
      const categories = Array.isArray(subjectNode) ? { "default": subjectNode } : subjectNode;
      for (const key in categories) {
        if (Array.isArray(categories[key])) {
          for (const ch of categories[key]) {
            const val = { subject, title: ch.chapter_title };
            if (ch.table_id) curriculumLookupMap.set(clean(ch.table_id), val);
            if (ch.chapter_title) curriculumLookupMap.set(clean(ch.chapter_title), val);
          }
        }
      }
    }
  }
  return curriculumLookupMap.get(target) || null;
}

function parseUrlParameters() {
  const params = new URLSearchParams(location.search);
  const urlTable = params.get("table") || params.get("topic") || "";
  let urlDiff = params.get("difficulty") || "Simple";
  const urlSubject = params.get("subject");

  if (!["Simple","Medium","Advanced"].includes(urlDiff)) urlDiff = "Simple";

  quizState.classId = params.get("class") || CLASS_ID;
  quizState.topicSlug = urlTable;
  quizState.difficulty = urlDiff;

  const match = findCurriculumMatch(quizState.topicSlug);
  if (match) {
    quizState.subject = urlSubject || match.subject;
    UI.updateHeader(`Class ${quizState.classId}: ${quizState.subject} - ${match.title.replace(/quiz/ig, "").trim()} Worksheet`, quizState.difficulty);
  } else {
    quizState.subject = urlSubject || "General";
    const pretty = quizState.topicSlug.replace(/[_\d]/g, " ").replace(/quiz/ig, "").trim().replace(/\b\w/g, c => c.toUpperCase());
    UI.updateHeader(`Class ${quizState.classId}: ${pretty} Worksheet`, quizState.difficulty);
  }
}

// ===========================================================
// DATA MAPPING (FIXED FOR SUPABASE SCHEMA)
// ===========================================================
async function loadQuiz() {
  try {
    UI.showStatus("Loading your worksheet...");
    const rawQuestions = await fetchQuestions(quizState.topicSlug, quizState.difficulty);
    if (!rawQuestions?.length) throw new Error("No questions found for this level.");

    // Mapping based on your DB columns
    quizState.questions = rawQuestions.map(q => ({
      id: q.id,
      question_type: (q.question_type || "").toLowerCase(),
      text: q.question_text || "", 
      scenario_reason: q.scenario_reason_text || "", 
      correct_answer: (q.correct_answer_key || "").toUpperCase(), 
      options: {
        A: q.option_a || "",
        B: q.option_b || "",
        C: q.option_c || "",
        D: q.option_d || ""
      }
    }));

    quizState.userAnswers = Object.fromEntries(quizState.questions.map(x => [x.id, null]));
    renderQuestion();
    UI.attachAnswerListeners?.(handleAnswerSelection);
    UI.showView?.("quiz-content");
  } catch (e) {
    UI.showStatus(`Error: ${e.message}`, "text-red-600");
  }
}

// ===========================================================
// CORE ENGINE ACTIONS
// ===========================================================
function renderQuestion() {
  const i = quizState.currentQuestionIndex;
  const q = quizState.questions[i];
  if (!q) return;
  UI.renderQuestion(q, i + 1, quizState.userAnswers[q.id], quizState.isSubmitted);
  UI.updateNavigation?.(i, quizState.questions.length, quizState.isSubmitted);
  UI.hideStatus();
}

function handleNavigation(delta) {
  const i = quizState.currentQuestionIndex + delta;
  if (i >= 0 && i < quizState.questions.length) {
    quizState.currentQuestionIndex = i;
    renderQuestion();
  }
}

function handleAnswerSelection(id, opt) {
  if (!quizState.isSubmitted) {
    quizState.userAnswers[id] = opt;
    renderQuestion();
  }
}

async function handleSubmit() {
  if (quizState.isSubmitted) return;
  quizState.isSubmitted = true;

  const stats = {
    total: quizState.questions.length,
    correct: 0,
    mcq: { c: 0, w: 0, t: 0 },
    ar: { c: 0, w: 0, t: 0 },
    case: { c: 0, w: 0, t: 0 }
  };

  quizState.questions.forEach(q => {
    const isCorrect = quizState.userAnswers[q.id]?.toUpperCase() === q.correct_answer;
    const type = q.question_type.toLowerCase();
    
    if (isCorrect) stats.correct++;

    let category = 'mcq';
    if (type.includes('ar') || type.includes('assertion')) category = 'ar';
    else if (type.includes('case')) category = 'case';

    stats[category].t++;
    if (isCorrect) stats[category].c++;
    else stats[category].w++;
  });

  const user = getAuthUser();
  if (user) {
    saveResult({
      classId: quizState.classId, subject: quizState.subject,
      topic: quizState.topicSlug, difficulty: quizState.difficulty,
      score: stats.correct, total: stats.total,
      breakdown: { mcq: stats.mcq, ar: stats.ar, case: stats.case },
      user_answers: quizState.userAnswers
    }).catch(console.warn);
  }

  UI.renderResults(stats, quizState.difficulty);
}

// ===========================================================
// EVENT HANDLING
// ===========================================================
function attachDomEvents() {
  document.addEventListener("click", e => {
    const b = e.target.closest("button,a");
    if (!b) return;

    if (b.id === "prev-btn") return handleNavigation(-1);
    if (b.id === "next-btn") return handleNavigation(1);
    if (b.id === "submit-btn") return handleSubmit();
    
    // Auth
    if (["login-btn","google-signin-btn","paywall-login-btn"].includes(b.id)) return signInWithGoogle();
    if (b.id === "logout-nav-btn") return signOut();
    
    // FIXED: REVIEW MISTAKES SECTION
    if (b.id === "btn-review-errors") {
        UI.renderAllQuestionsForReview(quizState.questions, quizState.userAnswers);
    }

    if (b.id === "back-to-chapters-btn") {
      const subject = quizState.subject || "General";
      window.location.href = `chapter-selection.html?subject=${encodeURIComponent(subject)}`;
    }
  });
}

// ===========================================================
// APP LIFECYCLE
// ===========================================================
async function onAuthChange(user) {
  UI.updateAuthUI?.(user);
  const ok = user && await checkAccess(quizState.topicSlug);
  if (ok) loadQuiz();
  else UI.showView("paywall-screen");
}

async function init() {
  UI.initializeElements();
  parseUrlParameters();
  await initializeServices();
  await initializeAuthListener(onAuthChange);
  attachDomEvents();
}

document.addEventListener("DOMContentLoaded", init);
