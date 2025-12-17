// // js/quiz-engine.js
// -----------------------------------------------------------------------------
// UNIVERSAL QUIZ ENGINE (Class 5–12)
// - CLASS_ID auto replaced by automation: 8
// - Uses difficulty exactly: "Simple" | "Medium" | "Advanced"
// -----------------------------------------------------------------------------

import { initializeServices, getAuthUser } from "./config.js";
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import {
  checkAccess, initializeAuthListener,
  signInWithGoogle, signOut
} from "./auth-paywall.js";
import curriculumData from "./curriculum.js";

/* 🔵 NEW: result feedback helper (ADD ONLY) */
import { getResultFeedback } from "./ui-renderer.js";

// 🔥 Injected at automation time — DO NOT HARD CODE
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
// SMART CHAPTER LOOKUP (Optimized with Map Indexing)
// ===========================================================
let curriculumLookupMap = null;

function findCurriculumMatch(topicSlug) {
  const clean = s =>
    s?.toLowerCase()
      .replace(/quiz/g, "")
      .replace(/[_\s-]/g, "")
      .trim();

  const target = clean(topicSlug);

  // Build index once per session to prevent triple-nested loops on every call
  if (!curriculumLookupMap) {
    curriculumLookupMap = new Map();
    for (const subject in curriculumData) {
      for (const book in curriculumData[subject]) {
        for (const ch of curriculumData[subject][book]) {
          const val = { subject, title: ch.chapter_title };
          // Index by both table_id and title to ensure a match
          if (ch.table_id) curriculumLookupMap.set(clean(ch.table_id), val);
          if (ch.chapter_title) curriculumLookupMap.set(clean(ch.chapter_title), val);
        }
      }
    }
  }

  return curriculumLookupMap.get(target) || null;
}

// ===========================================================
// URL + HEADER FORMAT
// ===========================================================
function parseUrlParameters() {
  const params = new URLSearchParams(location.search);

  const urlClass    = params.get("class")    || CLASS_ID;
  const urlSubject  = params.get("subject") || "";
  const urlBook     = params.get("book")     || null;
  const urlChapter  = params.get("chapter") || "";
  const urlTable    = params.get("table")    || params.get("topic") || "";
  let   urlDiff     = params.get("difficulty") || "Simple";

  const allowed = ["Simple","Medium","Advanced"];
  if (!allowed.includes(urlDiff)) urlDiff = "Simple";

  quizState.classId   = urlClass;
  quizState.subject   = urlSubject;
  quizState.topicSlug = urlTable;
  quizState.difficulty = urlDiff;

  if (!quizState.topicSlug) {
    throw new Error("Topic/table not provided in URL");
  }

  if (urlSubject && urlChapter) {
    const headerTitle =
      `Class ${quizState.classId}: ${urlSubject.trim()} - ${urlChapter.trim()} Worksheet`;
    UI.updateHeader(headerTitle, quizState.difficulty);
    return;
  }

  const match = findCurriculumMatch(quizState.topicSlug);

  if (!match) {
    quizState.subject = "General";
    const pretty = quizState.topicSlug
      .replace(/_/g, " ")
      .replace(/quiz/ig, "")
      .replace(/[0-9]/g, "")
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase());

    UI.updateHeader(
      `Class ${quizState.classId}: ${pretty} Worksheet`,
      quizState.difficulty
    );
    return;
  }

  quizState.subject = match.subject;
  UI.updateHeader(
    `Class ${quizState.classId}: ${quizState.subject} - ${match.title.replace(/quiz/ig, "").trim()} Worksheet`,
    quizState.difficulty
  );
}

// ===========================================================
// 🔥 NEW: EVENT DECOUPLING (Rule 5)
// ===========================================================
/**
 * Handles the "Request More Questions" button click event.
 * @param {object} context - Context containing difficulty, percentage, etc. from feedback.
 */
function handleRequestMore(context) {
  const user = getAuthUser();

  const eventData = {
    event: "requestMoreQuestions",
    timestamp: new Date().toISOString(),
    payload: {
      classId: quizState.classId,
      subject: quizState.subject,
      topic: quizState.topicSlug,
      difficulty: quizState.difficulty,
      percentage: context.percentage,
      userEmail: user?.email || "anonymous",
      userId: user?.uid || null
    }
  };

  console.log("🔥 Event Fired:", eventData);
  
  const customEvent = new CustomEvent('quizEngineEvent', { detail: eventData });
  document.dispatchEvent(customEvent);

  UI.showStatus("Request submitted! You will be notified when new questions are ready.", "text-green-700");
}


// ===========================================================
// RENDERING + SUBMIT + STORAGE + EVENTS
// ===========================================================
function renderQuestion() {
  const i = quizState.currentQuestionIndex;
  const q = quizState.questions[i];
  if (!q) return UI.showStatus("No question to display.");

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
    quizState.userAnswers[q.id]?.toUpperCase() === q.correct_answer?.toUpperCase()
  ).length;

  const user = getAuthUser();
  const result = {
    classId: quizState.classId,
    subject: quizState.subject,
    topic: quizState.topicSlug,
    difficulty: quizState.difficulty,
    score: quizState.score,
    total: quizState.questions.length,
    user_answers: quizState.userAnswers,
  };

  if (user) {
    try {
      await saveResult(result);
    } catch (e) {
      console.warn(e);
    }
  }

  quizState.currentQuestionIndex = 0;
  renderQuestion();

  const feedback = getResultFeedback({
    score: quizState.score,
    total: quizState.questions.length,
    difficulty: quizState.difficulty,
  });

  UI.showResults(quizState.score, quizState.questions.length);
  UI.showResultFeedback?.(feedback, handleRequestMore); 

  UI.renderAllQuestionsForReview?.(
    quizState.questions,
    quizState.userAnswers
  );

  UI.updateNavigation?.(0, quizState.questions.length, true);
}

async function loadQuiz() {
  try {
    UI.showStatus("Fetching questions...");

    const q = await fetchQuestions(quizState.topicSlug, quizState.difficulty);
    if (!q?.length) throw new Error("No questions found.");

    quizState.questions   = q;
    quizState.userAnswers = Object.fromEntries(q.map(x => [x.id, null]));

    renderQuestion();
    UI.attachAnswerListeners?.(handleAnswerSelection);
    UI.showView?.("quiz-content");
  } catch (e) {
    UI.showStatus(`Error: ${e.message}`, "text-red-600");
  }
}

async function onAuthChange(user) {
  UI.updateAuthUI?.(user);

  const ok = user && await checkAccess(quizState.topicSlug);
  if (ok) {
    loadQuiz();
  } else {
    UI.showView("paywall-screen");
  }
}

function attachDomEvents() {
  document.addEventListener("click", e => {
    const b = e.target.closest("button,a");
    if (!b) return;

    if (b.id === "prev-btn")   return handleNavigation(-1);
    if (b.id === "next-btn")   return handleNavigation(1);
    if (b.id === "submit-btn") return handleSubmit();

    if (["login-btn","google-signin-btn","paywall-login-btn"].includes(b.id))
      return signInWithGoogle();

    if (b.id === "logout-nav-btn") return signOut();

    if (b.id === "back-to-chapters-btn") {
      if (quizState.subject) {
        location.href = `chapter-selection.html?subject=${quizState.subject}`;
      } else {
        location.href = "chapter-selection.html";
      }
    }
  });
}

async function init() {
  UI.initializeElements();
  parseUrlParameters();
  await initializeServices();
  await initializeAuthListener(onAuthChange);
  attachDomEvents();
  UI.hideStatus();
}

document.addEventListener("DOMContentLoaded", init);
