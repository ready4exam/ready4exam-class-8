// js/quiz-engine.js
// -----------------------------------------------------------------------------
// UNIVERSAL QUIZ ENGINE (Class 5–12)
// - CLASS_ID auto replaced by automation: 8
// - Clean fallback → Solid State Worksheet (no "quiz", title-cased)
// -----------------------------------------------------------------------------


import { initializeServices, getAuthUser } from "./config.js";
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import {
  checkAccess, initializeAuthListener,
  signInWithGoogle, signOut
} from "./auth-paywall.js";
import curriculumData from "./curriculum.js";


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
// SMART CHAPTER LOOKUP
// ===========================================================
function findCurriculumMatch(topicSlug) {
  const clean = s => s?.toLowerCase().replace(/quiz/g,"").replace(/[_\s-]/g,"").trim();
  const target = clean(topicSlug);

  for (const subject in curriculumData) {
    for (const book in curriculumData[subject]) {
      for (const ch of curriculumData[subject][book]) {
        if (clean(ch.table_id) === target) return {subject, title: ch.chapter_title};
        if (clean(ch.chapter_title)===target) return {subject, title: ch.chapter_title};
      }
    }
  }
  return null;
}


// ===========================================================
// URL + HEADER FORMAT  ⭐ FINAL REQUEST IMPLEMENTED
// ===========================================================
function parseUrlParameters(){
  const params=new URLSearchParams(location.search);
  quizState.topicSlug = params.get("topic") || "";
  quizState.difficulty = params.get("difficulty") || "simple";

  if(!quizState.topicSlug) throw new Error("Topic not provided in URL");

  const match = findCurriculumMatch(quizState.topicSlug);


  // ------------------------------------------------------------------
  //       🔥 NEW — CLEAN TITLE + WORKSHEET → NO "QUIZ" ANYWHERE
  // ------------------------------------------------------------------
  if(!match){
    console.warn(`⚠ Fallback used for: ${quizState.topicSlug}`);

    quizState.subject="General";

    const pretty = quizState.topicSlug
      .replace(/_/g," ")          // solid_state → solid state
      .replace(/quiz/ig,"")       // remove quiz
      .replace(/[0-9]/g,"")       // remove numeric suffixes
      .trim()
      .replace(/\b\w/g,c=>c.toUpperCase()); // → Title Case

    UI.updateHeader(`Class ${CLASS_ID}: ${pretty} Worksheet`, quizState.difficulty);
    return;
  }
  // ------------------------------------------------------------------


  // 📌 Curriculum linked chapter → Final title format
  quizState.subject = match.subject;
  const chapter = match.title.replace(/quiz/ig,"").trim();

  UI.updateHeader(
    `Class ${CLASS_ID}: ${chapter} Worksheet`,
    quizState.difficulty
  );
}


// ===========================================================
// RENDERING + SUBMIT + STORAGE + EVENTS (unchanged)
// ===========================================================
function renderQuestion(){
  const i=quizState.currentQuestionIndex, q=quizState.questions[i];
  if(!q) return UI.showStatus("No question to display.");
  UI.renderQuestion(q, i+1, quizState.userAnswers[q.id], quizState.isSubmitted);
  UI.updateNavigation?.(i,quizState.questions.length,quizState.isSubmitted);
  UI.hideStatus();
}

function handleNavigation(d){
  const i=quizState.currentQuestionIndex+d;
  if(i>=0 && i<quizState.questions.length){ quizState.currentQuestionIndex=i; renderQuestion(); }
}

function handleAnswerSelection(id,opt){
  if(!quizState.isSubmitted){ quizState.userAnswers[id]=opt; renderQuestion(); }
}

async function handleSubmit(){
  if(quizState.isSubmitted) return;
  quizState.isSubmitted=true;

  quizState.score = quizState.questions.filter(q =>
    quizState.userAnswers[q.id]?.toUpperCase() === q.correct_answer?.toUpperCase()
  ).length;

  const user = getAuthUser();
  const result = {
    classId: CLASS_ID,
    subject: quizState.subject,
    topic: quizState.topicSlug,
    difficulty: quizState.difficulty,
    score: quizState.score,
    total: quizState.questions.length,
    user_answers: quizState.userAnswers,
  };

  if(user){ try{ await saveResult(result); }catch(e){console.warn(e);} }

  quizState.currentQuestionIndex=0;
  renderQuestion();
  UI.showResults(quizState.score,quizState.questions.length);
  UI.renderAllQuestionsForReview?.(quizState.questions,quizState.userAnswers);
  UI.updateNavigation?.(0,quizState.questions.length,true);
}

async function loadQuiz(){
  try{
    UI.showStatus("Fetching questions...");
    const q=await fetchQuestions(quizState.topicSlug,quizState.difficulty);
    if(!q?.length) throw new Error("No questions found.");

    quizState.questions=q;
    quizState.userAnswers=Object.fromEntries(q.map(x=>[x.id,null]));

    renderQuestion(); UI.attachAnswerListeners?.(handleAnswerSelection);
    UI.showView?.("quiz-content");
  }catch(e){ UI.showStatus(`Error: ${e.message}`,"text-red-600"); }
}

async function onAuthChange(u){
  const ok = u && await checkAccess(quizState.topicSlug);
  ok ? loadQuiz() : UI.showView("paywall-screen");
}

function attachDomEvents(){
  document.addEventListener("click",e=>{
    const b=e.target.closest("button,a"); if(!b)return;
    if(b.id==="prev-btn")return handleNavigation(-1);
    if(b.id==="next-btn")return handleNavigation(1);
    if(b.id==="submit-btn")return handleSubmit();
    if(["login-btn","google-signin-btn","paywall-login-btn"].includes(b.id))
      return signInWithGoogle();
    if(b.id==="logout-nav-btn")return signOut();
    if(b.id==="back-to-chapters-btn")location.href="chapter-selection.html";
  });
}

async function init(){
  UI.initializeElements(); parseUrlParameters();
  await initializeServices(); await initializeAuthListener(onAuthChange);
  attachDomEvents(); UI.hideStatus();
}

document.addEventListener("DOMContentLoaded", init);
