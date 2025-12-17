// js/quiz-engine.js
// -----------------------------------------------------------------------------
// UNIVERSAL QUIZ ENGINE (Class 5–12)
// - Optimized for high-speed chapter matching and data processing
// -----------------------------------------------------------------------------

import { initializeServices, getAuthUser } from "./config.js";
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import {
  checkAccess, initializeAuthListener,
  signInWithGoogle, signOut
} from "./auth-paywall.js";
import curriculumData from "./curriculum.js";
import { getResultFeedback } from "./ui-renderer.js";

const CLASS_ID = "8";

// ===========================================================
// STATE
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
// SPEED HACK 1: SMART CHAPTER LOOKUP (Map Indexing)
// ===========================================================
let curriculumLookupMap = null;

function findCurriculumMatch(topicSlug) {
  const clean = s => s?.toLowerCase().replace(/quiz/g, "").replace(/[_\s-]/g, "").trim();
  const target = clean(topicSlug);

  // Index the curriculum only once per session
  if (!curriculumLookupMap) {
    curriculumLookupMap = new Map();
    for (const subject in curriculumData) {
      for (const unit in curriculumData[subject]) {
        for (const ch of curriculumData[subject][unit]) {
          const val = { subject, title: ch.chapter_title };
          // Index by both ID and Title for 100% match rate
          if (ch.table_id) curriculumLookupMap.set(clean(ch.table_id), val);
          if (ch.chapter_title) curriculumLookupMap.set(clean(ch.chapter_title), val);
        }
      }
    }
  }
  // Instant O(1) lookup
  return curriculumLookupMap.get(target) || null;
}

// ===========================================================
// URL + HEADER FORMAT
// ===========================================================
function parseUrlParameters() {
  const params = new URLSearchParams(location.search);
  const urlTable = params.get("table") || params.get("topic") || "";
  let urlDiff = params.get("difficulty") || "Simple";

  if (!["Simple","Medium","Advanced"].includes(urlDiff)) urlDiff = "Simple";

  quizState.classId = params.get("class") || CLASS_ID;
  quizState.topicSlug = urlTable;
  quizState.difficulty = urlDiff;

  if (!quizState.topicSlug) throw new Error("Topic not provided");

  const match = findCurriculumMatch(quizState.topicSlug);
  if (match) {
    quizState.subject = match.subject;
    UI.updateHeader(`Class ${quizState.classId}: ${quizState.subject} - ${match.title.replace(/quiz/ig, "").trim()} Worksheet`, quizState.difficulty);
  } else {
    quizState.subject = "General";
    const pretty = quizState.topicSlug.replace(/[_\d]/g, " ").replace(/quiz/ig, "").trim().replace(/\b\w/g, c => c.toUpperCase());
    UI.updateHeader(`Class ${quizState.classId}: ${pretty} Worksheet`, quizState.difficulty);
  }
}

// ===========================================================
// SPEED HACK 2: OPTIMIZED LOADING (Pre-processing)
// ===========================================================
async function loadQuiz() {
  try {
    UI.showStatus("Fetching questions...");
    
    // Step 1: Network Request
    const rawQuestions = await fetchQuestions(quizState.topicSlug, quizState.difficulty);
    if (!rawQuestions?.length) throw new Error("No questions found.");

    // Step 2: Immediate Data Normalization (Prevents lag during quiz navigation)
    quizState.questions = rawQuestions.map(q => ({
      id: q.id,
      question_type: (q.question_type || q.type || "").toLowerCase(),
      text: q.text || q.question_text || q.prompt || "",
      scenario_reason: q.scenario_reason || q.scenario_reason_text || q.context || "",
      explanation: q.explanation || q.explanation_text || q.reason || "",
      correct_answer: (q.correct_answer || q.correct_answer_key || q.answer || "").toUpperCase(),
      options: {
        A: q.options?.A || q.option_a || "",
        B: q.options?.B || q.option_b || "",
        C: q.options?.C || q.option_c || "",
        D: q.options?.D || q.option_d || ""
      }
    }));

    quizState.userAnswers = Object.fromEntries(quizState.questions.map(x => [x.id, null]));
    
    // Step 3: Instant Render
    renderQuestion();
    UI.attachAnswerListeners?.(handleAnswerSelection);
    UI.showView?.("quiz-content");
  } catch (e) {
    UI.showStatus(`Error: ${e.message}`, "text-red-600");
  }
}

// ===========================================================
// CORE ENGINE FUNCTIONS
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

  quizState.score = quizState.questions.filter(q => 
    quizState.userAnswers[q.id]?.toUpperCase() === q.correct_answer
  ).length;

  const user = getAuthUser();
  if (user) {
    saveResult({
      classId: quizState.classId, subject: quizState.subject,
      topic: quizState.topicSlug, difficulty: quizState.difficulty,
      score: quizState.score, total: quizState.questions.length,
      user_answers: quizState.userAnswers
    }).catch(console.warn);
  }

  const feedback = getResultFeedback({ score: quizState.score, total: quizState.questions.length, difficulty: quizState.difficulty });
  UI.showResults(quizState.score, quizState.questions.length);
  UI.showResultFeedback?.(feedback, context => {
    const eventData = {
      event: "requestMoreQuestions",
      timestamp: new Date().toISOString(),
      payload: { ...context, classId: quizState.classId, topic: quizState.topicSlug }
    };
    document.dispatchEvent(new CustomEvent('quizEngineEvent', { detail: eventData }));
    UI.showStatus("Request submitted!", "text-green-700");
  });
  UI.renderAllQuestionsForReview?.(quizState.questions, quizState.userAnswers);
}

// ===========================================================
// INITIALIZATION
// ===========================================================
async function onAuthChange(user) {
  UI.updateAuthUI?.(user);
  const ok = user && await checkAccess(quizState.topicSlug);
  if (ok) loadQuiz();
  else UI.showView("paywall-screen");
}

function attachDomEvents() {
  document.addEventListener("click", e => {
    const b = e.target.closest("button,a");
    if (!b) return;
    if (b.id === "prev-btn") return handleNavigation(-1);
    if (b.id === "next-btn") return handleNavigation(1);
    if (b.id === "submit-btn") return handleSubmit();
    if (["login-btn","google-signin-btn","paywall-login-btn"].includes(b.id)) return signInWithGoogle();
    if (b.id === "logout-nav-btn") return signOut();
    if (b.id === "back-to-chapters-btn") {
      location.href = quizState.subject ? `chapter-selection.html?subject=${quizState.subject}` : "chapter-selection.html";
    }
  });
}

async function init() {
  UI.initializeElements();
  parseUrlParameters();
  await initializeServices();
  await initializeAuthListener(onAuthChange);
  attachDomEvents();
}

document.addEventListener("DOMContentLoaded", init);
