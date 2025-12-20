import { initializeServices, getInitializedClients } from "./config.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function isSignupExpired(userData) {
  if (userData.accessExpiryDate) {
    const expiryDate = new Date(userData.accessExpiryDate);
    return Date.now() >= expiryDate.getTime();
  }
  return false; // Indefinite access by default
}

export async function ensureUserDocExists() {
  await initializeServices();
  const { auth, db } = getInitializedClients();
  const user = auth.currentUser;
  if (!user) return;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    const patch = {};
    if (!data.signupDate) patch.signupDate = serverTimestamp();
    if (!data.role) patch.role = "student";
    if (!data.paidClasses) {
      patch.paidClasses = { "6": false, "7": false, "8": false, "9": false, "10": false, "11": false, "12": false };
    }
    if (data.streams === undefined) patch.streams = ""; 
    if (Object.keys(patch).length) await updateDoc(ref, patch);
    return { ...data, ...patch };
  }

  const newDoc = {
    signupDate: serverTimestamp(),
    role: "student",
    paidClasses: { "6": false, "7": false, "8": false, "9": false, "10": false, "11": false, "12": false },
    streams: ""
  };
  await setDoc(ref, newDoc);
  return newDoc;
}

export function showExpiredPopup(message = "Access Restricted") {
  if (document.getElementById("r4e-expired-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "r4e-expired-modal";
  wrap.className = "fixed inset-0 flex items-center justify-center bg-black/60 z-[9999] backdrop-blur-sm";
  wrap.innerHTML = `
    <div class="bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl mx-4">
      <div class="text-red-500 mb-4"><svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0-8v6m-5.221 2h10.442c.566 0 1.02-.454 1.02-1.02V7.02c0-.566-.454-1.02-1.02-1.02H6.779c-.566 0-1.02.454-1.02 1.02v9.96c0 .566.454 1.02 1.02 1.02z"/></svg></div>
      <h2 class="text-xl font-black text-slate-900 mb-2">Access Restricted</h2>
      <p class="text-slate-500 text-sm font-medium leading-relaxed">${message}</p>
      <button onclick="this.parentElement.parentElement.remove()" class="mt-6 w-full bg-slate-900 text-white py-3 rounded-2xl font-bold">Close</button>
    </div>`;
  document.body.appendChild(wrap);
}

export async function checkClassAccess(classId, stream, chapterTitle) {
  await initializeServices();
  const { auth, db } = getInitializedClients();
  const user = auth.currentUser;
  if (!user) return { allowed: false, reason: "Please sign in." };

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return { allowed: false, reason: "Record not found." };
  const data = snap.data();

  if (data.role === "admin") return { allowed: true }; // Admin bypass
  if (isSignupExpired(data)) return { allowed: false, reason: "Manual expiry set by Admin." };
  if (!data.paidClasses?.[classId]) return { allowed: false, reason: `Class ${classId} not authorized.` };
  
  if ((classId === "11" || classId === "12") && stream && data.streams !== stream) {
      return { allowed: false, reason: `Stream ${stream} not authorized.` };
  }

  return { allowed: true };
}
