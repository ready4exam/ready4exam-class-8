// js/class-switcher-wiring.js
// -----------------------------------------------------------------------------
// Handles class switching and Firebase initialization across pages
// Works with firebaseSwitcher.js and config.js
// -----------------------------------------------------------------------------

import { initializeServices } from "./config.js";
import { switchFirebaseProject } from "./firebaseSwitcher.js";

const LOG = "[CLASS-SWITCHER]";
let currentClass = null;

/**
 * Initialize class switcher and load services.
 */
export async function initializeClassSwitcher() {
  try {
    // ✅ Load saved class from localStorage or default to Class 11
    const savedClass = localStorage.getItem("selectedClass") || "class11";
    currentClass = savedClass;

    console.log(`${LOG} Initializing services for ${currentClass}`);
    await initializeServices(currentClass);

    // ✅ Set dropdown default value if exists in DOM
    const dropdown = document.getElementById("class-select-dropdown");
    if (dropdown) {
      dropdown.value = currentClass;
      dropdown.addEventListener("change", (e) => {
        handleClassChange(e.target.value);
      });
    }

    console.log(`${LOG} Initialization complete for ${currentClass}`);
  } catch (err) {
    console.error(`${LOG} Initialization failed:`, err);
  }
}

/**
 * Handle class change via dropdown or UI selection
 */
export async function handleClassChange(newClassId) {
  try {
    if (newClassId === currentClass) return; // avoid redundant re-init

    console.log(`${LOG} Class changed to ${newClassId}`);
    localStorage.setItem("selectedClass", newClassId);
    currentClass = newClassId;

    // ✅ Switch Firebase project context for the new class
    switchFirebaseProject(newClassId);

    // ✅ Reinitialize dependent services for the new class
    await initializeServices(newClassId);

    // ✅ Optionally reload page to fully refresh context (optional)
    if (window.location.pathname.includes("quiz-engine.html")) {
      // Stay on the quiz page but reload parameters to match new class
      const params = new URLSearchParams(window.location.search);
      params.set("class", newClassId);
      window.location.search = params.toString();
    } else {
      // For other pages like chapter-selection, reload for safety
      window.location.reload();
    }
  } catch (err) {
    console.error(`${LOG} Class change failed:`, err);
  }
}

/**
 * Get currently active class (e.g., 'class9' or 'class11')
 */
export function getActiveClass() {
  return currentClass || localStorage.getItem("selectedClass") || "class11";
}

// -----------------------------------------------------------------------------
// Auto-init when DOM is ready
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initializeClassSwitcher();
});
