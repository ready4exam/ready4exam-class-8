// js/auth-paywall.js
// -------------------------------------------------------
// Firebase Login Paywall (Minimal-Patch Version)
// - Pure DOM-based hide/show
// - No dependency on ui-renderer
// - Compatible with Option A quiz-engine
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

const LOG = "[AUTH]";
let externalCallback = null;

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// -------------------------------------------------------
// PURE DOM HELPERS
// -------------------------------------------------------
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

function hidePaywall() {
  const pw = findPaywall();
  if (pw) pw.style.display = "none";
}

function showPaywall() {
  const pw = findPaywall();
  if (pw) pw.style.display = "block";
}

function showAuthLoading(msg = "Loading…") {
  const el = findLoading();
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
  }
}

function hideAuthLoading() {
  const el = findLoading();
  if (el) el.style.display = "none";
}

// -------------------------------------------------------
// AUTH LISTENER INITIALIZATION
// -------------------------------------------------------
export async function initializeAuthListener(callback = null) {
  await initializeServices();
  const { auth } = getInitializedClients();

  // ⭐ Expose Firebase Auth globally — required for header username display
  window.auth = auth;

  if (callback) externalCallback = callback;

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.warn(LOG, "Persistence failed → Continuing without it", e);
  }

  onAuthStateChanged(auth, (user) => {
    console.log(LOG, "Auth state →", user ? user.email : "Signed OUT");

    if (user) {
      hidePaywall();
      hideAuthLoading();

      if (externalCallback) {
        try { externalCallback(user); } catch (e) {}
      }

      return;
    }

    showPaywall();
    showAuthLoading("Please sign in to continue");

    if (externalCallback) {
      try { externalCallback(null); } catch (e) {}
    }
  });

  console.log(LOG, "Auth listener initialized.");
}

// -------------------------------------------------------
// SIGN-IN WITH GOOGLE POPUP
// -------------------------------------------------------
export async function signInWithGoogle() {
  await initializeServices();
  const { auth } = getInitializedClients();

  showAuthLoading("Opening Google Login…");

  try {
    const result = await signInWithPopup(auth, provider);

    hideAuthLoading();
    hidePaywall();

    return result.user;
  } catch (err) {
    console.error(LOG, "Google popup error:", err);
    hideAuthLoading();
    return null;
  }
}

// -------------------------------------------------------
// SIGN OUT
// -------------------------------------------------------
export async function signOut() {
  await initializeServices();
  const { auth } = getInitializedClients();

  showPaywall();
  showAuthLoading("Signing out…");

  return firebaseSignOut(auth);
}

// -------------------------------------------------------
// FIX: CHECK ACCESS (Required by 9th quiz-engine.js)
// -------------------------------------------------------
export function checkAccess() {
  try {
    const { auth } = getInitializedClients();
    return !!auth.currentUser; // TRUE if logged in
  } catch {
    return false;
  }
}
