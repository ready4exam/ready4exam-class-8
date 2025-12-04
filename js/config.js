// js/config.js
// Simplified config for Ready4Exam (Class repos) - Supabase ANON only
// Expects window.__firebase_config to be provided in HTML by automation

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { createClient as createSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let supabase = null;
let analyticsInstance = null;

export async function initializeServices() {
  if (firebaseApp && supabase) return { auth: firebaseAuth, db: firebaseDB, supabase };

  const cfg = window.__firebase_config;
  if (!cfg?.apiKey) throw new Error("Firebase config missing");

  // Firebase
  firebaseApp = initializeApp(cfg);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDB = getFirestore(firebaseApp);

  // Supabase ANON CLIENT ONLY
  supabase = createSupabaseClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false }
  });

  window.supabase = supabase; // helpful for debugging

  if (cfg.measurementId) {
    try { analyticsInstance = getAnalytics(firebaseApp) } catch(e) {}
  }

  return { auth: firebaseAuth, db: firebaseDB, supabase };
}

export function getInitializedClients() {
  if (!firebaseApp) throw new Error("Call initializeServices FIRST");
  return { auth: firebaseAuth, db: firebaseDB, supabase };
}

export function getAuthUser() {
  return firebaseAuth.currentUser || null;
}

export function logAnalyticsEvent(evt, data = {}) {
  try { analyticsInstance && logEvent(analyticsInstance, evt, data) } catch(e) {}
}
