// js/api.js
// Anonymous Supabase reads + Firestore results save

import { getInitializedClients, getAuthUser, logAnalyticsEvent } from "./config.js";
import * as UI from "./ui-renderer.js";
import { cleanKatexMarkers } from "./utils.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function getTableName(topic) {
  return (topic || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .trim();
}

// =============================================================
// FETCH QUESTIONS — FINAL FIXED VERSION
// =============================================================
export async function fetchQuestions(topic, difficulty) {
  const { supabase } = getInitializedClients();
  const table = getTableName(topic);

  // EXACT match with Supabase inserted values
  const diff = (difficulty || "Simple").trim();

  UI.showStatus(`Loading ${table} (${diff})...`);

  // CORRECT SUPABASE FILTER — FULLY FLEXIBLE
  const { data, error } = await supabase
    .from(table)
    .select(
      `
      id,
      question_text,
      question_type,
      scenario_reason_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer_key,
      difficulty
    `
    )
    .or(`difficulty.eq.${diff},difficulty.ilike.*${diff}*`);

  if (error) {
    console.error("❌ SUPABASE ERROR:", error);
    throw new Error(error.message);
  }

  if (!data || !data.length) {
    console.warn("⚠ DEBUG: Supabase returned 0 rows for:", { table, diff, data });
    throw new Error("No questions found.");
  }

  // Normalized mapping
  return data.map((q) => ({
    id: q.id,
    text: cleanKatexMarkers(q.question_text),
    options: {
      A: cleanKatexMarkers(q.option_a),
      B: cleanKatexMarkers(q.option_b),
      C: cleanKatexMarkers(q.option_c),
      D: cleanKatexMarkers(q.option_d)
    },
    correct_answer: q.correct_answer_key.trim().toUpperCase(),
    scenario_reason: cleanKatexMarkers(q.scenario_reason_text || ""),
    question_type: (q.question_type || "").toLowerCase(),
    difficulty: q.difficulty
  }));
}

// =============================================================
// SAVE RESULT (Unchanged)
// =============================================================
export async function saveResult(result) {
  const { db } = getInitializedClients();
  const user = getAuthUser();
  if (!user) return;

  await addDoc(collection(db, "quiz_scores"), {
    user_id: user.uid,
    email: user.email,
    chapter: result.topic,
    difficulty: result.difficulty,
    score: result.score,
    total: result.total,
    percentage: Math.round((result.score / result.total) * 100),
    timestamp: serverTimestamp()
  });

  logAnalyticsEvent("quiz_completed", { ...result, user_id: user.uid });
}
