// js/api.js
// Optimized for high-speed Supabase reads and lazy-loaded Firestore writes

import { getInitializedClients, getAuthUser, logAnalyticsEvent } from "./config.js";

/**
 * Builds the database-friendly table name
 */
function getTableName(topic) {
  return (topic || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .trim();
}

// =============================================================
// FETCH QUESTIONS — OPTIMIZED PAYLOAD
// =============================================================
export async function fetchQuestions(topic, difficulty) {
  const { supabase } = getInitializedClients();
  const table = getTableName(topic);
  
  // Wildcard flexibility for ilike (Case-insensitive matching)
  const diffPattern = `%${(difficulty || "Simple").trim()}%`;

  // Fetch only necessary fields to keep the network response small
  const { data, error } = await supabase
    .from(table)
    .select(`
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
    `)
    .ilike('difficulty', diffPattern);

  if (error) {
    console.error("❌ SUPABASE ERROR:", error);
    throw new Error(error.message);
  }

  if (!data || !data.length) {
    throw new Error(`No questions found matching "${difficulty}" for this chapter.`);
  }

  // Map data to the internal state format
  return data.map((q) => ({
    id: q.id,
    question_text: q.question_text || "",
    question_type: (q.question_type || "").toLowerCase(),
    scenario_reason_text: q.scenario_reason_text || "",
    option_a: q.option_a || "",
    option_b: q.option_b || "",
    option_c: q.option_c || "",
    option_d: q.option_d || "",
    correct_answer_key: (q.correct_answer_key || "").trim().toUpperCase(),
    difficulty: q.difficulty
  }));
}

// =============================================================
// SAVE RESULT — OPTIMIZED VIA DYNAMIC IMPORTS
// =============================================================
export async function saveResult(result) {
  const user = getAuthUser();
  if (!user) return;

  try {
    // Speed Hack: Load Firebase Firestore only when needed
    const { 
      collection, addDoc, serverTimestamp 
    } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
    
    const { db } = getInitializedClients();

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
  } catch (err) {
    console.warn("Save result failed (background task):", err);
  }
}
