/**
 * ui.js — FraudGuard UI Helpers
 *
 * All small reusable UI utilities:
 *   - Page routing
 *   - Toast notifications
 *   - Loading overlay
 *   - Slider sync
 *   - Drag-and-drop
 *   - Number formatting
 *   - Time formatting
 */

'use strict';

// ── PAGE ROUTING ─────────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer = null;

function showToast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── LOADING OVERLAY ──────────────────────────────────────────────────────────
function showLoading(text, steps = []) {
  document.getElementById('loading-text').textContent = text;
  const stepsEl = document.getElementById('loading-steps');
  stepsEl.innerHTML = steps
    .map((s, i) => `<div class="loading-step" id="lstep-${i}">${s}</div>`)
    .join('');
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function setLoadingStep(index) {
  document.querySelectorAll('.loading-step').forEach((el, i) => {
    el.classList.remove('done', 'active');
    if (i < index)      el.classList.add('done');
    else if (i === index) el.classList.add('active');
  });
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ── SLIDER SYNC ──────────────────────────────────────────────────────────────
/**
 * Update slider fill gradient AND linked display elements.
 * @param {HTMLInputElement} sliderEl
 * @param {string[]}         displayIds — element IDs to update with value
 */
function syncSlider(sliderEl, displayIds = []) {
  const val = parseFloat(sliderEl.value);
  const pct = ((val - sliderEl.min) / (sliderEl.max - sliderEl.min)) * 100;
  sliderEl.style.setProperty('--pct', pct + '%');
  displayIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = val.toFixed(2);
  });
}

// ── DRAG-AND-DROP SETUP ───────────────────────────────────────────────────────
/**
 * Attach drag-over / drop handlers to a drop-zone element.
 * @param {string}   dropzoneId  — element ID of the drop zone
 * @param {function} onFile      — callback(File)
 */
function setupDropZone(dropzoneId, onFile) {
  const zone = document.getElementById(dropzoneId);
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });
}

// ── NUMBERS ──────────────────────────────────────────────────────────────────
function formatAmount(n) {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(1)   + 'L';
  if (n >= 1000)     return '₹' + (n / 1000).toFixed(1)     + 'K';
  return '₹' + n.toFixed(0);
}

function formatAmountFull(n) {
  return '₹' + n.toFixed(2);
}

// ── TIME ─────────────────────────────────────────────────────────────────────
/** Convert seconds-since-epoch to HH:MM string based on time-of-day */
function formatTime(seconds) {
  const s    = Math.abs(seconds) % 86400;
  const h    = Math.floor(s / 3600);
  const m    = Math.floor((s % 3600) / 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// ── RISK HELPERS ─────────────────────────────────────────────────────────────
/**
 * Return { label, cssClass, color } given a fraud probability.
 * @param {number} prob — 0 to 1
 * @param {number} threshold
 */
function getRiskInfo(prob, threshold) {
  if (prob > 0.80) return { label: '🔴 HIGH',   cssClass: 'risk-high',  color: 'var(--red)'    };
  if (prob > 0.50) return { label: '🟡 MED',    cssClass: 'risk-med',   color: 'var(--yellow)' };
  if (prob > threshold) return { label: '🟠 LOW', cssClass: 'risk-low',   color: 'var(--orange)' };
  return               { label: '🟢 LEGIT',  cssClass: 'risk-legit', color: 'var(--green)'  };
}

// ── CSV DOWNLOAD ─────────────────────────────────────────────────────────────
function downloadCSVFile(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function rowsToCSV(rows, columns) {
  const header = columns.join(',');
  const body   = rows.map(r =>
    columns.map(c => `"${r[c] ?? ''}"`).join(',')
  ).join('\n');
  return header + '\n' + body;
}
