require("dotenv").config();

const path = require("path");
const fs = require("fs");

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

function resolveFirebaseCredentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    return {
      credential: admin.credential.cert(svc),
      projectId: svc.project_id || process.env.FIREBASE_PROJECT_ID,
    };
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const filePath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Service account file not found at ${filePath}`);
    }

    return {
      credential: admin.credential.cert(require(filePath)),
      projectId: process.env.FIREBASE_PROJECT_ID,
    };
  }

  return {
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  };
}

function initFirebase() {
  if (admin.apps.length) return;

  try {
    admin.initializeApp(resolveFirebaseCredentials());
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

const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
const geminiConfigured =
  geminiKey.length > 0 && !geminiKey.toLowerCase().includes("replace_me");
const geminiModelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const groqKey = (process.env.GROQ_API_KEY || "").trim();
const groqConfigured =
  groqKey.length > 0 && !groqKey.toLowerCase().includes("replace_me");
const groqModelName = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const groqFallbackModel1 =
  process.env.GROQ_MODEL_FALLBACK_1 || "meta-llama/llama-4-scout-17b-16e-instruct";
const groqFallbackModel2 = process.env.GROQ_MODEL_FALLBACK_2 || "qwen/qwen3-32b";

const groqModelLadder = [groqModelName, groqFallbackModel1, groqFallbackModel2].filter(
  (model, idx, arr) => model && arr.indexOf(model) === idx
);

const geminiClient = geminiConfigured ? new GoogleGenerativeAI(geminiKey) : null;
const geminiModel = geminiClient
  ? geminiClient.getGenerativeModel({ model: geminiModelName })
  : null;

if (!geminiConfigured) {
  console.warn(
    "⚠️  GEMINI_API_KEY not configured — trying Groq before fallback rules."
  );
}
if (!groqConfigured) {
  console.warn("⚠️  GROQ_API_KEY not configured — Groq provider disabled.");
}

function getSymptomFlags(symptomList) {
  const symptomText = symptomList.join(" ");
  return {
    hasChestPain: /chest pain|chest pressure|chest tightness/.test(symptomText),
    hasCardiacSupport: /dizziness|faint|syncope|nausea|vomiting|sweating|left arm|jaw/.test(
      symptomText
    ),
  };
}

function buildMedicalPrompt(symptoms) {
  const system =
    "You are a conservative medical triage assistant. Return strict JSON only: {conditions:[{name,likelihood,description,specialist}],advice,urgency,disclaimer}. " +
    "likelihood must be High|Medium|Low. urgency must be Routine|Soon|Urgent. Provide 2-4 conditions, one sentence per description. " +
    "Use High only when evidence is strong and specific with at least two independent supporting indicators. " +
    "Never assign High for a severe diagnosis from a single non-specific symptom. " +
    "For heart attack/myocardial infarction, do not assign High unless chest pain or pressure is present with additional strong supporting signs.";

  const userMsg = `My symptoms: ${symptoms.join(", ")}.`;

  return {
    system,
    userPrompt: `${userMsg}\n\nRespond with JSON only.`,
  };
}

function parseAndNormalizeDiagnosis(text, symptoms, providerName) {
  const parsed = parseJsonLoose(text);
  if (!parsed) {
    throw new Error(`${providerName} returned invalid JSON`);
  }

  const safe = normalizeAiResult(parsed, symptoms);
  if (!safe) {
    throw new Error(`${providerName} returned unsafe/invalid diagnosis shape`);
  }

  return safe;
}

function cleanSymptomsInput(symptoms) {
  return symptoms
    .map((s) => String(s || "").trim())
    .map((s) => s.slice(0, MAX_SYMPTOM_LENGTH))
    .filter(Boolean)
    .filter((s, idx, arr) => arr.indexOf(s) === idx)
    .slice(0, 30);
}

function isGeminiRateLimitError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return err?.status === 429 || /429|too many requests|rate limit|quota/i.test(msg);
}

function normalizeSymptomsKey(symptoms) {
  return symptoms
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

function getLastRequestAt(uid) {
  return predictRateStateByUid.get(uid) || 0;
}

function setLastRequestAt(uid, ts) {
  predictRateStateByUid.set(uid, ts);
}

function fetchWithTimeout(url, options = {}, timeoutMs = AI_PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function runOpenAiCompatibleProvider({
  endpoint,
  apiKey,
  model,
  system,
  user,
  providerName,
  extraHeaders = {},
}) {
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${providerName} HTTP ${response.status}: ${raw.slice(0, 220)}`);
  }

  const data = raw ? JSON.parse(raw) : null;
  const text =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "";
  if (!text) {
    throw new Error(`${providerName} returned an empty completion`);
  }
  return text;
}

const app = express();
const PORT = process.env.PORT || 3001;

const MIN_MS_BETWEEN_PREDICT = 2000;
const PREDICT_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_SYMPTOMS_FOR_AI = 10;
const MAX_SYMPTOM_LENGTH = 48;
const IP_WINDOW_MS = 60 * 1000;
const MAX_PREDICT_PER_IP_PER_WINDOW = 45;
const AI_PROVIDER_TIMEOUT_MS = 8000;

const predictRateStateByUid = new Map();
const predictResponseCache = new Map();
const ipPredictWindow = new Map();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

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
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verify failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
async function runAiAnalysis(symptoms) {
  const { system, userPrompt } = buildMedicalPrompt(symptoms);

  const runGroqModel = async (model) => {
    const groqText = await runOpenAiCompatibleProvider({
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      model,
      system,
      user: userPrompt,
      providerName: "Groq",
    });
    const safe = parseAndNormalizeDiagnosis(groqText, symptoms, "Groq");
    return { aiResult: safe };
  };

  const tryProvider = async (providerName) => {
    if (providerName === "gemini") {
      if (!geminiModel) {
        throw new Error("Gemini is not configured");
      }
      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.2 },
      });
      const text = result.response?.text?.() || "";
      const safe = parseAndNormalizeDiagnosis(text, symptoms, "Gemini");
      return { aiResult: safe };
    }

    if (providerName === "groq") {
      if (!groqConfigured) {
        throw new Error("Groq is not configured");
      }

      const errors = [];
      for (const model of groqModelLadder) {
        try {
          return await runGroqModel(model);
        } catch (err) {
          errors.push(`${model}: ${err.message}`);
          console.warn(`Groq model failed (${model}), trying next model:`, err.message);
        }
      }

      throw new Error(`All Groq models failed. ${errors.join(" | ")}`);
    }

    return { aiResult: fallbackDiagnosis(symptoms) };
  };
  let aiFailed = false;

  if (geminiModel) {
    try {
      return await tryProvider("gemini");
    } catch (err) {
      aiFailed = true;
      if (isGeminiRateLimitError(err)) {
        console.warn("Gemini rate-limited (429). Trying Groq provider.");
      } else {
        console.warn("Gemini error, trying Groq provider:", err.message);
      }
    }
  }

  if (groqConfigured) {
    try {
      return await tryProvider("groq");
    } catch (err) {
      aiFailed = true;
      console.warn("Groq error. Using rules fallback:", err.message);
    }
  }

  return {
    aiResult: fallbackDiagnosis(symptoms),
    message: aiFailed ? "Couldn't get AI response. Showing rule-based guidance." : "",
  };
}

function parseJsonLoose(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch (_) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch (_) {}
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch (_) {}
    }
    return null;
  }
}

function isIpRateLimited(req) {
  const key = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
  const now = Date.now();
  const prev = ipPredictWindow.get(key) || { count: 0, startAt: now };
  if (now - prev.startAt > IP_WINDOW_MS) {
    ipPredictWindow.set(key, { count: 1, startAt: now });
    return false;
  }
  const nextCount = prev.count + 1;
  ipPredictWindow.set(key, { ...prev, count: nextCount });
  return nextCount > MAX_PREDICT_PER_IP_PER_WINDOW;
}

function normalizeLikelihood(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "high") return "High";
  if (v === "medium") return "Medium";
  return "Low";
}

function normalizeUrgency(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "urgent") return "Urgent";
  if (v === "soon") return "Soon";
  return "Routine";
}

function capLikelihood(current, maxAllowed) {
  const order = { Low: 1, Medium: 2, High: 3 };
  const now = normalizeLikelihood(current);
  const cap = normalizeLikelihood(maxAllowed);
  return order[now] > order[cap] ? cap : now;
}

function normalizeAiResult(raw, symptoms) {
  if (!raw || typeof raw !== "object") return null;

  const symptomList = (Array.isArray(symptoms) ? symptoms : [])
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean);
  const { hasChestPain, hasCardiacSupport } = getSymptomFlags(symptomList);

  const sourceConditions = Array.isArray(raw.conditions) ? raw.conditions : [];
  const conditions = sourceConditions
    .map((c) => {
      const name = String(c?.name || "").trim();
      if (!name) return null;

      const nameLower = name.toLowerCase();
      let likelihood = normalizeLikelihood(c?.likelihood);

      if (symptomList.length <= 1) {
        likelihood = capLikelihood(likelihood, "Medium");
      }

      if (/heart attack|myocardial infarction|acute coronary/.test(nameLower)) {
        if (!hasChestPain || !hasCardiacSupport) {
          likelihood = capLikelihood(likelihood, "Medium");
        }
      }

      return {
        name,
        likelihood,
        description: String(c?.description || "Possible condition based on this symptom pattern.")
          .trim()
          .slice(0, 280),
        specialist: String(c?.specialist || "General Practitioner").trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  if (!conditions.length) return null;

  return {
    conditions,
    advice: String(
      raw.advice ||
        "Track your symptoms over 24-48 hours and seek medical care if they worsen or persist."
    )
      .trim()
      .slice(0, 380),
    urgency: normalizeUrgency(raw.urgency),
    disclaimer: String(
      raw.disclaimer ||
        "This is an educational estimate, not a medical diagnosis. Consult a licensed clinician for medical decisions."
    )
      .trim()
      .slice(0, 380),
  };
}

function fallbackDiagnosis(symptoms) {
  const t = symptoms.join(" ").toLowerCase();
  const conditions = [];
  let urgency = "Routine";
  const hasChestPain = /chest pain|chest pressure|chest tightness/.test(t);
  const hasBreathingIssue = /shortness of breath|breathlessness/.test(t);
  const hasNeuroOrAutonomic = /dizziness|faint|nausea|vomiting|sweating/.test(t);

  if (hasChestPain && (hasBreathingIssue || hasNeuroOrAutonomic)) {
    urgency = "Urgent";
    conditions.push({
      name: "Possible acute cardiorespiratory issue",
      likelihood: "High",
      description:
        "This combination can indicate significant breathing or circulation stress and should be evaluated urgently.",
      specialist: "Cardiologist or Emergency Physician",
    });
  } else if (hasBreathingIssue || hasChestPain) {
    urgency = "Soon";
    conditions.push({
      name: "Possible cardiorespiratory cause",
      likelihood: "Medium",
      description:
        "A single chest or breathing symptom can have many causes and needs clinical evaluation if persistent or worsening.",
      specialist: "General Practitioner",
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

app.post("/predict", requireAuth, async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: "Firestore not configured" });
  }

  if (isIpRateLimited(req)) {
    return res.status(429).json({ error: "Too many requests from this IP. Please retry shortly." });
  }

  const symptoms = req.body?.symptoms;

  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return res
      .status(400)
      .json({ error: "symptoms must be a non-empty array of strings" });
  }

  const cleaned = cleanSymptomsInput(symptoms);

  if (!cleaned.length) {
    return res.status(400).json({ error: "No valid symptoms provided" });
  }

  const now = Date.now();
  const uid = req.user.uid;
  if (now - getLastRequestAt(uid) < MIN_MS_BETWEEN_PREDICT) {
    return res.status(429).json({
      error: "Please wait a couple of seconds before requesting another analysis.",
    });
  }
  setLastRequestAt(uid, now);

  const cacheKey = `${uid}:${normalizeSymptomsKey(cleaned)}`;
  const cached = predictResponseCache.get(cacheKey);
  if (cached && now - cached.cachedAt < PREDICT_CACHE_TTL_MS) {
    return res.json({
      ...cached.payload,
      cached: true,
    });
  }

  try {
    const symptomsForAi = cleaned.slice(0, MAX_SYMPTOMS_FOR_AI);
    const analysis = await runAiAnalysis(symptomsForAi);
    const aiResult = analysis.aiResult;
    const message = analysis.message || "";

    const entry = {
      uid: req.user.uid,
      symptoms: cleaned,
      aiResult,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("diagnoses").add(entry);
    const payload = {
      id: ref.id,
      symptoms: cleaned,
      aiResult,
      message,
    };

    predictResponseCache.set(cacheKey, {
      cachedAt: Date.now(),
      payload,
    });

    return res.json(payload);
  } catch (err) {
    console.error("/predict error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

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

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    firebase: Boolean(admin.apps.length),
    gemini: Boolean(geminiClient),
    geminiModel: geminiModelName,
    groq: groqConfigured,
    groqModel: groqModelName,
    groqModelLadder,
    providerTimeoutMs: AI_PROVIDER_TIMEOUT_MS,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
