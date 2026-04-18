require("dotenv").config();

const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");

/* ─────────────────────────────────────────────────────────────
 *  Firebase Admin init
 *  Two ways to provide credentials:
 *    1. GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
 *    2. FIREBASE_SERVICE_ACCOUNT='{"type":"service_account", ...}'
 * ───────────────────────────────────────────────────────────── */
function initFirebase() {
  if (admin.apps.length) return;

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(svc),
        projectId: svc.project_id || process.env.FIREBASE_PROJECT_ID,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const p = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      if (!fs.existsSync(p)) {
        throw new Error(`Service account file not found at ${p}`);
      }
      admin.initializeApp({
        credential: admin.credential.cert(require(p)),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      // Fallback: application default creds (e.g. on GCP)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase Admin init failed:", err.message);
    console.error(
      "   The server will still run, but /predict and /history will reject requests."
    );
  }
}
initFirebase();

const db = admin.apps.length ? admin.firestore() : null;

/* ─────────────────────────────────────────────────────────────
 *  Anthropic client
 * ───────────────────────────────────────────────────────────── */
const anthropicKey = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropicConfigured =
  anthropicKey.startsWith("sk-ant-") &&
  !anthropicKey.toLowerCase().includes("replace_me");

const anthropic = anthropicConfigured
  ? new Anthropic({ apiKey: anthropicKey })
  : null;

if (!anthropicConfigured) {
  console.warn(
    "⚠️  ANTHROPIC_API_KEY not configured — AI analysis will use the local fallback."
  );
}

/* ─────────────────────────────────────────────────────────────
 *  Express app
 * ───────────────────────────────────────────────────────────── */
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* ─── Auth middleware: verifies Firebase ID token ─── */
async function requireAuth(req, res, next) {
  if (!admin.apps.length) {
    return res
      .status(503)
      .json({ error: "Server auth is not configured. Check FIREBASE_* env." });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ error: "Missing Authorization: Bearer <firebase-id-token>" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // { uid, email, ... }
    next();
  } catch (err) {
    console.error("Token verify failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* ─────────────────────────────────────────────────────────────
 *  ML model — run the trained Python model in a child process
 *  Returns { disease, confidence, topK } or null on failure
 * ───────────────────────────────────────────────────────────── */
function runMlModel(symptoms) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "predict.py");
    const modelPath = path.join(__dirname, "model.pkl");

    if (!fs.existsSync(modelPath)) {
      // No model trained yet — skip silently
      return resolve(null);
    }

    const py = spawn("python3", [scriptPath, JSON.stringify(symptoms)]);

    let out = "";
    let err = "";
    py.stdout.on("data", (d) => (out += d.toString()));
    py.stderr.on("data", (d) => (err += d.toString()));

    py.on("error", () => resolve(null));

    py.on("close", (code) => {
      if (code !== 0) {
        console.error("ML model stderr:", err);
        return resolve(null);
      }
      try {
        resolve(JSON.parse(out.trim()));
      } catch (_) {
        console.error("ML model bad output:", out);
        resolve(null);
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────
 *  AI analysis via Claude
 *  Returns the structured diagnosis the frontend already expects.
 * ───────────────────────────────────────────────────────────── */
async function runAiAnalysis(symptoms, mlHint) {
  if (!anthropic) return fallbackDiagnosis(symptoms);

  const hintText = mlHint?.disease
    ? `\n\nAs a reference, a statistical model trained on a symptom dataset suggests "${mlHint.disease}" (confidence ${(
        (mlHint.confidence || 0) * 100
      ).toFixed(0)}%). Use this as one input among others — you may agree or disagree.`
    : "";

  const system = `You are a medical AI assistant. Given symptoms, provide a helpful, non-alarmist analysis.
Return ONLY valid JSON (no markdown, no backticks, no prose before or after) with this exact structure:
{
  "conditions": [
    { "name": string, "likelihood": "High"|"Medium"|"Low", "description": string, "specialist": string }
  ],
  "advice": string,
  "urgency": "Routine"|"Soon"|"Urgent",
  "disclaimer": string
}
Provide 2-4 plausible conditions ordered by likelihood. Keep each description to 1 sentence.`;

  const userMsg = `My symptoms: ${symptoms.join(", ")}.${hintText}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userMsg }],
    });

    const text = msg.content?.[0]?.text || "";
    return parseJsonLoose(text) || fallbackDiagnosis(symptoms);
  } catch (err) {
    console.error("Anthropic error:", err.message);
    return fallbackDiagnosis(symptoms);
  }
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (_) {}
    }
    return null;
  }
}

/* ─── Offline / no-key fallback ─── */
function fallbackDiagnosis(symptoms) {
  const t = symptoms.join(" ").toLowerCase();
  const conditions = [];
  let urgency = "Routine";

  if (/chest pain|shortness of breath|dizziness/.test(t)) {
    urgency = "Urgent";
    conditions.push({
      name: "Cardiorespiratory strain",
      likelihood: "High",
      description:
        "These symptoms can indicate breathing or circulation stress and should be evaluated promptly.",
      specialist: "Cardiologist or Emergency Physician",
    });
  }
  if (/fever|cough|sore throat|fatigue/.test(t)) {
    urgency = urgency === "Urgent" ? "Urgent" : "Soon";
    conditions.push({
      name: "Viral respiratory infection",
      likelihood: "Medium",
      description:
        "This pattern often appears with seasonal viral infections and usually needs supportive care.",
      specialist: "General Practitioner",
    });
  }
  if (/nausea|vomiting|loss of appetite/.test(t)) {
    conditions.push({
      name: "Gastrointestinal irritation",
      likelihood: "Medium",
      description:
        "Digestive inflammation or mild infection can cause this symptom combination.",
      specialist: "Gastroenterologist",
    });
  }
  if (/rash|joint pain/.test(t)) {
    conditions.push({
      name: "Inflammatory or allergic reaction",
      likelihood: "Low",
      description:
        "Skin and joint symptoms together can be linked to allergy or inflammatory activity.",
      specialist: "Dermatologist or Rheumatologist",
    });
  }
  if (!conditions.length) {
    conditions.push({
      name: "Non-specific symptoms",
      likelihood: "Low",
      description:
        "Symptoms may be related to stress, hydration, sleep quality, or early-stage minor illness.",
      specialist: "General Practitioner",
    });
  }

  return {
    conditions: conditions.slice(0, 4),
    advice:
      "Track your symptoms over 24–48 hours, stay hydrated, and seek professional care if symptoms worsen or persist.",
    urgency,
    disclaimer:
      "This is an educational estimate, not a medical diagnosis. Consult a licensed clinician for medical decisions.",
  };
}

/* ─────────────────────────────────────────────────────────────
 *  Routes
 * ───────────────────────────────────────────────────────────── */

/* POST /predict
 *   body: { symptoms: string[] }
 *   headers: Authorization: Bearer <firebase id token>
 */
app.post("/predict", requireAuth, async (req, res) => {
  const symptoms = req.body?.symptoms;

  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return res
      .status(400)
      .json({ error: "symptoms must be a non-empty array of strings" });
  }

  const cleaned = symptoms
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, 30);

  try {
    // 1) local ML model (best-effort — may be null if model.pkl isn't there)
    const mlHint = await runMlModel(cleaned);

    // 2) AI analysis (Claude), informed by the ML hint if present
    const aiResult = await runAiAnalysis(cleaned, mlHint);

    // 3) persist to Firestore
    const entry = {
      uid: req.user.uid,
      symptoms: cleaned,
      mlHint: mlHint || null,
      aiResult,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let entryId = null;
    if (db) {
      const ref = await db.collection("diagnoses").add(entry);
      entryId = ref.id;
    }

    return res.json({
      id: entryId,
      symptoms: cleaned,
      mlHint,
      aiResult,
    });
  } catch (err) {
    console.error("/predict error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* GET /history — user's past analyses, newest first */
app.get("/history", requireAuth, async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: "Firestore not configured" });
  }
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const snap = await db
      .collection("diagnoses")
      .where("uid", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        symptoms: data.symptoms,
        mlHint: data.mlHint,
        aiResult: data.aiResult,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    return res.json({ items });
  } catch (err) {
    console.error("/history error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/* DELETE /history/:id */
app.delete("/history/:id", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: "Firestore not configured" });
  try {
    const doc = await db.collection("diagnoses").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Not found" });
    if (doc.data().uid !== req.user.uid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await doc.ref.delete();
    return res.json({ ok: true });
  } catch (err) {
    console.error("/history delete error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/* Health check — public */
app.get("/health", (_req, res) => {
 res.json({
  status: "ok",
  firebase: Boolean(admin.apps.length),
  grok: Boolean(process.env.GROK_API_KEY),
  mlModel: fs.existsSync(path.join(__dirname, "model.pkl")),
});
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
