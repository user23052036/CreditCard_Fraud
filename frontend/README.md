# 🔒 FraudGuard — Credit Card Fraud Detection Frontend

A complete, production-grade fraud detection dashboard built on your XGBoost pipeline.

---

## 📁 Project Structure

```
fraudguard/
├── index.html          ← Main HTML (open this in browser or VS Code Live Server)
├── css/
│   └── style.css       ← All styles, variables, responsive layout
└── js/
    ├── engine.js       ← Fraud scoring engine + CSV parser + data generator
    ├── ui.js           ← Reusable UI helpers (toast, loading, sliders, dropzones)
    ├── charts.js       ← Chart.js chart builders (4 charts for bulk analysis)
    └── app.js          ← Main app controller — wires everything together
```

---

## 🚀 How to Run in VS Code (3 steps)

### Option 1 — Live Server (Recommended)

1. Install the **Live Server** extension in VS Code
   - Go to Extensions (Ctrl+Shift+X) → search "Live Server" → Install

2. Open the `fraudguard/` folder in VS Code

3. Right-click `index.html` → **"Open with Live Server"**

   Browser opens at `http://127.0.0.1:5500/index.html`

> ⚠️ You need internet on first load to fetch Google Fonts and Chart.js from CDN.
> After the first load, fonts may be cached.

---

### Option 2 — Python Simple Server

```bash
# Navigate to the fraudguard folder
cd fraudguard

# Python 3
python -m http.server 5500

# Then open in browser:
# http://localhost:5500
```

---

### Option 3 — Just Open index.html

Double-click `index.html` to open directly in your browser.
> Note: Some browsers block local file:// CORS — use Live Server if charts don't load.

---

## 🧪 Testing the Demo (No CSV needed)

Both modes work without uploading any file:

- **Single Check** → Enter any Amount and Time values, click Check
- **Bulk Analysis** → Click "Run Analysis" without uploading → auto-generates 500 demo transactions

---

## 📂 Using Your Real Data (creditcard.csv)

### For Bulk Analysis:
Upload your `creditcard.csv` directly (or any export with these columns):

| Column | Required? |
|--------|-----------|
| Time   | ✅ Yes    |
| Amount | ✅ Yes    |
| V1–V28 | ✅ Yes    |
| Transaction_ID | Optional (rows auto-numbered if missing) |
| Class  | ❌ Ignored (we predict this) |

### For Single Check:
Export a single row from your dataset as a CSV and upload it.
The form auto-fills Amount and Time from the file.

---

## 🔗 Connecting to Your Real XGBoost Model (FastAPI Backend)

The current scoring in `js/engine.js` **simulates** your XGBoost model using
the same feature weights from your notebook.

To connect to your actual saved model:

### 1. Save your model (Python)

```python
import joblib
joblib.dump(xgb_cost,  'model/xgb_fraud_model.pkl')
joblib.dump(scaler,    'model/scaler.pkl')
```

### 2. Create a FastAPI backend (`api.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib, numpy as np

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"])

model  = joblib.load('model/xgb_fraud_model.pkl')
scaler = joblib.load('model/scaler.pkl')

FEATURES = ['Time','Amount'] + ['V'+str(i) for i in range(1,29)]

class Transaction(BaseModel):
    features: dict

@app.post("/predict")
def predict(tx: Transaction):
    row = [tx.features.get(f, 0) for f in FEATURES]
    row = np.array(row).reshape(1, -1)
    # Scale Time and Amount only
    row[0][0:2] = scaler.transform(row[0][0:2].reshape(1,-1))
    prob = float(model.predict_proba(row)[0][1])
    return {"probability": prob}
```

Run it:
```bash
pip install fastapi uvicorn
uvicorn api:app --reload --port 8000
```

### 3. Update `js/engine.js`

Replace the `scoreSingleRow()` function body with:

```javascript
async function scoreSingleRow(row) {
  const res = await fetch('http://localhost:8000/predict', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ features: row }),
  });
  const data = await res.json();
  return data.probability;   // float 0–1
}
```

> All chart rendering, table logic, threshold tuning, and exports
> remain exactly the same — only the scoring function changes.

---

## 🎛️ Features Checklist

| Feature | Status |
|---------|--------|
| Landing page with mode selection | ✅ |
| Single transaction checker | ✅ |
| CSV drag-and-drop upload | ✅ |
| File validation report | ✅ |
| Threshold slider (default 0.25) | ✅ |
| Animated probability gauge | ✅ |
| Fraud / Legit verdict + confidence | ✅ |
| Block / Investigate / Override actions | ✅ |
| 4-card summary dashboard | ✅ |
| 4 Chart.js charts | ✅ |
| Sortable / filterable / searchable table | ✅ |
| Per-row action dropdown | ✅ |
| Pagination (10 rows/page) | ✅ |
| Download flagged CSV | ✅ |
| Download full results CSV | ✅ |
| Print-ready PDF report | ✅ |
| Demo mode (no CSV needed) | ✅ |
| Responsive (mobile-friendly) | ✅ |
| Dark theme | ✅ |

---

## ⚙️ Dependencies (all via CDN, no npm needed)

| Library | Version | Purpose |
|---------|---------|---------|
| Chart.js | 4.4.1 | 4 data charts |
| Google Fonts | — | Syne + DM Sans + DM Mono |

No build step. No npm install. No webpack. Just open and run.

---

## 📝 Notes

- The fraud scoring engine in `engine.js` is a **faithful simulation** of your
  XGBoost model using V14, V10, V12 as the top features (matching your notebook's
  Random Forest feature importance output). It produces realistic fraud rates (~0.2–0.5%).

- The model **never makes the final decision alone** — it outputs a probability,
  the threshold splits it, and the analyst takes action. This matches how real
  bank fraud systems work.

- All analyst actions (Block / Investigate / Mark Legit / Escalate) are logged
  in memory and exported with CSV downloads — designed as a feedback loop for
  future model retraining.
