import { initializeServices, getAuthUser } from "./config.js";
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import {
  checkAccess, initializeAuthListener,
  signInWithGoogle, signOut
} from "./auth-paywall.js";
import curriculumData from "./curriculum.js";

const CLASS_ID = "8";

/* -----------------------------------
   STATE
----------------------------------- */
let quizState = {
  classId: CLASS_ID,
  subject: "",
  topicSlug: "",
  difficulty: "",
  questions: [],
  currentQuestionIndex: 0,
  userAnswers: {},
  isSubmitted: false
};

/* -----------------------------------
   CURRICULUM LOOKUP
----------------------------------- */
let curriculumLookupMap = null;

function findCurriculumMatch(topicSlug) {
  const clean = s => s?.toLowerCase().replace(/quiz/g, "").replace(/[_\s-]/g, "").trim();
  const target = clean(topicSlug);

  if (!curriculumLookupMap) {
    curriculumLookupMap = new Map();
    for (const subject in curriculumData) {
      const nodes = curriculumData[subject];
      const cats = Array.isArray(nodes) ? { default: nodes } : nodes;
      for (const key in cats) {
        cats[key].forEach(ch => {
          if (ch.table_id) curriculumLookupMap.set(clean(ch.table_id), { subject, title: ch.chapter_title });
          if (ch.chapter_title) curriculumLookupMap.set(clean(ch.chapter_title), { subject, title: ch.chapter_title });
        });
      }
    }
  }
  return curriculumLookupMap.get(target);
}

/* -----------------------------------
   URL PARSE
----------------------------------- */
function parseUrlParameters() {
  const params = new URLSearchParams(location.search);
  quizState.topicSlug = params.get("table") || params.get("topic") || "";
  quizState.difficulty = params.get("difficulty") || "Simple";
  quizState.classId = params.get("class") || CLASS_ID;

  const match = findCurriculumMatch(quizState.topicSlug);
  quizState.subject = match?.subject || "General";
}

/* -----------------------------------
   LOAD QUIZ
----------------------------------- */
async function loadQuiz() {
  const raw = await fetchQuestions(quizState.topicSlug, quizState.difficulty);

  quizState.questions = raw.map(q => ({
    id: q.id,
    question_type: (q.question_type || q.question_text || "").toLowerCase(),
    text: q.question_text || "",
    correct_answer: (q.correct_answer_key || "").toUpperCase(),
    options: {
      A: q.option_a,
      B: q.option_b,
      C: q.option_c,
      D: q.option_d
    }
  }));

  quizState.userAnswers = Object.fromEntries(
    quizState.questions.map(q => [q.id, null])
  );

  renderQuestion();
  UI.showView?.("quiz-content");
}

/* -----------------------------------
   RENDER
----------------------------------- */
function renderQuestion() {
  const i = quizState.currentQuestionIndex;
  const q = quizState.questions[i];
  UI.renderQuestion(q, i + 1, quizState.userAnswers[q.id], quizState.isSubmitted);
  UI.updateNavigation(i, quizState.questions.length, quizState.isSubmitted);
}

/* -----------------------------------
   HANDLERS
----------------------------------- */
function handleAnswer(id, opt) {
  if (!quizState.isSubmitted) {
    quizState.userAnswers[id] = opt;
    renderQuestion();
  }
}

function handleSubmit() {
  quizState.isSubmitted = true;
  UI.renderResults?.({}, quizState.difficulty);
}

/* -----------------------------------
   EVENTS
----------------------------------- */
function attachDomEvents() {
  document.addEventListener("change", e => {
    if (e.target.type === "radio") {
      handleAnswer(e.target.name.substring(2), e.target.value);
    }
  });

  document.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;

    if (b.id === "prev-btn") quizState.currentQuestionIndex--, renderQuestion();
    if (b.id === "next-btn") quizState.currentQuestionIndex++, renderQuestion();
    if (b.id === "submit-btn") handleSubmit();

    if (b.id === "btn-review-errors") {
      UI.renderAllQuestionsForReview(
        quizState.questions,
        quizState.userAnswers
      );
    }

    if (b.id === "google-signin-btn") signInWithGoogle();
    if (b.id === "logout-nav-btn") signOut();
  });
}

/* -----------------------------------
   INIT
----------------------------------- */
async function init() {
  UI.initializeElements();
  parseUrlParameters();
  await initializeServices();
  await initializeAuthListener(async user => {
    if (user && await checkAccess(quizState.topicSlug)) {
      loadQuiz();
    } else {
      UI.showView("paywall-screen");
    }
  });
  attachDomEvents();
}

document.addEventListener("DOMContentLoaded", init);
