// firebaseSwitcher.js
// -----------------------------------------------------------------------------
// FINAL VERSION (No Switching, No Class-9 Leakage, No Cross-Project Override)
// Always loads ONE Firebase project for the entire quiz engine.
// -----------------------------------------------------------------------------

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// -----------------------------------------------------------------------------
// 🔥 IMPORTANT — INSERT YOUR MAIN FIREBASE PROJECT HERE
// This is the ONLY Firebase project the quiz engine will use.
// -----------------------------------------------------------------------------

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCFkuTUao-HGQhX438cVOUvUiS3kT2m7Os",
  authDomain: "eleventhexam-f0fab.firebaseapp.com",
  projectId: "eleventhexam-f0fab",
  storageBucket: "eleventhexam-f0fab.firebasestorage.app",
  messagingSenderId: "192315627607",
  appId: "1:192315627607:web:9f2e2794dc42aaa3352b12",
  measurementId: "G-3GXX6VXYT1"
};

// -----------------------------------------------------------------------------
// Internal reference
// -----------------------------------------------------------------------------
let firebaseClients = null;

// -----------------------------------------------------------------------------
// Initialize Firebase (only once)
// -----------------------------------------------------------------------------
export function initFirebase() {
  try {
    if (!firebaseClients) {
      const existing = getApps()[0];
      const app = existing || initializeApp(FIREBASE_CONFIG);

      const auth = getAuth(app);
      const db = getFirestore(app);

      firebaseClients = { app, auth, db };
      console.log("[firebaseSwitcher] Firebase initialized (single project).");
    }
    return firebaseClients;
  } catch (err) {
    console.error("[firebaseSwitcher] Initialization failed:", err.message);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Export getter
// -----------------------------------------------------------------------------
export function getFirebaseClients() {
  return firebaseClients || initFirebase();
}
