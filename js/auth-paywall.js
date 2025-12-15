// js/auth-paywall.js
// -------------------------------------------------------
// Firebase Login Paywall (SAFE MINIMAL PATCH)
// -------------------------------------------------------

import {
  initializeServices,
  getInitializedClients
} from "./config.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut as firebaseSignOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const LOG = "[AUTH]";
let externalCallback = null;

// Admin emails
const ADMIN_EMAILS = ["keshav.karn@gmail.com", "ready4urexam@gmail.com"];

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* ----------------------------------------
   DOM HELPERS
---------------------------------------- */
function findPaywall() {
  return (
    document.querySelector("#paywall-screen") ||
    document.querySelector("#auth-container") ||
    document.querySelector("#signin-card") ||
    document.querySelector(".auth-box") ||
    document.querySelector("#paywall") ||
    document.querySelector(".paywall")
  );
}
function findLoading() {
  return (
    document.querySelector("#auth-loading") ||
    document.querySelector(".auth-loading")
  );
}
function hidePaywall() { const pw = findPaywall(); if (pw) pw.style.display = "none"; }
function showPaywall() { const pw = findPaywall(); if (pw) pw.style.display = "block"; }
function showAuthLoading(msg = "Loading…") {
  const el = findLoading();
  if (el) { el.textContent = msg; el.style.display = "block"; }
}
function hideAuthLoading() {
  const el = findLoading();
  if (el) el.style.display = "none";
}

/* -------------------------------------------------------
   SAFE: Ensure Firestore user doc exists
------------------------------------------------------- */
export async function ensureUserInFirestore(user) {
  if (!user || !user.uid) return null;

  try {
    const db = getFirestore();
    const ref = doc(db, `users/${user.uid}`);

    const result = await runTransaction(db, async tx => {
      const snap = await tx.get(ref);

      const emailLower = (user.email || "").toLowerCase();
      const isAdmin = ADMIN_EMAILS.includes(emailLower);

      if (!snap.exists()) {
        const newDoc = {
          uid: user.uid,
          email: user.email || null,
          displayName: user.displayName || null,
          paidClasses: [],
          streams: [],
          role: isAdmin ? "admin" : "student",
          signupDate: serverTimestamp()
        };
        tx.set(ref, newDoc, { merge: true });
        return newDoc;
      }

      const data = snap.data();
      const updates = {};
      let changed = false;

      if (!Array.isArray(data.paidClasses)) {
        updates.paidClasses = [];
        changed = true;
      }
      if (!Array.isArray(data.streams)) {
        updates.streams = [];
        changed = true;
      }

      if (!data.role) {
        updates.role = isAdmin ? "admin" : "student";
        changed = true;
      } else if (isAdmin && data.role !== "admin") {
        updates.role = "admin";
        changed = true;
      }

      if (user.email && data.email !== user.email) {
        updates.email = user.email;
        changed = true;
      }

      if (user.displayName && data.displayName !== user.displayName) {
        updates.displayName = user.displayName;
        changed = true;
      }

      if (changed) tx.set(ref, updates, { merge: true });

      return { ...data, ...updates };
    });

    window.authPaywall = window.authPaywall || {};
    window.authPaywall.userDoc = result;

    return result;

  } catch (e) {
    console.warn(LOG, "ensureUserInFirestore failed", e);
    return null; // Never break login flow
  }
}

// expose globally
window.authPaywall = window.authPaywall || {};
window.authPaywall.ensureUserInFirestore = ensureUserInFirestore;

/* -------------------------------------------------------
   AUTH LISTENER
------------------------------------------------------- */
export async function initializeAuthListener(callback = null) {
  await initializeServices();
  const { auth } = getInitializedClients();

  window.auth = auth;
  if (callback) externalCallback = callback;

  try { await setPersistence(auth, browserLocalPersistence); }
  catch (e) { console.warn(LOG, "Persistence skipped", e); }

  onAuthStateChanged(auth, async (user) => {
    console.log(LOG, "State →", user?.email || "Signed OUT");

    if (user) {
      try { await ensureUserInFirestore(user); } catch {}

      hidePaywall();
      hideAuthLoading();

      if (externalCallback) {
        try { externalCallback(user); } catch {}
      }
      return;
    }

    showPaywall();
    showAuthLoading("Please sign in to continue");

    if (externalCallback) {
      try { externalCallback(null); } catch {}
    }
  });

  console.log(LOG, "Auth listener ready.");
}

/* -------------------------------------------------------
   SIGN-IN
------------------------------------------------------- */
export async function signInWithGoogle() {
  await initializeServices();
  const { auth } = getInitializedClients();

  showAuthLoading("Opening Google Login…");

  try {
    const result = await signInWithPopup(auth, provider);
    try { await ensureUserInFirestore(result.user); } catch {}
    hideAuthLoading();
    hidePaywall();
    return result.user;
  } catch (e) {
    console.error(LOG, "Popup error:", e);
    hideAuthLoading();
    return null;
  }
}

/* -------------------------------------------------------
   SIGN OUT
------------------------------------------------------- */
export async function signOut() {
  await initializeServices();
  const { auth } = getInitializedClients();

  showPaywall();
  showAuthLoading("Signing out…");

  return firebaseSignOut(auth);
}

/* -------------------------------------------------------
   checkAccess (unchanged)
------------------------------------------------------- */
export function checkAccess() {
  try {
    const { auth } = getInitializedClients();
    return !!auth.currentUser;
  } catch {
    return false;
  }
}
