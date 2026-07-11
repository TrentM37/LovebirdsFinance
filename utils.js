/* ==========================================================================
   Project Unified Finance: General Utilities & Web Audio Synth (Globals)
   ========================================================================== */

/**
 * Generates a cryptographically secure UUID v4
 * @returns {string} UUIDv4
 */
function generateUUID() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Formats a decimal number into currency string: $1,234.56
 * @param {number} value
 * @returns {string} Formatted currency
 */
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

/**
 * Formats standard ISO YYYY-MM-DD into a more readable layout, e.g. Jun 15, 2026
 * @param {string} dateStr
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Formats standard ISO YYYY-MM-DD into short layout, e.g. 06/15
 * @param {string} dateStr
 * @returns {string} Formatted date
 */
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Returns current month-year string in MM-YYYY format
 * @returns {string} e.g. 06-2026
 */
function getCurrentMonthYear() {
  const date = new Date();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}-${y}`;
}

/**
 * Convert MM-YYYY into human readable format, e.g. "June 2026"
 * @param {string} monthYear MM-YYYY
 * @returns {string} e.g. June 2026
 */
function formatMonthYearReadable(monthYear) {
  if (!monthYear) return '';
  const [m, y] = monthYear.split('-');
  const date = new Date(y, parseInt(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get past N months including current in MM-YYYY format
 * @param {number} count 
 * @returns {string[]} Array of MM-YYYY strings
 */
function getPastMonths(count) {
  const list = [];
  const date = new Date();
  for (let i = 0; i < count; i++) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    list.push(`${m}-${y}`);
    date.setMonth(date.getMonth() - 1);
  }
  return list.reverse(); // oldest first
}

/**
 * Synthesizes a high-fidelity double-note audio success chime
 * Uses browser's native AudioContext - no network files needed
 */
function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // First Note: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
    
    gain1.gain.setValueAtTime(0.001, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);
    
    // Second Note: G5 (783.99 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12);
    
    gain2.gain.setValueAtTime(0.001, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (e) {
    console.error("Audio Context playback failed.", e);
  }
}

/**
 * Returns current date in local timezone in YYYY-MM-DD format
 * @returns {string} e.g. 2026-06-23
 */
function getLocalYYYYMMDD() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Expose utilities on window explicitly
window.generateUUID = generateUUID;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatDateShort = formatDateShort;
window.getCurrentMonthYear = getCurrentMonthYear;
window.formatMonthYearReadable = formatMonthYearReadable;
window.getPastMonths = getPastMonths;
window.playSuccessChime = playSuccessChime;
window.getLocalYYYYMMDD = getLocalYYYYMMDD;
