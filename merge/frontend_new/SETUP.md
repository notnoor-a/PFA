# Setup & Run Guide

This replaces the old broken backend. The pipeline is now:

```
 React (browser)
    └── gets Firebase ID token from logged-in user
    └── POST /predict  with symptoms + Bearer token
         ↓
 Express backend (this folder)
    ├── verifies token via Firebase Admin SDK
    ├── runs local ML model (predict.py) for a quick hint
    ├── asks Gemini for a structured differential diagnosis
    ├── saves everything to Firestore under collection `diagnoses`
    └── returns { aiResult, mlHint, id } to the frontend
```

---

## 1. Train the ML model

The dataset's target column is `prognosis` (the old train.py used `disease` — that was the first bug). The new `train.py` also saves feature names alongside the model so predictions don't rely on column order.

```bash
cd ml
pip install pandas scikit-learn joblib
python train.py
# → writes ../backend/model.pkl
```

> **Note on accuracy:** `Testing.csv` only has **42 rows with 41 unique diseases** (1 row per class). The training script handles this gracefully but the model will be near-random on real input. That's why the backend pairs it with Gemini's analysis — Gemini does the real work and the ML model is a secondary signal. For a usable model, swap `Testing.csv` for the Kaggle "Disease Symptom Prediction" Training.csv (4920 rows, same schema).

## 2. Set up Firebase Admin credentials

In the Firebase Console:

1. Go to **Project Settings → Service accounts**.
2. Click **Generate new private key** → download the JSON.
3. Save the file as `backend/firebase-service-account.json` (it's already in `.gitignore` territory — **do not commit it**).

## 3. Configure the backend

```bash
cd backend
cp .env.example .env
# edit .env:
#   GEMINI_API_KEY=...
#   GEMINI_MODEL=gemini-2.0-flash   # optional
#   GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
#   FIREBASE_PROJECT_ID=pfa-project-8a5b5
npm install
npm run dev       # or: npm start
```

The server prints its status on startup:

```
✅ Firebase Admin initialized
🚀 Server running on http://localhost:3001
```

You can hit `http://localhost:3001/health` to see which pieces are wired up:

```json
{ "status": "ok", "firebase": true, "gemini": true, "mlModel": true }
```

## 4. Configure the frontend

Add to the frontend `.env` (at the repo root, next to `package.json`):

```
VITE_API_URL=http://localhost:3001
```

And **do not add** any `VITE_GEMINI_API_KEY` — the key now lives server-side only.

Then:

```bash
npm install
npm run dev
```

## 5. Deploy the Firestore rules

```bash
# one-time
npm install -g firebase-tools
firebase login
firebase use pfa-project-3ec22

# every time you change firestore.rules
firebase deploy --only firestore:rules
```

---

## File map

| Path | Status |
|---|---|
| `backend/package.json` | **new** — was missing, only a lockfile existed |
| `backend/server.js` | **rewritten** — adds auth, AI, Firestore |
| `backend/predict.py` | **rewritten** — maps symptom names properly, outputs JSON |
| `backend/.env.example` | **new** |
| `ml/train.py` | **fixed** — uses `prognosis` column, saves feature names |
| `src/lib/api.js` | **new** — attaches Firebase ID token to every request |
| `src/pages/Dashboard.jsx` | **rewritten** — calls `/predict` instead of direct browser AI calls |
| `src/pages/History.jsx` | **rewritten** — reads from `/history` instead of localStorage |
| `firestore.rules` | **new** |

---

## How it works end-to-end

**User clicks "Analyze":**
1. `Dashboard.jsx` builds `[...selected]` and calls `apiFetch("/predict", { body: { symptoms } })`.
2. `apiFetch` grabs `auth.currentUser.getIdToken()` and sends it as `Authorization: Bearer …`.
3. `server.js` middleware `requireAuth` calls `admin.auth().verifyIdToken(token)` → gets `uid`.
4. `runMlModel` spawns `predict.py`, which normalizes each symptom (`"Shortness of breath"` → `breathlessness`), builds a 132-length vector, and returns the top-3 predictions with confidences.
5. `runAiAnalysis` calls Gemini (with the ML prediction as a hint) and gets back structured `{ conditions, advice, urgency, disclaimer }`.
6. The combined result is saved to Firestore: `diagnoses/{autoId}` with `{ uid, symptoms, aiResult, mlHint, createdAt }`.
7. Response goes back to the dashboard, which renders it and pulls a later `/history` call to see it in the list.

**Graceful degradation:**
- Missing Gemini key → rule-based fallback kicks in, app still works.
- Missing `model.pkl` → just skip the ML hint, Gemini alone answers.
- Missing Firebase creds → `/predict` and `/history` return 503, but `/health` still tells you what's wrong.
