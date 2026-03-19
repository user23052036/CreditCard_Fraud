/**
 * app.js — FraudGuard Application Controller
 *
 * Changes from v1:
 *  - Email service card removed from downloads
 *  - Re-upload / Change File button on both dropzones
 *  - Quick-fill sample buttons (fraud + legit) in Single Check
 *  - "Check Another Transaction" reset button after result
 *  - Top feature signals panel in result card
 *  - Extra bulk stats: peak fraud hour + avg fraud amount
 *  - Batch "Block All Flagged" action button
 *  - Export results as JSON
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
const State = {
  singleFileData: null,
  bulkRawData:    [],
  bulkResults:    [],
  bulkThreshold:  0.25,
  currentPage:    1,
  PAGE_SIZE:      10,
  filterMode:     'all',
  searchQuery:    '',
  sortCol:        'prob',
  sortDir:        -1,
  // Transaction history (single checks only, persists for the session)
  txnHistory:     [],
};

// ── Sample data for quick-fill ───────────────────────────────
const SAMPLE_FRAUD = {
  Time:406,Amount:2.69,
  V1:-3.0479,V2:1.3578,V3:-4.9537,V4:4.3715,V5:-1.3378,
  V6:1.0206,V7:-5.2316,V8:0.7706,V9:-2.2215,V10:-4.3536,
  V11:4.1752,V12:-5.7223,V13:0.1231,V14:-9.3310,V15:-0.4321,
  V16:-3.2875,V17:-8.1293,V18:-0.2631,V19:0.7723,V20:0.3621,
  V21:-0.8321,V22:0.5123,V23:-0.2312,V24:0.1231,V25:-0.3213,
  V26:0.6123,V27:-0.1231,V28:0.0321,
};

const SAMPLE_LEGIT = {
  Time:86400,Amount:45.00,
  V1:1.2918,V2:0.3917,V3:0.4920,V4:1.0789,V5:0.4289,
  V6:0.1745,V7:0.4891,V8:0.0712,V9:0.3621,V10:0.5218,
  V11:0.7812,V12:0.3214,V13:0.1823,V14:0.9821,V15:0.2314,
  V16:0.1823,V17:0.4512,V18:0.2341,V19:0.1234,V20:0.0821,
  V21:0.0312,V22:0.0821,V23:0.0312,V24:0.0213,V25:0.0512,
  V26:0.0321,V27:0.0123,V28:0.0213,
};

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initSliders();
  initDropZones();
  initButtons();
  injectQuickFillButtons();
});

function initSliders() {
  const singleSlider = document.getElementById('single-threshold');
  const bulkSlider   = document.getElementById('bulk-threshold');
  if (singleSlider) {
    singleSlider.addEventListener('input', () =>
      syncSlider(singleSlider, ['threshold-display', 'threshold-display2']));
    syncSlider(singleSlider, ['threshold-display', 'threshold-display2']);
  }
  if (bulkSlider) {
    bulkSlider.addEventListener('input', () =>
      syncSlider(bulkSlider, ['bulk-thresh-val']));
    syncSlider(bulkSlider, ['bulk-thresh-val']);
  }
}

function initDropZones() {
  setupDropZone('single-dropzone', file => processSingleCSV(file));
  const singleInput = document.getElementById('single-file-input');
  if (singleInput) {
    singleInput.addEventListener('change', e => {
      if (e.target.files[0]) processSingleCSV(e.target.files[0]);
    });
  }
  setupDropZone('bulk-dropzone', file => processBulkCSV(file));
  const bulkInput = document.getElementById('bulk-file-input');
  if (bulkInput) {
    bulkInput.addEventListener('change', e => {
      if (e.target.files[0]) processBulkCSV(e.target.files[0]);
    });
  }
}

function initButtons() {
  const advToggle = document.getElementById('adv-toggle');
  if (advToggle) {
    advToggle.addEventListener('click', () => {
      const content = document.getElementById('advanced-content');
      const arrow   = document.getElementById('adv-arrow');
      const isOpen  = content.classList.toggle('open');
      arrow.textContent = isOpen ? '▼' : '▶';
    });
  }
  const singleBtn   = document.getElementById('single-check-btn');
  if (singleBtn)   singleBtn.addEventListener('click', runSingleCheck);
  const validateBtn = document.getElementById('validate-btn');
  if (validateBtn) validateBtn.addEventListener('click', validateBulkFile);
  const runBtn      = document.getElementById('run-analysis-btn');
  if (runBtn)      runBtn.addEventListener('click', runBulkAnalysis);
  const newBtn      = document.getElementById('new-analysis-btn');
  if (newBtn)      newBtn.addEventListener('click', resetBulk);
}

// Inject quick-fill + clear buttons below the Check button
function injectQuickFillButtons() {
  const checkBtn = document.getElementById('single-check-btn');
  if (!checkBtn) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'quick-fill-row';
  wrapper.style.cssText = 'display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;';
  wrapper.innerHTML = `
    <button class="btn btn-secondary" style="flex:1;font-size:12px;min-width:140px;"
      onclick="loadSampleData('fraud')">🔴 Load Fraud Sample</button>
    <button class="btn btn-secondary" style="flex:1;font-size:12px;min-width:140px;"
      onclick="loadSampleData('legit')">🟢 Load Legit Sample</button>
    <button class="btn btn-secondary" style="flex:1;font-size:12px;min-width:120px;"
      onclick="resetSingleForm()">🔄 Clear Form</button>
  `;
  checkBtn.parentNode.insertBefore(wrapper, checkBtn.nextSibling);
}

// ═══════════════════════════════════════════════════════════════
// QUICK FILL
// ═══════════════════════════════════════════════════════════════
function loadSampleData(type) {
  const sample = type === 'fraud' ? SAMPLE_FRAUD : SAMPLE_LEGIT;
  State.singleFileData = { ...sample };

  document.getElementById('input-amount').value = sample.Amount;
  document.getElementById('input-time').value   = sample.Time;

  const zone = document.getElementById('single-dropzone');
  zone.classList.add('file-loaded');
  document.getElementById('single-drop-icon').textContent  = type === 'fraud' ? '🔴' : '🟢';
  document.getElementById('single-drop-title').textContent = type === 'fraud'
    ? '✓ Fraud sample loaded (V14 = -9.33)'
    : '✓ Legit sample loaded (V14 = +0.98)';

  ensureSingleReuploadBtn();
  showToast(type === 'fraud'
    ? '🔴 Fraud sample loaded — click Check to test'
    : '🟢 Legit sample loaded — click Check to test');
}

// ═══════════════════════════════════════════════════════════════
// SINGLE CHECK
// ═══════════════════════════════════════════════════════════════
function processSingleCSV(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showToast('⚠️ Please upload a CSV file'); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const { rows } = parseCSV(e.target.result);
      State.singleFileData = rows[0] || null;
      const amtInput  = document.getElementById('input-amount');
      const timeInput = document.getElementById('input-time');
      if (State.singleFileData?.Amount && !amtInput.value)
        amtInput.value = State.singleFileData.Amount;
      if (State.singleFileData?.Time && !timeInput.value)
        timeInput.value = State.singleFileData.Time;

      const zone = document.getElementById('single-dropzone');
      zone.classList.add('file-loaded');
      document.getElementById('single-drop-icon').textContent  = '✅';
      document.getElementById('single-drop-title').textContent = '✓ ' + file.name + ' loaded';

      ensureSingleReuploadBtn();
      showToast('✓ File loaded — V1–V28 ready');
    } catch (err) {
      showToast('❌ Error reading file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// Adds a "Change File" button inside the single dropzone once
function ensureSingleReuploadBtn() {
  if (document.getElementById('single-reupload-btn')) return;
  const zone = document.getElementById('single-dropzone');
  const btn  = document.createElement('button');
  btn.id        = 'single-reupload-btn';
  btn.className = 'btn btn-secondary';
  btn.style.cssText = 'margin-top:10px;font-size:12px;padding:6px 14px;';
  btn.textContent   = '↺ Change File';
  btn.onclick = e => { e.stopPropagation(); resetSingleDropZone(); };
  zone.appendChild(btn);
}

function resetSingleDropZone() {
  State.singleFileData = null;
  const zone = document.getElementById('single-dropzone');
  zone.classList.remove('file-loaded');
  document.getElementById('single-drop-icon').textContent  = '📎';
  document.getElementById('single-drop-title').textContent = 'Drop your CSV here or click to upload';
  const fi = document.getElementById('single-file-input');
  if (fi) fi.value = '';
  const btn = document.getElementById('single-reupload-btn');
  if (btn) btn.remove();
  showToast('File cleared — upload a new one');
}

function resetSingleForm() {
  resetSingleDropZone();
  document.getElementById('input-amount').value = '';
  document.getElementById('input-time').value   = '';
  document.getElementById('single-output').classList.add('hidden');
  document.getElementById('result-card').innerHTML = '';
  showToast('Form cleared');
}

async function runSingleCheck() {
  const amount    = parseFloat(document.getElementById('input-amount').value);
  const time      = parseFloat(document.getElementById('input-time').value);
  const threshold = parseFloat(document.getElementById('single-threshold').value);

  if (isNaN(amount) || isNaN(time)) {
    showToast('⚠️ Please enter both Amount and Time'); return;
  }

  showLoading('Analyzing transaction…', [
    'Scaling features (StandardScaler)',
    'Running XGBoost inference',
    'Applying threshold (' + threshold + ')',
  ]);

  const steps = [300, 700, 1100];
  steps.forEach((delay, i) => setTimeout(() => setLoadingStep(i), delay));

  const base   = State.singleFileData || {};
  const row    = { Time: time, Amount: amount };
  for (let i = 1; i <= 28; i++) row['V' + i] = base['V' + i];
  const filled = fillMissingFeatures(row);

  try {
    await new Promise(r => setTimeout(r, 1450));
    const prob = await scoreSingleRow(filled);
    hideLoading();
    renderSingleResult(prob, filled, threshold, amount);
    // ── Record in history ──
    pushToHistory({ prob, amount, time, threshold, filled });
  } catch (err) {
    hideLoading();
    showToast('❌ Backend error: ' + err.message +
      ' — Is the FastAPI server running on port 8000?');
  }
}

// ── Feature signals renderer ──────────────────────────────────
function renderFeatureSignals(row) {
  const signals = [];
  for (let i = 1; i <= 28; i++) {
    const val = row['V' + i];
    if (typeof val === 'number' && !isNaN(val))
      signals.push({ name: 'V' + i, val });
  }
  if (!signals.length) return '';
  signals.sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
  const top = signals.slice(0, 6);

  const bars = top.map(f => {
    const pct   = Math.min(Math.abs(f.val) / 10, 1) * 100;
    const color = f.val < -2 ? 'var(--red)'
                : f.val >  2 ? 'var(--orange)'
                : 'var(--accent)';
    const sign  = f.val >= 0 ? '+' : '';
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--text2);
          width:30px;text-align:right;">${f.name}</span>
        <div style="flex:1;background:var(--surface2);border-radius:3px;height:8px;overflow:hidden;">
          <div style="width:${pct.toFixed(0)}%;height:100%;background:${color};
            border-radius:3px;transition:width .6s ease;"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:11px;color:${color};
          width:54px;">${sign}${f.val.toFixed(3)}</span>
      </div>`;
  }).join('');

  return `
    <div style="margin-top:16px;padding:14px;background:var(--surface2);
      border-radius:8px;border:1px solid var(--border);">
      <div style="font-size:11px;color:var(--text3);letter-spacing:.06em;
        margin-bottom:10px;">TOP FEATURE SIGNALS (highest magnitude)</div>
      ${bars}
      <div style="font-size:11px;color:var(--text3);margin-top:8px;">
        🔴 Strongly negative = fraud signal &nbsp;·&nbsp;
        🟠 Strongly positive = anomaly &nbsp;·&nbsp;
        🔵 Near zero = normal
      </div>
    </div>`;
}

function renderSingleResult(prob, filledRow, threshold, amount) {
  const pct       = (prob * 100).toFixed(1);
  const risk      = getRiskInfo(prob, threshold);
  const threshPct = (threshold * 100).toFixed(0);
  const isFraud   = prob > threshold;
  const cardClass = isFraud ? 'fraud' : 'legit';

  const explainText = isFraud
    ? `This transaction has a <strong style="color:var(--red)">${pct}%</strong> probability of being fraudulent.
       Amount ₹${amount.toFixed(2)} is flagged at
       <strong>${risk.label.replace(/🔴|🟡|🟠|🟢/g,'').trim()}</strong> risk.
       Immediate action is recommended.`
    : `This transaction has a <strong style="color:var(--green)">${(100 - parseFloat(pct)).toFixed(1)}%</strong>
       probability of being legitimate. Fraud probability (${pct}%) is below threshold
       (${threshPct}%). No action required.`;

  const html = `
    <div class="result-card ${cardClass}">
      <div class="result-verdict ${cardClass}">
        <span>${isFraud ? '🔴' : '🟢'}</span>
        ${isFraud ? 'FRAUDULENT TRANSACTION' : 'LEGITIMATE TRANSACTION'}
      </div>
      <div class="result-meta">
        Confidence: <strong style="color:${risk.color}">${pct}%</strong>
        &nbsp;·&nbsp;
        Risk: <strong style="color:${risk.color}">${risk.label.replace(/🔴|🟡|🟠|🟢/g,'').trim()}</strong>
        &nbsp;·&nbsp;
        Threshold: <strong style="font-family:var(--font-mono)">${threshold}</strong>
        &nbsp;·&nbsp;
        Amount: <strong style="font-family:var(--font-mono)">₹${amount.toFixed(2)}</strong>
      </div>
      <div class="gauge-wrap">
        <div class="gauge-label">FRAUD PROBABILITY GAUGE</div>
        <div class="gauge-bar">
          <div class="gauge-fill ${cardClass}" id="gauge-fill" style="width:0%;"></div>
          <div class="gauge-threshold" style="left:${threshPct}%;">
            <div class="gauge-threshold-label">threshold&nbsp;${threshold}</div>
          </div>
        </div>
        <div class="gauge-ticks">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>
      <div class="result-explain ${cardClass}">${explainText}</div>
      ${renderFeatureSignals(filledRow)}
      <div class="action-row">
        <button class="action-btn block"
          onclick="logSingleAction(this,'Transaction Blocked')">🚫 Block Transaction</button>
        <button class="action-btn investigate"
          onclick="logSingleAction(this,'Sent for Investigation')">🔎 Investigate Further</button>
        <button class="action-btn override"
          onclick="logSingleAction(this,'Marked as Legitimate')">✅ Override as Legit</button>
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-secondary" style="font-size:12px;"
          onclick="copyResultToClipboard(${prob},${amount},${threshold})">
          📋 Copy Result
        </button>
        <button class="btn btn-secondary" style="font-size:12px;"
          id="visual-prob-btn"
          onclick="toggleVisualProb(${prob},${threshold})">
          📊 Show Visual Breakdown
        </button>
        <button class="btn btn-secondary" style="font-size:12px;"
          onclick="resetSingleForm()">
          🔄 Check Another Transaction
        </button>
      </div>

      <!-- Visual probability chart (hidden until toggled) -->
      <div id="visual-prob-wrapper" style="display:none;margin-top:18px;
        padding:20px;background:var(--surface2);border-radius:8px;
        border:1px solid var(--border);">
        <div style="font-size:11px;color:var(--text3);letter-spacing:.06em;
          margin-bottom:14px;">PROBABILITY VISUAL BREAKDOWN</div>
        <div style="max-width:280px;margin:0 auto;">
          <canvas id="prob-visual-chart" height="280"></canvas>
        </div>
        <div style="display:flex;justify-content:space-between;
          margin-top:14px;font-size:12px;color:var(--text2);
          font-family:var(--font-mono);">
          <span>Fraud: <strong style="color:${prob > threshold ? 'var(--red)' : 'var(--orange)'}">
            ${(prob*100).toFixed(2)}%</strong></span>
          <span>Legit: <strong style="color:var(--green)">
            ${((1-prob)*100).toFixed(2)}%</strong></span>
          <span>Threshold: <strong>${threshold}</strong></span>
        </div>
      </div>
    </div>`;

  const outputSection = document.getElementById('single-output');
  document.getElementById('result-card').innerHTML = html;
  outputSection.classList.remove('hidden');
  outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = document.getElementById('gauge-fill');
      if (fill) fill.style.width = (prob * 100) + '%';
    }, 80);
  });
}

function logSingleAction(btn, actionLabel) {
  if (btn.classList.contains('logged')) return;
  document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('logged'));
  btn.classList.add('logged');
  showToast('✓ Action logged: ' + actionLabel);
}

function copyResultToClipboard(prob, amount, threshold) {
  const isFraud = prob > threshold;
  const text = [
    'FraudGuard Result',
    '─────────────────',
    `Verdict:     ${isFraud ? 'FRAUDULENT' : 'LEGITIMATE'}`,
    `Probability: ${(prob * 100).toFixed(2)}%`,
    `Amount:      ₹${amount.toFixed(2)}`,
    `Threshold:   ${threshold}`,
    `Timestamp:   ${new Date().toLocaleString()}`,
  ].join('\n');
  navigator.clipboard.writeText(text)
    .then(() => showToast('✓ Result copied to clipboard'))
    .catch(() => showToast('❌ Clipboard not available'));
}

// ═══════════════════════════════════════════════════════════════
// BULK ANALYSIS
// ═══════════════════════════════════════════════════════════════
function processBulkCSV(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showToast('⚠️ Please upload a CSV file'); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const { rows } = parseCSV(e.target.result);
      State.bulkRawData = rows;
      const zone = document.getElementById('bulk-dropzone');
      zone.classList.add('file-loaded');
      document.getElementById('bulk-drop-icon').textContent  = '✅';
      document.getElementById('bulk-drop-title').textContent =
        '✓ ' + file.name + ' — ' + rows.length.toLocaleString() + ' rows';
      ensureBulkReuploadBtn();
      showToast(`✓ Loaded ${rows.length.toLocaleString()} transactions`);
    } catch (err) {
      showToast('❌ Error reading file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// Adds a "Change File" button inside the bulk dropzone once
function ensureBulkReuploadBtn() {
  if (document.getElementById('bulk-reupload-btn')) return;
  const zone = document.getElementById('bulk-dropzone');
  const btn  = document.createElement('button');
  btn.id        = 'bulk-reupload-btn';
  btn.className = 'btn btn-secondary';
  btn.style.cssText = 'margin-top:10px;font-size:12px;padding:6px 14px;';
  btn.textContent   = '↺ Change File';
  btn.onclick = e => { e.stopPropagation(); resetDropZone(); };
  zone.appendChild(btn);
}

function validateBulkFile() {
  if (!State.bulkRawData.length) {
    State.bulkRawData = generateDemoData(500);
    showToast('No file uploaded — using 500 demo transactions');
  }
  const result = validateCSV(State.bulkRawData);
  const box    = document.getElementById('validation-box');

  const checksHTML = result.checks
    .map(c => `<div class="val-item"><span class="val-icon val-ok">✅</span>${c.msg}</div>`)
    .join('');
  const warnHTML = result.warnings
    .map(w => `<div class="val-item"><span class="val-icon val-warn">⚠️</span>${w}</div>`)
    .join('');
  const errHTML = result.errors
    .map(e => `<div class="val-item"><span class="val-icon val-err">❌</span>${e}</div>`)
    .join('');

  const proceedBtn = result.valid
    ? `<button class="btn btn-primary" onclick="runBulkAnalysis()">🚀 Proceed with Analysis</button>`
    : '';

  box.innerHTML = `
    <div class="validation-box">
      <div class="validation-title">📋 File Validation Report</div>
      ${checksHTML}${warnHTML}${errHTML}
      <div class="val-actions">
        <button class="btn btn-secondary" onclick="resetDropZone()">↺ Re-upload File</button>
        ${proceedBtn}
      </div>
    </div>`;
  box.classList.remove('hidden');
}

function resetDropZone() {
  State.bulkRawData = [];
  const zone = document.getElementById('bulk-dropzone');
  zone.classList.remove('file-loaded');
  document.getElementById('bulk-drop-icon').textContent  = '📁';
  document.getElementById('bulk-drop-title').textContent = 'Drop CSV file here or click to browse';
  const fi = document.getElementById('bulk-file-input');
  if (fi) fi.value = '';
  const btn = document.getElementById('bulk-reupload-btn');
  if (btn) btn.remove();
  document.getElementById('validation-box').classList.add('hidden');
  showToast('File cleared — upload a new one');
}

async function runBulkAnalysis() {
  if (!State.bulkRawData.length) {
    State.bulkRawData = generateDemoData(500);
    showToast('No file uploaded — using 500 demo transactions');
  }

  State.bulkThreshold = parseFloat(document.getElementById('bulk-threshold').value);
  State.currentPage   = 1;
  State.filterMode    = 'all';
  State.searchQuery   = '';
  State.sortCol       = 'prob';
  State.sortDir       = -1;

  const n = State.bulkRawData.length;
  showLoading(`Analyzing ${n.toLocaleString()} transactions…`, [
    'Scaling Time & Amount (StandardScaler)',
    'Running XGBoost inference',
    `Applying threshold (${State.bulkThreshold})`,
    'Computing statistics',
    'Generating charts',
  ]);

  let step = 0;
  const stepInterval = setInterval(() => {
    setLoadingStep(step++);
    if (step >= 5) clearInterval(stepInterval);
  }, 280);

  try {
    await new Promise(r => setTimeout(r, 1650));
    State.bulkResults = await scoreBatch(State.bulkRawData, State.bulkThreshold);
    clearInterval(stepInterval);
    hideLoading();
    document.getElementById('bulk-upload-step').classList.add('hidden');
    document.getElementById('bulk-results-step').classList.remove('hidden');
    renderBulkResults();
  } catch (err) {
    clearInterval(stepInterval);
    hideLoading();
    showToast('❌ Backend error: ' + err.message +
      ' — Is the FastAPI server running on port 8000?');
  }
}

function resetBulk() {
  State.bulkRawData = [];
  State.bulkResults = [];
  document.getElementById('bulk-results-step').classList.add('hidden');
  document.getElementById('bulk-upload-step').classList.remove('hidden');
  const zone = document.getElementById('bulk-dropzone');
  zone.classList.remove('file-loaded');
  document.getElementById('bulk-drop-icon').textContent  = '📁';
  document.getElementById('bulk-drop-title').textContent = 'Drop CSV file here or click to browse';
  const fi = document.getElementById('bulk-file-input');
  if (fi) fi.value = '';
  const btn = document.getElementById('bulk-reupload-btn');
  if (btn) btn.remove();
  document.getElementById('validation-box').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════════
// BULK RESULTS RENDERING
// ═══════════════════════════════════════════════════════════════
function getPeakFraudHour(fraudRows) {
  if (!fraudRows.length) return null;
  const buckets = Array(24).fill(0);
  fraudRows.forEach(r => {
    buckets[Math.floor((Math.abs(r.time) % 86400) / 3600)]++;
  });
  const maxIdx = buckets.indexOf(Math.max(...buckets));
  return { hour: maxIdx, count: buckets[maxIdx] };
}

function getAvgFraudAmount(fraudRows) {
  if (!fraudRows.length) return 0;
  return fraudRows.reduce((s, r) => s + r.amount, 0) / fraudRows.length;
}

function renderBulkResults() {
  const results   = State.bulkResults;
  const fraudRows = results.filter(r => r.isFraud);
  const legitRows = results.filter(r => !r.isFraud);
  const totalAmt  = fraudRows.reduce((s, r) => s + r.amount, 0);
  const topRisk   = [...fraudRows].sort((a, b) => b.prob - a.prob)[0];
  const peakHour  = getPeakFraudHour(fraudRows);
  const avgFraud  = getAvgFraudAmount(fraudRows);
  const highRisk  = fraudRows.filter(r => r.prob > 0.80).length;

  document.getElementById('bulk-summary').innerHTML = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Transactions</div>
        <div class="summary-val accent">${results.length.toLocaleString()}</div>
        <div class="summary-sub">processed</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Flagged as Fraud</div>
        <div class="summary-val red">${fraudRows.length.toLocaleString()}</div>
        <div class="summary-sub">${highRisk} high-risk (&gt;80%)</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Fraud Rate</div>
        <div class="summary-val">${(fraudRows.length / results.length * 100).toFixed(2)}%</div>
        <div class="summary-sub">${legitRows.length.toLocaleString()} legitimate</div>
      </div>
      <div class="summary-card highlight">
        <div class="summary-label">Amount at Risk</div>
        <div class="summary-val accent">${formatAmount(totalAmt)}</div>
        <div class="summary-sub">${formatAmountFull(totalAmt)}</div>
      </div>
    </div>

    <div class="summary-grid" style="margin-top:10px;">
      <div class="summary-card">
        <div class="summary-label">Avg Fraud Amount</div>
        <div class="summary-val" style="font-size:20px;">
          ${fraudRows.length ? formatAmount(avgFraud) : '—'}
        </div>
        <div class="summary-sub">per flagged transaction</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Peak Fraud Hour</div>
        <div class="summary-val" style="font-size:20px;">
          ${peakHour ? peakHour.hour + ':00' : '—'}
        </div>
        <div class="summary-sub">${peakHour ? peakHour.count + ' transactions' : 'no fraud detected'}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Detection Threshold</div>
        <div class="summary-val" style="font-size:20px;">${State.bulkThreshold}</div>
        <div class="summary-sub">fraud probability cutoff</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Legit Rate</div>
        <div class="summary-val" style="font-size:20px;color:var(--green);">
          ${(legitRows.length / results.length * 100).toFixed(1)}%
        </div>
        <div class="summary-sub">${legitRows.length.toLocaleString()} safe transactions</div>
      </div>
    </div>

    ${topRisk ? `
    <div class="top-risk-bar">
      🔴 <strong>HIGHEST RISK:</strong> ${topRisk.id}
      &nbsp;·&nbsp; ${formatAmountFull(topRisk.amount)}
      &nbsp;·&nbsp; <strong style="color:var(--red)">${(topRisk.prob*100).toFixed(1)}% confidence</strong>
      &nbsp;·&nbsp; <span style="color:var(--text3)">Needs immediate action</span>
    </div>` : ''}
    <hr class="divider" />`;

  renderAllCharts('bulk-charts', results, State.bulkThreshold);
  renderTable();

  // Downloads — email card removed, JSON added
  document.getElementById('bulk-downloads').innerHTML = `
    <div class="download-section">
      <div class="download-title">📥 Export Results</div>
      <div class="download-grid">
        <div class="download-card" onclick="downloadFlagged()">
          <div class="download-card-icon">📄</div>
          <div class="download-card-title">Flagged Transactions</div>
          <div class="download-card-sub">CSV · ${fraudRows.length} rows · For case management</div>
        </div>
        <div class="download-card" onclick="downloadFull()">
          <div class="download-card-icon">📊</div>
          <div class="download-card-title">Full Results</div>
          <div class="download-card-sub">CSV · All ${results.length.toLocaleString()} rows + probability</div>
        </div>
        <div class="download-card" onclick="downloadJSON()">
          <div class="download-card-icon">🗂️</div>
          <div class="download-card-title">Export as JSON</div>
          <div class="download-card-sub">JSON · Full results with metadata</div>
        </div>
        <div class="download-card" onclick="openPDFReport()">
          <div class="download-card-icon">📑</div>
          <div class="download-card-title">PDF Summary Report</div>
          <div class="download-card-sub">For management presentation</div>
        </div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// TABLE
// ═══════════════════════════════════════════════════════════════
function renderTable() {
  const threshold = State.bulkThreshold;
  let filtered    = State.bulkResults;

  if      (State.filterMode === 'fraud') filtered = filtered.filter(r => r.isFraud);
  else if (State.filterMode === 'legit') filtered = filtered.filter(r => !r.isFraud);
  else if (State.filterMode === 'high')  filtered = filtered.filter(r => r.prob > 0.80);

  if (State.searchQuery) {
    const q = State.searchQuery.toLowerCase();
    filtered = filtered.filter(r => r.id.toLowerCase().includes(q));
  }

  filtered = [...filtered].sort((a, b) => {
    const dir = State.sortDir;
    if (State.sortCol === 'prob')   return dir * (b.prob - a.prob);
    if (State.sortCol === 'amount') return dir * (b.amount - a.amount);
    if (State.sortCol === 'time')   return dir * (b.time - a.time);
    return 0;
  });

  const total    = filtered.length;
  const pages    = Math.max(1, Math.ceil(total / State.PAGE_SIZE));
  State.currentPage = Math.min(State.currentPage, pages);
  const start    = (State.currentPage - 1) * State.PAGE_SIZE;
  const pageRows = filtered.slice(start, start + State.PAGE_SIZE);

  const fraudCount = State.bulkResults.filter(r => r.isFraud).length;
  const allCount   = State.bulkResults.length;
  const highCount  = State.bulkResults.filter(r => r.prob > 0.80).length;
  const legitCount = State.bulkResults.filter(r => !r.isFraud).length;

  const arrow = col => State.sortCol === col ? (State.sortDir === -1 ? ' ↓' : ' ↑') : ' ↕';

  const rowsHTML = pageRows.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px;">
         No transactions match the current filter
       </td></tr>`
    : pageRows.map(r => {
        const risk    = getRiskInfo(r.prob, threshold);
        const probPct = (r.prob * 100).toFixed(1);
        return `
          <tr>
            <td style="font-family:var(--font-mono);font-size:12px;color:var(--text2)">${r.id}</td>
            <td><strong>${formatAmountFull(r.amount)}</strong></td>
            <td style="font-family:var(--font-mono);font-size:12px;color:var(--text2)">${formatTime(r.time)}</td>
            <td>
              <div class="prob-bar-wrap">
                <div class="prob-bar">
                  <div class="prob-fill" style="width:${probPct}%;background:${risk.color}"></div>
                </div>
                <span class="prob-text" style="color:${risk.color}">${probPct}%</span>
              </div>
            </td>
            <td><span class="risk-badge ${risk.cssClass}">${risk.label}</span></td>
            <td>
              <select class="action-select" onchange="updateAction('${r.id}',this.value)">
                <option value="pending"    ${r.action==='pending'    ?'selected':''}>⏳ Pending</option>
                <option value="block"      ${r.action==='block'      ?'selected':''}>🚫 Block</option>
                <option value="investigate"${r.action==='investigate'?'selected':''}>🔎 Investigate</option>
                <option value="legit"      ${r.action==='legit'      ?'selected':''}>✅ Mark Legit</option>
                <option value="escalate"   ${r.action==='escalate'   ?'selected':''}>📤 Escalate</option>
              </select>
            </td>
          </tr>`;
      }).join('');

  const maxPageBtns = 5;
  const startPage = Math.max(1, Math.min(pages - maxPageBtns + 1, State.currentPage - 2));
  const endPage   = Math.min(pages, startPage + maxPageBtns - 1);
  let pageBtnsHTML = `
    <button class="page-btn" onclick="changePage(-1)"
      ${State.currentPage <= 1 ? 'disabled' : ''}>‹</button>`;
  for (let p = startPage; p <= endPage; p++) {
    pageBtnsHTML += `<button class="page-btn${p === State.currentPage ? ' active' : ''}"
        onclick="goToPage(${p})">${p}</button>`;
  }
  pageBtnsHTML += `<button class="page-btn" onclick="changePage(1)"
      ${State.currentPage >= pages ? 'disabled' : ''}>›</button>`;

  document.getElementById('bulk-table-section').innerHTML = `
    <div class="table-header">
      <div style="font-weight:700;font-size:15px;">
        🚨 Transaction Results
        <span style="color:var(--red);font-family:var(--font-mono);font-size:13px;">
          (${fraudCount} fraud flagged)
        </span>
      </div>
      <div class="table-controls">
        <input class="search-input" placeholder="Search TXN ID…"
          value="${State.searchQuery}" oninput="tableSearch(this.value)" />
        <select class="filter-select" onchange="tableFilter(this.value)">
          <option value="all"   ${State.filterMode==='all'   ?'selected':''}>All (${allCount})</option>
          <option value="fraud" ${State.filterMode==='fraud' ?'selected':''}>Fraud (${fraudCount})</option>
          <option value="high"  ${State.filterMode==='high'  ?'selected':''}>High Risk (${highCount})</option>
          <option value="legit" ${State.filterMode==='legit' ?'selected':''}>Legit (${legitCount})</option>
        </select>
        <button class="btn btn-secondary" style="padding:8px 14px;font-size:12px;"
          onclick="downloadFlagged()">↓ Flagged CSV</button>
      </div>
    </div>

    <div style="display:flex;gap:10px;padding:10px 0;flex-wrap:wrap;align-items:center;">
      <span style="font-size:12px;color:var(--text3);">Batch actions:</span>
      <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;"
        onclick="batchAction('block')">🚫 Block All Fraud</button>
      <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;"
        onclick="batchAction('investigate')">🔎 Investigate All Fraud</button>
      <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;"
        onclick="batchAction('pending')">↩ Reset All Actions</button>
      <span style="font-size:12px;color:var(--text3);margin-left:auto;">
        ${fraudCount} flagged · ${allCount - fraudCount} clear
      </span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th onclick="tableSort('id')">TXN ID</th>
            <th onclick="tableSort('amount')">AMOUNT${arrow('amount')}</th>
            <th onclick="tableSort('time')">TIME${arrow('time')}</th>
            <th onclick="tableSort('prob')">PROBABILITY${arrow('prob')}</th>
            <th>RISK</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>

    <div class="pagination">
      <div class="page-info">
        Showing ${total === 0 ? 0 : start + 1}–${Math.min(start + State.PAGE_SIZE, total)}
        of ${total.toLocaleString()}
      </div>
      <div class="page-btns">${pageBtnsHTML}</div>
    </div>`;
}

function batchAction(action) {
  const targets = action === 'pending'
    ? State.bulkResults
    : State.bulkResults.filter(r => r.isFraud);
  targets.forEach(r => r.action = action);
  renderTable();
  const label = action === 'block' ? 'Blocked'
              : action === 'investigate' ? 'set to Investigate'
              : 'reset to Pending';
  showToast(`✓ ${targets.length} transactions ${label}`);
}

function tableSort(col) {
  if (State.sortCol === col) State.sortDir *= -1;
  else { State.sortCol = col; State.sortDir = -1; }
  State.currentPage = 1;
  renderTable();
}
function tableFilter(val) { State.filterMode = val; State.currentPage = 1; renderTable(); }
function tableSearch(val) { State.searchQuery = val; State.currentPage = 1; renderTable(); }
function changePage(delta) { State.currentPage += delta; renderTable(); }
function goToPage(p)       { State.currentPage = p; renderTable(); }

function updateAction(id, val) {
  const row = State.bulkResults.find(r => r.id === id);
  if (row) { row.action = val; showToast('✓ Action updated: ' + id); }
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 1 — TRANSACTION HISTORY
// ═══════════════════════════════════════════════════════════════

function pushToHistory(entry) {
  const record = {
    id:        'TXN_' + String(State.txnHistory.length + 1).padStart(4, '0'),
    timestamp: new Date().toLocaleTimeString(),
    amount:    entry.amount,
    time:      entry.time,
    prob:      entry.prob,
    threshold: entry.threshold,
    isFraud:   entry.prob > entry.threshold,
    risk:      entry.prob > 0.80 ? 'HIGH'
             : entry.prob > 0.50 ? 'MED'
             : entry.prob > entry.threshold ? 'LOW'
             : 'LEGIT',
  };
  State.txnHistory.unshift(record); // newest first

  // Show the nav history button and update badge
  const navBtn = document.getElementById('history-nav-btn');
  const navCount = document.getElementById('history-nav-count');
  if (navBtn) {
    navBtn.style.display = 'inline-flex';
    navCount.textContent = '(' + State.txnHistory.length + ')';
  }
}

function showHistoryPage() {
  renderHistoryPage();
  showPage('history');
}

function renderHistoryPage() {
  const container = document.getElementById('history-content');
  if (!container) return;

  if (!State.txnHistory.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text3);">
        <div style="font-size:40px;margin-bottom:16px;">🕘</div>
        <div style="font-size:16px;margin-bottom:8px;">No history yet</div>
        <div style="font-size:13px;">Run some Single Check transactions — they'll appear here.</div>
        <button class="btn btn-primary" style="margin-top:20px;"
          onclick="showPage('single')">🔍 Go to Single Check</button>
      </div>`;
    return;
  }

  const fraudCount = State.txnHistory.filter(r => r.isFraud).length;
  const legitCount = State.txnHistory.length - fraudCount;
  const totalAmt   = State.txnHistory.reduce((s, r) => s + r.amount, 0);

  const rowsHTML = State.txnHistory.map((r, idx) => {
    const color = r.prob > 0.80 ? 'var(--red)'
                : r.prob > 0.50 ? 'var(--yellow)'
                : r.isFraud     ? 'var(--orange)'
                : 'var(--green)';
    const badge = r.isFraud
      ? `<span class="risk-badge risk-${r.risk.toLowerCase()}">${r.isFraud ? '🔴' : '🟢'} ${r.risk}</span>`
      : `<span class="risk-badge risk-legit">🟢 LEGIT</span>`;
    const probPct = (r.prob * 100).toFixed(1);
    return `
      <tr>
        <td style="font-family:var(--font-mono);font-size:12px;color:var(--text2)">${r.id}</td>
        <td style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">${r.timestamp}</td>
        <td><strong>₹${r.amount.toFixed(2)}</strong></td>
        <td style="font-family:var(--font-mono);font-size:12px;color:var(--text2)">${formatTime(r.time)}</td>
        <td>
          <div class="prob-bar-wrap">
            <div class="prob-bar">
              <div class="prob-fill" style="width:${probPct}%;background:${color}"></div>
            </div>
            <span class="prob-text" style="color:${color}">${probPct}%</span>
          </div>
        </td>
        <td>${badge}</td>
        <td style="font-family:var(--font-mono);font-size:11px;color:var(--text3)">${r.threshold}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <!-- Mini summary row -->
    <div class="summary-grid" style="margin-bottom:20px;">
      <div class="summary-card">
        <div class="summary-label">Total Checked</div>
        <div class="summary-val accent">${State.txnHistory.length}</div>
        <div class="summary-sub">this session</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Fraud Flagged</div>
        <div class="summary-val red">${fraudCount}</div>
        <div class="summary-sub">${legitCount} legitimate</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Amount</div>
        <div class="summary-val" style="font-size:20px;">₹${totalAmt.toFixed(2)}</div>
        <div class="summary-sub">across all checks</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Fraud Rate</div>
        <div class="summary-val" style="font-size:20px;">
          ${(fraudCount / State.txnHistory.length * 100).toFixed(0)}%
        </div>
        <div class="summary-sub">of checked transactions</div>
      </div>
    </div>

    <!-- Action row -->
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
      <button class="btn btn-secondary" style="font-size:12px;"
        onclick="exportHistoryCSV()">↓ Export History CSV</button>
      <button class="btn btn-secondary" style="font-size:12px;"
        onclick="clearHistory()">🗑 Clear History</button>
      <button class="btn btn-secondary" style="font-size:12px;margin-left:auto;"
        onclick="showPage('single')">+ New Check</button>
    </div>

    <!-- History table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>TIME (checked)</th>
            <th>AMOUNT</th>
            <th>TXN TIME</th>
            <th>PROBABILITY</th>
            <th>VERDICT</th>
            <th>THRESHOLD</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>`;
}

function clearHistory() {
  if (!State.txnHistory.length) return;
  State.txnHistory = [];
  const navBtn   = document.getElementById('history-nav-btn');
  if (navBtn) navBtn.style.display = 'none';
  renderHistoryPage();
  showToast('✓ History cleared');
}

function exportHistoryCSV() {
  if (!State.txnHistory.length) { showToast('No history to export'); return; }
  const rows = State.txnHistory.map(r => ({
    id:                r.id,
    checked_at:        r.timestamp,
    amount:            r.amount.toFixed(2),
    txn_time:          formatTime(r.time),
    fraud_probability: (r.prob * 100).toFixed(2) + '%',
    verdict:           r.isFraud ? 'FRAUD' : 'LEGIT',
    risk_level:        r.risk,
    threshold:         r.threshold,
  }));
  const csv = rowsToCSV(rows, Object.keys(rows[0]));
  downloadCSVFile(csv, 'fraudguard_history_' + Date.now() + '.csv');
  showToast(`✓ Exported ${State.txnHistory.length} history records`);
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 2 — VISUAL PROBABILITY BREAKDOWN (on-demand per result)
// ═══════════════════════════════════════════════════════════════

// Track Chart instance so we can destroy on re-render
let _probChartInstance = null;

function toggleVisualProb(prob, threshold) {
  const wrapper = document.getElementById('visual-prob-wrapper');
  if (!wrapper) return;

  const isVisible = wrapper.style.display !== 'none';
  if (isVisible) {
    wrapper.style.display = 'none';
    const btn = document.getElementById('visual-prob-btn');
    if (btn) btn.textContent = '📊 Show Visual Breakdown';
    return;
  }

  wrapper.style.display = 'block';
  const btn = document.getElementById('visual-prob-btn');
  if (btn) btn.textContent = '📊 Hide Visual Breakdown';

  const fraudPct  = parseFloat((prob * 100).toFixed(2));
  const legitPct  = parseFloat(((1 - prob) * 100).toFixed(2));
  const isFraud   = prob > threshold;

  // Destroy previous chart if exists
  if (_probChartInstance) { _probChartInstance.destroy(); _probChartInstance = null; }

  const ctx = document.getElementById('prob-visual-chart');
  if (!ctx) return;

  _probChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Fraud Probability', 'Legit Probability'],
      datasets: [{
        data: [fraudPct, legitPct],
        backgroundColor: [
          isFraud ? 'rgba(255,61,87,0.75)' : 'rgba(255,145,0,0.65)',
          'rgba(0,230,118,0.65)',
        ],
        borderColor: [
          isFraud ? 'rgba(255,61,87,0.4)' : 'rgba(255,145,0,0.4)',
          'rgba(0,230,118,0.3)',
        ],
        borderWidth: 1,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '60%',
      animation: { duration: 700 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#8b90a0',
            font: { family: 'DM Mono, monospace', size: 11 },
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: '#181b22',
          borderColor: '#252934',
          borderWidth: 1,
          titleColor: '#e8eaf0',
          bodyColor: '#8b90a0',
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(2)}%`,
          },
        },
      },
    },
    plugins: [{
      // Centre label showing fraud %
      id: 'centreLabel',
      beforeDraw(chart) {
        const { width, height, ctx: c } = chart;
        c.save();
        const fontSize = Math.min(width, height) * 0.13;
        c.font = `600 ${fontSize}px DM Mono, monospace`;
        c.fillStyle = isFraud ? '#ff3d57' : '#00e676';
        c.textAlign    = 'center';
        c.textBaseline = 'middle';
        const cx = width / 2;
        const cy = height / 2 - fontSize * 0.3;
        c.fillText(fraudPct + '%', cx, cy);
        c.font = `400 ${fontSize * 0.55}px DM Sans, sans-serif`;
        c.fillStyle = '#8b90a0';
        c.fillText('fraud prob', cx, cy + fontSize * 0.85);
        c.restore();
      },
    }],
  });
}

// ═══════════════════════════════════════════════════════════════
// DOWNLOADS
// ═══════════════════════════════════════════════════════════════
function downloadFlagged() {
  const fraud = State.bulkResults.filter(r => r.isFraud);
  if (!fraud.length) { showToast('No fraud transactions to export'); return; }
  const rows = fraud.map(r => ({
    transaction_id:    r.id,
    amount:            r.amount.toFixed(2),
    time_seconds:      r.time.toFixed(0),
    time_of_day:       formatTime(r.time),
    fraud_probability: (r.prob * 100).toFixed(2) + '%',
    risk_level:        r.prob > 0.8 ? 'HIGH' : r.prob > 0.5 ? 'MEDIUM' : 'LOW',
    action:            r.action,
  }));
  downloadCSVFile(rowsToCSV(rows, Object.keys(rows[0])),
    'fraudguard_flagged_' + Date.now() + '.csv');
  showToast(`✓ Downloaded ${fraud.length} flagged transactions`);
}

function downloadFull() {
  const rows = State.bulkResults.map(r => ({
    transaction_id:    r.id,
    amount:            r.amount.toFixed(2),
    time_seconds:      r.time.toFixed(0),
    fraud_probability: (r.prob * 100).toFixed(2) + '%',
    prediction:        r.isFraud ? 'FRAUD' : 'LEGIT',
    action:            r.action,
  }));
  downloadCSVFile(rowsToCSV(rows, Object.keys(rows[0])),
    'fraudguard_full_' + Date.now() + '.csv');
  showToast(`✓ Downloaded all ${State.bulkResults.length.toLocaleString()} results`);
}

function downloadJSON() {
  const fraud    = State.bulkResults.filter(r => r.isFraud);
  const totalAmt = fraud.reduce((s, r) => s + r.amount, 0);
  const payload  = {
    meta: {
      generated:     new Date().toISOString(),
      model:         'XGBoost',
      threshold:     State.bulkThreshold,
      total:         State.bulkResults.length,
      fraud_count:   fraud.length,
      fraud_rate:    (fraud.length / State.bulkResults.length * 100).toFixed(2) + '%',
      amount_at_risk: parseFloat(totalAmt.toFixed(2)),
    },
    results: State.bulkResults.map(r => ({
      id:          r.id,
      amount:      parseFloat(r.amount.toFixed(2)),
      time:        parseFloat(r.time.toFixed(0)),
      probability: r.prob,
      is_fraud:    r.isFraud,
      risk:        r.prob > 0.8 ? 'HIGH' : r.prob > 0.5 ? 'MEDIUM' : r.isFraud ? 'LOW' : 'LEGIT',
      action:      r.action,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'fraudguard_results_' + Date.now() + '.json';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(`✓ JSON exported — ${State.bulkResults.length} records`);
}

function openPDFReport() {
  const results   = State.bulkResults;
  const fraud     = results.filter(r => r.isFraud);
  const totalAmt  = fraud.reduce((s, r) => s + r.amount, 0);
  const topRisk   = [...fraud].sort((a, b) => b.prob - a.prob)[0];
  const now       = new Date().toLocaleString();
  const threshold = State.bulkThreshold;
  const peakHour  = getPeakFraudHour(fraud);
  const avgFraud  = getAvgFraudAmount(fraud);

  const topRowsHTML = fraud.slice(0, 20).map(r => `
    <tr>
      <td style="font-family:monospace">${r.id}</td>
      <td>${formatAmountFull(r.amount)}</td>
      <td>${formatTime(r.time)}</td>
      <td>${(r.prob * 100).toFixed(1)}%</td>
      <td><span style="background:#ffebee;color:#c62828;padding:2px 8px;
        border-radius:10px;font-size:11px;font-weight:600;">FRAUD</span></td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html><head><title>FraudGuard Report</title>
<style>
  body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:720px;margin:0 auto}
  h1{font-size:24px;margin-bottom:4px}
  .sub{color:#666;font-size:13px;margin-bottom:32px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
  .card{border:1px solid #ddd;border-radius:8px;padding:18px}
  .val{font-size:26px;font-weight:800}
  .lbl{font-size:11px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px}
  .red{color:#e53935}.blue{color:#1565c0}
  .alert{border:1px solid #ffcdd2;background:#fff8f8;border-radius:8px;padding:16px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}
  th{background:#f5f5f5;padding:8px 12px;text-align:left;font-size:11px;color:#888;
     text-transform:uppercase;border-bottom:1px solid #ddd}
  td{padding:8px 12px;border-bottom:1px solid #eee}
  .footer{margin-top:40px;color:#aaa;font-size:11px;border-top:1px solid #eee;padding-top:20px}
</style></head><body>
<h1>🔒 FraudGuard — Analysis Report</h1>
<div class="sub">Generated: ${now} &nbsp;·&nbsp; Model: XGBoost &nbsp;·&nbsp; Threshold: ${threshold}</div>
<div class="grid">
  <div class="card"><div class="lbl">Total Transactions</div>
    <div class="val blue">${results.length.toLocaleString()}</div></div>
  <div class="card"><div class="lbl">Fraud Detected</div>
    <div class="val red">${fraud.length.toLocaleString()}</div></div>
  <div class="card"><div class="lbl">Fraud Rate</div>
    <div class="val">${(fraud.length/results.length*100).toFixed(2)}%</div></div>
  <div class="card"><div class="lbl">Amount at Risk</div>
    <div class="val red">${formatAmountFull(totalAmt)}</div></div>
  <div class="card"><div class="lbl">Avg Fraud Amount</div>
    <div class="val">${fraud.length ? formatAmountFull(avgFraud) : '—'}</div></div>
  <div class="card"><div class="lbl">Peak Fraud Hour</div>
    <div class="val">${peakHour ? peakHour.hour + ':00' : '—'}</div></div>
</div>
${topRisk ? `<div class="alert">
  <div class="lbl">⚠️ Highest Risk Transaction</div>
  <strong>${topRisk.id}</strong> &nbsp;·&nbsp; ${formatAmountFull(topRisk.amount)}
  &nbsp;·&nbsp; <strong>${(topRisk.prob*100).toFixed(1)}% confidence</strong>
</div>` : ''}
<h3>Top Flagged Transactions (up to 20)</h3>
<table>
  <tr><th>TXN ID</th><th>Amount</th><th>Time</th><th>Probability</th><th>Status</th></tr>
  ${topRowsHTML}
</table>
<div class="footer">
  Report generated by FraudGuard · XGBoost model · Kaggle Credit Card Fraud dataset (284,807 transactions).
  All predictions are probabilistic and should be reviewed before taking action.
</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
  showToast('✓ PDF report opened — Print → Save as PDF');
}
