/**
 * charts.js — FraudGuard Chart Rendering
 *
 * All four Chart.js charts used in the Bulk Analysis results.
 * Each function accepts processed result data and renders into
 * a canvas element that must already exist in the DOM.
 */

'use strict';

// Store chart instances so we can destroy them before re-rendering
const ChartRegistry = {};

function destroyChart(key) {
  if (ChartRegistry[key]) {
    try { ChartRegistry[key].destroy(); } catch (e) { /* ignore */ }
    delete ChartRegistry[key];
  }
}

// ── SHARED THEME ─────────────────────────────────────────────────────────────
const CHART_DEFAULTS = {
  plugins: {
    legend: {
      labels: {
        color: '#8b90a0',
        font: { family: 'DM Mono, monospace', size: 11 },
      },
    },
    tooltip: {
      backgroundColor: '#181b22',
      borderColor: '#252934',
      borderWidth: 1,
      titleColor: '#e8eaf0',
      bodyColor: '#8b90a0',
      titleFont: { family: 'DM Mono, monospace', size: 11 },
      bodyFont:  { family: 'DM Sans, sans-serif', size: 12 },
    },
  },
  scales: {
    x: {
      ticks: { color: '#555b6e', font: { family: 'DM Mono, monospace', size: 10 } },
      grid:  { color: '#1e222c' },
    },
    y: {
      ticks: { color: '#555b6e', font: { family: 'DM Mono, monospace', size: 10 } },
      grid:  { color: '#1e222c' },
    },
  },
};

// Deep-merge helper (shallow enough for our use)
function mergeOptions(...sources) {
  const out = {};
  for (const src of sources) {
    for (const [k, v] of Object.entries(src)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = mergeOptions(out[k] || {}, v);
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}

// ── CHART 1 — DOUGHNUT: Fraud vs Legit ───────────────────────────────────────
/**
 * @param {string} canvasId
 * @param {number} fraudCount
 * @param {number} legitCount
 */
function renderDistributionChart(canvasId, fraudCount, legitCount) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  ChartRegistry[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Legitimate', 'Fraudulent'],
      datasets: [{
        data: [legitCount, fraudCount],
        backgroundColor: [
          'rgba(0, 230, 118, 0.65)',
          'rgba(255, 61, 87, 0.65)',
        ],
        borderColor: [
          'rgba(0, 230, 118, 0.3)',
          'rgba(255, 61, 87, 0.3)',
        ],
        borderWidth: 1,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: CHART_DEFAULTS.plugins.legend,
        tooltip: CHART_DEFAULTS.plugins.tooltip,
      },
    },
  });
}

// ── CHART 2 — BAR: Amount Distribution of Fraud ──────────────────────────────
/**
 * @param {string}   canvasId
 * @param {number[]} amounts — array of fraud transaction amounts
 */
function renderAmountChart(canvasId, amounts) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const brackets = ['<₹100', '₹100–500', '₹500–2K', '₹2K–10K', '>₹10K'];
  const counts   = [0, 0, 0, 0, 0];
  amounts.forEach(a => {
    if      (a < 100)   counts[0]++;
    else if (a < 500)   counts[1]++;
    else if (a < 2000)  counts[2]++;
    else if (a < 10000) counts[3]++;
    else                counts[4]++;
  });

  ChartRegistry[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: brackets,
      datasets: [{
        label: 'Fraud Transactions',
        data: counts,
        backgroundColor: 'rgba(0, 229, 255, 0.45)',
        borderColor:     'rgba(0, 229, 255, 0.8)',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: mergeOptions(CHART_DEFAULTS, {
      plugins: { legend: { display: false } },
    }),
  });
}

// ── CHART 3 — BAR: Fraud by Hour of Day ──────────────────────────────────────
/**
 * @param {string}   canvasId
 * @param {number[]} times — array of fraud transaction Time values (seconds)
 */
function renderTimeChart(canvasId, times) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const hourBuckets = Array(24).fill(0);
  times.forEach(t => {
    const hour = Math.floor((Math.abs(t) % 86400) / 3600);
    hourBuckets[hour]++;
  });

  // Colour bars red for night hours (suspected attack windows)
  const bgColors = hourBuckets.map((_, i) =>
    (i >= 0 && i <= 5) || i >= 22
      ? 'rgba(255, 61, 87, 0.60)'
      : 'rgba(255, 145, 0, 0.45)'
  );

  ChartRegistry[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => i + 'h'),
      datasets: [{
        label: 'Fraud count',
        data: hourBuckets,
        backgroundColor: bgColors,
        borderWidth: 0,
        borderRadius: 3,
      }],
    },
    options: mergeOptions(CHART_DEFAULTS, {
      plugins: { legend: { display: false } },
    }),
  });
}

// ── CHART 4 — BAR: Confidence Score Histogram ────────────────────────────────
/**
 * @param {string}   canvasId
 * @param {number[]} probs — array of fraud probabilities (0–1)
 * @param {number}   threshold
 */
function renderConfidenceChart(canvasId, probs, threshold) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  // 10 buckets of 10% each
  const buckets = Array(10).fill(0);
  probs.forEach(p => {
    const idx = Math.min(9, Math.floor(p * 10));
    buckets[idx]++;
  });

  const labels = [
    '0–10%', '10–20%', '20–30%', '30–40%', '40–50%',
    '50–60%', '60–70%', '70–80%', '80–90%', '90–100%',
  ];

  const bgColors = buckets.map((_, i) => {
    if (i >= 8) return 'rgba(255, 61, 87, 0.70)';
    if (i >= 5) return 'rgba(255, 196, 0, 0.60)';
    return             'rgba(255, 145, 0, 0.45)';
  });

  ChartRegistry[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Transactions',
        data: buckets,
        backgroundColor: bgColors,
        borderWidth: 0,
        borderRadius: 3,
      }],
    },
    options: mergeOptions(CHART_DEFAULTS, {
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#555b6e', font: { size: 9 } },
          grid:  { color: '#1e222c' },
        },
      },
    }),
  });
}

// ── RENDER ALL FOUR CHARTS ────────────────────────────────────────────────────
/**
 * Inject chart HTML shell into a container div, then render all charts.
 *
 * @param {string}   containerId — ID of the div to inject into
 * @param {object[]} results     — scored results from scoreBatch()
 * @param {number}   threshold
 */
function renderAllCharts(containerId, results, threshold) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const fraudRows = results.filter(r => r.isFraud);
  const legitRows = results.filter(r => !r.isFraud);

  container.innerHTML = `
    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">Fraud vs Legitimate Distribution</div>
        <div class="chart-sub">TRANSACTION COUNT</div>
        <div class="chart-box"><canvas id="chart-pie"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Fraud Amount Distribution</div>
        <div class="chart-sub">AMOUNT BRACKETS (₹)</div>
        <div class="chart-box"><canvas id="chart-amount"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Fraud by Time of Day</div>
        <div class="chart-sub">HOUR (🔴 = night hours: high-risk window)</div>
        <div class="chart-box"><canvas id="chart-time"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Confidence Score Distribution</div>
        <div class="chart-sub">FRAUD PROBABILITY HISTOGRAM (flagged only)</div>
        <div class="chart-box"><canvas id="chart-conf"></canvas></div>
      </div>
    </div>
    <hr class="divider" />
  `;

  renderDistributionChart('chart-pie',   fraudRows.length, legitRows.length);
  renderAmountChart       ('chart-amount', fraudRows.map(r => r.amount));
  renderTimeChart         ('chart-time',   fraudRows.map(r => r.time));
  renderConfidenceChart   ('chart-conf',   fraudRows.map(r => r.prob), threshold);
}
