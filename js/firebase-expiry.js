// ✅ CORRECT PATH: Imports from same folder
import { initializeServices, getInitializedClients } from "./config.js";
import { 
  doc, getDoc, setDoc, updateDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function isSignupExpired(userData) {
  if (userData.accessExpiryDate) {
    const expiryDate = new Date(userData.accessExpiryDate);
    return Date.now() >= expiryDate.getTime();
  }
  return false; 
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
    if (!data.paidClasses) patch.paidClasses = { "6": false, "7": false, "8": false, "9": false, "10": false, "11": false, "12": false };
    if (data.streams === undefined) patch.streams = ""; 
    if (Object.keys(patch).length) await updateDoc(ref, patch);
    return { ...data, ...patch };
  }

  const newDoc = {
    uid: user.uid,
    email: user.email,
    signupDate: serverTimestamp(),
    role: "student",
    paidClasses: { "6": false, "7": false, "8": false, "9": false, "10": false, "11": false, "12": false },
    streams: ""
  };
  await setDoc(ref, newDoc);
  return newDoc;
}

export async function checkClassAccess(classId, stream) {
  await initializeServices();
  const { auth, db } = getInitializedClients();
  const user = auth.currentUser;
  
  if (!user) return { allowed: false, reason: "Please sign in to continue." };

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) return { allowed: true };
  
  const data = snap.data();

  if (data.role === "admin") return { allowed: true };

  // 🔥 CHECK EXPIRY FIRST
  if (isSignupExpired(data)) {
    return { 
      allowed: false, 
      reason: "Your evaluation period has concluded. Please contact us to upgrade your portfolio." 
    };
  }

  const activeClasses = Object.keys(data.paidClasses || {}).filter(key => data.paidClasses[key] === true);

  if (activeClasses.length === 0) {
    await updateDoc(userRef, { [`paidClasses.${classId}`]: true });
    return { allowed: true };
  }

  if (!data.paidClasses[classId]) {
    const primaryClass = activeClasses[0]; 
    return { 
      allowed: false, 
      reason: `You are currently an **Exclusive Member** of Class ${primaryClass}! Contact us to unlock Class ${classId}.` 
    };
  }

  return { allowed: true };
}

export function showExpiredPopup(message) {
  if (document.getElementById("r4e-expired-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "r4e-expired-overlay";
  overlay.className = "fixed inset-0 bg-slate-900/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animation-fade-in";
  
  const title = "Access Information";
  const subTitle = "Ready4Exam Pilot Program";
  const bodyText = message || `We hope you enjoyed experiencing the <strong>Ready4Exam</strong> platform.<br><br>Your preview access has ended.`;

  overlay.innerHTML = `
    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transform scale-100 transition-all border border-slate-100">
      <div class="bg-[#1a3e6a] p-6 text-center relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-1 bg-[#ffb703]"></div>
        <div class="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md"><span class="text-3xl">🌟</span></div>
        <h2 class="text-2xl font-black text-white tracking-tight">${title}</h2>
        <p class="text-blue-200 text-sm font-bold mt-1 tracking-wide uppercase">${subTitle}</p>
      </div>
      <div class="p-8 text-center">
        <p class="text-slate-600 text-base leading-relaxed mb-8">${bodyText}</p>
        <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-6">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact for Renewal</p>
          <a href="mailto:ready4urexam@gmail.com" class="flex items-center justify-center gap-2 text-[#1a3e6a] font-bold text-lg hover:underline">
            ready4urexam@gmail.com
          </a>
        </div>
        <button onclick="location.href='index.html'" class="w-full py-4 bg-[#ffb703] hover:bg-[#ffaa00] text-[#1a3e6a] font-black rounded-xl shadow-lg transition-all active:scale-95 text-sm uppercase tracking-wider">Back to Home</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}
