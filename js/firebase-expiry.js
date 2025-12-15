// firebase-expiry.js
// ------------------------------------------------------
// GLOBAL ACCESS CONTROL for Ready4Exam
// - 15 day trial for students
// - paidClasses unlock classes 6–12
// - streams unlock science / commerce / arts
// - schools bypass trial but follow streams
// ------------------------------------------------------

import {
  initializeServices,
  getInitializedClients
} from "./config.js";

import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeServices, getInitializedClients } from "./config.js";

// ------------------------------------------------------
// UTIL: Check if trial expired
// ------------------------------------------------------
export function isSignupExpired(userData, daysAllowed = 15) {
  if (userData.accessExpiryDate) {
    const expiryDate = new Date(userData.accessExpiryDate);
    return Date.now() >= expiryDate.getTime();
  }

  const signupDate = userData.signupDate;
  if (!signupDate) return true;

  let signed;
  if (signupDate?.toMillis) {
    signed = new Date(signupDate.toMillis());
  } else {
    signed = new Date(signupDate);
  }

  if (Number.isNaN(signed.getTime())) return true;

  const expiry = signed.getTime() + daysAllowed * 24 * 60 * 60 * 1000;
  return Date.now() >= expiry;
}

// ------------------------------------------------------
// AUTO-CREATE USER DOC
// ------------------------------------------------------
export async function ensureUserDocExists() {
  await initializeServices();
  const { auth, db } = getInitializedClients();

  const user = auth.currentUser;
  if (!user) return;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  // Exists → patch missing fields
  if (snap.exists()) {
    const data = snap.data();
    const patch = {};

    if (!data.signupDate) patch.signupDate = serverTimestamp();
    if (!data.role) patch.role = "student";

    if (!data.paidClasses) {
      patch.paidClasses = {
        "6": false, "7": false, "8": false,
        "9": false, "10": false, "11": false, "12": false
      };
    }

    if (!data.streams) {
      patch.streams = {
        science: false,
        commerce: false,
        arts: false
      };
    }

    if (Object.keys(patch).length) {
      await updateDoc(ref, patch);
    }

    return { ...data, ...patch };
  }

  // Create new doc
  const newDoc = {
    signupDate: serverTimestamp(),
    role: "student",
    paidClasses: {
      "6": false, "7": false, "8": false,
      "9": false, "10": false, "11": false, "12": false
    },
    streams: {
      science: false,
      commerce: false,
      arts: false
    }
  };

  await setDoc(ref, newDoc);
  return newDoc;
}

// ------------------------------------------------------
// POPUP for blocked access
// ------------------------------------------------------
export function showExpiredPopup(message = "Your access is restricted.") {
  if (document.getElementById("r4e-expired-modal")) return;

  const wrap = document.createElement("div");
  wrap.id = "r4e-expired-modal";
  wrap.style =
    "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);z-index:99999;";

  wrap.innerHTML = `
    <div style="background:white;padding:28px;border-radius:12px;max-width:420px;text-align:center;">
      <h2 style="font-size:20px;font-weight:bold;margin-bottom:10px;">Access Restricted</h2>
      <p style="font-size:15px;color:#444;">${message}</p>
      <button id="r4e-expired-close"
        style="margin-top:18px;background:#1a3e6a;color:white;padding:10px 18px;border-radius:8px;">
        Close
      </button>
    </div>
  `;
  document.body.appendChild(wrap);

  document.getElementById("r4e-expired-close").onclick = () => wrap.remove();
}

// ------------------------------------------------------
// MASTER CHECK (class + stream + trial + role)
// ------------------------------------------------------
export async function checkClassAccess(classId, stream, chapterTitle) {
  await initializeServices();
  const { auth, db } = getInitializedClients();

  const user = auth.currentUser;
  if (!user) return { allowed: false, reason: "not-signed-in" };

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { allowed: false, reason: "user-doc-missing" };

  const data = snap.data();

  // ⭐ NEW CODE: ADMIN ROLE BYPASS - GRANTS UNRESTRICTED ACCESS ⭐
  if (data.role === "admin") {
    return { allowed: true };
  }
  // ⭐ END NEW CODE ⭐

  // SCHOOL ROLE (bypasses trial)
  if (data.role === "school") {
    if (data.streams?.[stream]) return { allowed: true };
    return { allowed: false, reason: `School does not have access to ${stream}` };
  }

  // STUDENT FLOW
  const expired = isSignupExpired(data);

  if (expired) {
    if (data.paidClasses?.[classId]) {
      if (data.streams?.[stream]) return { allowed: true };
      return { allowed: false, reason: `Stream (${stream}) not purchased.` };
    }
    return { allowed: false, reason: "Trial expired. Please purchase access." };
  }

  // Trial active → only stream matters
  if (!data.streams?.[stream]) {
    return { allowed: false, reason: `Stream (${stream}) not purchased.` };
  }

  // If the user has a chapters map, check if the chapter is in the map
  if (data.chapters && Object.keys(data.chapters).length > 0) {
    if (!data.chapters[chapterTitle]) {
      return { allowed: false, reason: `You do not have access to this chapter.` };
    }
  }

  return { allowed: true };
}

// ------------------------------------------------------
// chapter-selection entry point
// ------------------------------------------------------
export async function checkAndStartQuiz(startQuizCallback, classId, stream, chapterTitle) {
  const result = await checkClassAccess(classId, stream, chapterTitle);
  if (result.allowed) return startQuizCallback();
  showExpiredPopup(result.reason || "Access blocked.");
}

// ------------------------------------------------------
// Export working clients
// ------------------------------------------------------
