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

const SUPPORTED_LANGS = new Set(["en", "fr", "ar"]);

const LOCALE_TEXT = {
  en: {
    promptLanguageName: "English",
    promptSymptomLabel: "My symptoms",
    fallbackMessage: "Could not get an AI response. Showing rule-based guidance.",
    defaultDescription: "Possible condition based on this symptom pattern.",
    defaultSpecialist: "General Practitioner",
    defaultAdvice:
      "Track your symptoms over 24-48 hours and seek medical care if they worsen or persist.",
    defaultDisclaimer:
      "This is an educational estimate, not a medical diagnosis. Consult a licensed clinician for medical decisions.",
    acuteName: "Possible acute cardiorespiratory issue",
    acuteDescription:
      "This combination can indicate significant breathing or circulation stress and should be evaluated urgently.",
    acuteSpecialist: "Cardiologist or Emergency Physician",
    cardioName: "Possible cardiorespiratory cause",
    cardioDescription:
      "A single chest or breathing symptom can have many causes and needs clinical evaluation if persistent or worsening.",
    cardioSpecialist: "General Practitioner",
    viralName: "Viral respiratory infection",
    viralDescription:
      "This pattern often appears with seasonal viral infections and usually needs supportive care.",
    viralSpecialist: "General Practitioner",
    giName: "Gastrointestinal irritation",
    giDescription:
      "Digestive inflammation or mild infection can cause this symptom combination.",
    giSpecialist: "Gastroenterologist",
    inflammationName: "Inflammatory or allergic reaction",
    inflammationDescription:
      "Skin and joint symptoms together can be linked to allergy or inflammatory activity.",
    inflammationSpecialist: "Dermatologist or Rheumatologist",
    nonSpecificName: "Non-specific symptoms",
    nonSpecificDescription:
      "Symptoms may be related to stress, hydration, sleep quality, or early-stage minor illness.",
    nonSpecificSpecialist: "General Practitioner",
  },
  fr: {
    promptLanguageName: "French",
    promptSymptomLabel: "Mes symptômes",
    fallbackMessage: "Réponse IA indisponible. Conseils basés sur des règles affichés.",
    defaultDescription: "Affection possible selon ce profil de symptômes.",
    defaultSpecialist: "Médecin généraliste",
    defaultAdvice:
      "Surveillez vos symptômes pendant 24 à 48 heures et consultez si cela s'aggrave ou persiste.",
    defaultDisclaimer:
      "Il s'agit d'une estimation informative et non d'un diagnostic médical. Consultez un professionnel de santé qualifié.",
    acuteName: "Possible problème cardio-respiratoire aigu",
    acuteDescription:
      "Cette combinaison peut indiquer un stress respiratoire ou circulatoire important et nécessite une évaluation urgente.",
    acuteSpecialist: "Cardiologue ou médecin urgentiste",
    cardioName: "Cause cardio-respiratoire possible",
    cardioDescription:
      "Une douleur thoracique ou un trouble respiratoire isolé peut avoir plusieurs causes et doit être évalué si cela persiste.",
    cardioSpecialist: "Médecin généraliste",
    viralName: "Infection respiratoire virale",
    viralDescription:
      "Ce profil est fréquent dans les infections virales saisonnières et nécessite souvent un traitement de soutien.",
    viralSpecialist: "Médecin généraliste",
    giName: "Irritation gastro-intestinale",
    giDescription:
      "Une inflammation digestive ou une infection légère peut provoquer cette combinaison de symptômes.",
    giSpecialist: "Gastro-entérologue",
    inflammationName: "Réaction inflammatoire ou allergique",
    inflammationDescription:
      "Des symptômes cutanés et articulaires peuvent être liés à une allergie ou une inflammation.",
    inflammationSpecialist: "Dermatologue ou rhumatologue",
    nonSpecificName: "Symptômes non spécifiques",
    nonSpecificDescription:
      "Les symptômes peuvent être liés au stress, à l'hydratation, au sommeil ou à une affection légère débutante.",
    nonSpecificSpecialist: "Médecin généraliste",
  },
  ar: {
    promptLanguageName: "Arabic",
    promptSymptomLabel: "أعراضي",
    fallbackMessage: "تعذر الحصول على استجابة الذكاء الاصطناعي. يتم عرض إرشادات مبنية على قواعد.",
    defaultDescription: "حالة محتملة بناء على هذا النمط من الأعراض.",
    defaultSpecialist: "طبيب عام",
    defaultAdvice:
      "تابع الأعراض لمدة 24 إلى 48 ساعة واطلب الرعاية الطبية إذا ساءت أو استمرت.",
    defaultDisclaimer:
      "هذا تقدير توعوي وليس تشخيصا طبيا. استشر مختصا طبيا مرخصا قبل اتخاذ أي قرار علاجي.",
    acuteName: "احتمال مشكلة قلبية تنفسية حادة",
    acuteDescription:
      "هذا النمط قد يشير إلى ضغط كبير على التنفس أو الدورة الدموية ويحتاج إلى تقييم عاجل.",
    acuteSpecialist: "طبيب قلب أو طبيب طوارئ",
    cardioName: "سبب قلبي أو تنفسي محتمل",
    cardioDescription:
      "وجود عرض صدري أو تنفسي منفرد قد تكون له أسباب متعددة ويحتاج تقييما طبيا إذا استمر أو ازداد.",
    cardioSpecialist: "طبيب عام",
    viralName: "عدوى تنفسية فيروسية",
    viralDescription:
      "هذا النمط شائع في العدوى الفيروسية الموسمية وغالبا يحتاج إلى رعاية داعمة.",
    viralSpecialist: "طبيب عام",
    giName: "تهيج في الجهاز الهضمي",
    giDescription:
      "الالتهاب الهضمي أو العدوى الخفيفة قد يسببان هذا المزيج من الأعراض.",
    giSpecialist: "اختصاصي جهاز هضمي",
    inflammationName: "تفاعل التهابي أو تحسسي",
    inflammationDescription:
      "اجتماع أعراض الجلد والمفاصل قد يرتبط بالحساسية أو الالتهاب.",
    inflammationSpecialist: "اختصاصي جلدية أو روماتيزم",
    nonSpecificName: "أعراض غير محددة",
    nonSpecificDescription:
      "قد ترتبط الأعراض بالتوتر أو قلة السوائل أو النوم أو حالة خفيفة في بدايتها.",
    nonSpecificSpecialist: "طبيب عام",
  },
};

function resolveLanguage(rawValue) {
  const value = String(rawValue || "").toLowerCase().split(",")[0].trim();
  const normalized = value.split("-")[0];
  return SUPPORTED_LANGS.has(normalized) ? normalized : "en";
}

function resolveRequestLanguage(req) {
  return resolveLanguage(
    req.headers["x-app-lang"] || req.headers["accept-language"] || req.query.lang || "en"
  );
}

function localeText(lang) {
  return LOCALE_TEXT[resolveLanguage(lang)];
}

const ERROR_TEXT = {
  en: {
    serverAuthNotConfigured: "Server auth is not configured. Check FIREBASE_* env.",
    missingBearer: "Missing Authorization: Bearer <firebase-id-token>",
    invalidOrExpiredToken: "Invalid or expired token",
    firestoreNotConfigured: "Firestore not configured",
    tooManyRequestsIp: "Too many requests from this IP. Please retry shortly.",
    symptomsArrayInvalid: "symptoms must be a non-empty array of strings",
    noValidSymptoms: "No valid symptoms provided",
    predictThrottle: "Please wait a couple of seconds before requesting another analysis.",
    internalServerError: "Internal server error",
    notFound: "Not found",
    forbidden: "Forbidden",
  },
  fr: {
    serverAuthNotConfigured:
      "L'authentification du serveur n'est pas configurée. Vérifiez les variables FIREBASE_*.",
    missingBearer: "En-tête Authorization manquant: Bearer <firebase-id-token>",
    invalidOrExpiredToken: "Jeton invalide ou expiré",
    firestoreNotConfigured: "Firestore n'est pas configuré",
    tooManyRequestsIp: "Trop de requêtes depuis cette adresse IP. Réessayez dans un instant.",
    symptomsArrayInvalid: "symptoms doit être un tableau non vide de chaînes de caractères",
    noValidSymptoms: "Aucun symptôme valide fourni",
    predictThrottle: "Veuillez patienter quelques secondes avant une nouvelle analyse.",
    internalServerError: "Erreur interne du serveur",
    notFound: "Introuvable",
    forbidden: "Interdit",
  },
  ar: {
    serverAuthNotConfigured: "مصادقة الخادم غير مهيأة. تحقق من متغيرات FIREBASE_*.",
    missingBearer: "ترويسة Authorization مفقودة: Bearer <firebase-id-token>",
    invalidOrExpiredToken: "الرمز غير صالح أو منتهي الصلاحية",
    firestoreNotConfigured: "Firestore غير مهيأ",
    tooManyRequestsIp: "طلبات كثيرة من هذا العنوان. يرجى المحاولة بعد قليل.",
    symptomsArrayInvalid: "يجب أن تكون symptoms مصفوفة غير فارغة من النصوص",
    noValidSymptoms: "لم يتم توفير أعراض صالحة",
    predictThrottle: "يرجى الانتظار بضع ثوان قبل طلب تحليل جديد.",
    internalServerError: "خطأ داخلي في الخادم",
    notFound: "غير موجود",
    forbidden: "غير مسموح",
  },
};

function errorText(lang, key) {
  const messages = ERROR_TEXT[resolveLanguage(lang)] || ERROR_TEXT.en;
  return messages[key] || ERROR_TEXT.en[key] || ERROR_TEXT.en.internalServerError;
}

function requestErrorText(req, key) {
  return errorText(resolveRequestLanguage(req), key);
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

function buildMedicalPrompt(symptoms, lang) {
  const text = localeText(lang);
  const system =
    "You are a conservative medical triage assistant. Return strict JSON only: {conditions:[{name,likelihood,description,specialist}],advice,urgency,disclaimer}. " +
    "likelihood must be High|Medium|Low. urgency must be Routine|Soon|Urgent. Provide 2-4 conditions, one sentence per description. " +
    "Use High only when evidence is strong and specific with at least two independent supporting indicators. " +
    "Never assign High for a severe diagnosis from a single non-specific symptom. " +
    "For heart attack/myocardial infarction, do not assign High unless chest pain or pressure is present with additional strong supporting signs. " +
    `Write all free-text fields (name, description, specialist, advice, disclaimer) in ${text.promptLanguageName}. ` +
    "Keep enum values exactly as follows: likelihood = High|Medium|Low and urgency = Routine|Soon|Urgent.";

  const userMsg = `${text.promptSymptomLabel}: ${symptoms.join(", ")}.`;

  return {
    system,
    userPrompt: `${userMsg}\n\nRespond with JSON only.`,
  };
}

function parseAndNormalizeDiagnosis(text, symptoms, providerName, lang) {
  const parsed = parseJsonLoose(text);
  if (!parsed) {
    throw new Error(`${providerName} returned invalid JSON`);
  }

  const safe = normalizeAiResult(parsed, symptoms, lang);
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
const RATE_STATE_TTL_MS = 60 * 60 * 1000;
const MAX_RATE_STATE_ENTRIES = 5000;
const IP_WINDOW_TTL_MS = 5 * IP_WINDOW_MS;
const MAX_IP_WINDOW_ENTRIES = 5000;
const MAX_PREDICT_CACHE_ENTRIES = 1000;
const MAP_MAINTENANCE_INTERVAL = 25;

const predictRateStateByUid = new Map();
const predictResponseCache = new Map();
const ipPredictWindow = new Map();
let predictMaintenanceCounter = 0;

function trimMapToMaxSize(map, maxSize, getTimestamp) {
  if (map.size <= maxSize) return;
  const overflow = map.size - maxSize;
  const oldest = [...map.entries()]
    .sort((a, b) => getTimestamp(a[1]) - getTimestamp(b[1]))
    .slice(0, overflow);
  for (const [key] of oldest) {
    map.delete(key);
  }
}

function cleanupPredictMaps(now = Date.now()) {
  for (const [uid, ts] of predictRateStateByUid.entries()) {
    const lastRequestAt = Number(ts || 0);
    if (!lastRequestAt || now - lastRequestAt > RATE_STATE_TTL_MS) {
      predictRateStateByUid.delete(uid);
    }
  }
  trimMapToMaxSize(predictRateStateByUid, MAX_RATE_STATE_ENTRIES, (value) => Number(value || 0));

  for (const [ip, state] of ipPredictWindow.entries()) {
    const startAt = Number(state?.startAt || 0);
    if (!startAt || now - startAt > IP_WINDOW_TTL_MS) {
      ipPredictWindow.delete(ip);
    }
  }
  trimMapToMaxSize(ipPredictWindow, MAX_IP_WINDOW_ENTRIES, (value) => Number(value?.startAt || 0));

  for (const [key, cached] of predictResponseCache.entries()) {
    const cachedAt = Number(cached?.cachedAt || 0);
    if (!cachedAt || now - cachedAt > PREDICT_CACHE_TTL_MS) {
      predictResponseCache.delete(key);
    }
  }
  trimMapToMaxSize(
    predictResponseCache,
    MAX_PREDICT_CACHE_ENTRIES,
    (value) => Number(value?.cachedAt || 0)
  );
}

function maybeRunPredictMaintenance(now = Date.now()) {
  predictMaintenanceCounter += 1;
  if (predictMaintenanceCounter % MAP_MAINTENANCE_INTERVAL !== 0) return;
  cleanupPredictMaps(now);
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

async function requireAuth(req, res, next) {
  if (!admin.apps.length) {
    return res.status(503).json({ error: requestErrorText(req, "serverAuthNotConfigured") });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: requestErrorText(req, "missingBearer") });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verify failed:", err.message);
    return res.status(401).json({ error: requestErrorText(req, "invalidOrExpiredToken") });
  }
}
async function runAiAnalysis(symptoms, lang) {
  const { system, userPrompt } = buildMedicalPrompt(symptoms, lang);
  const text = localeText(lang);

  const runGroqModel = async (model) => {
    const groqText = await runOpenAiCompatibleProvider({
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      model,
      system,
      user: userPrompt,
      providerName: "Groq",
    });
    const safe = parseAndNormalizeDiagnosis(groqText, symptoms, "Groq", lang);
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
      const safe = parseAndNormalizeDiagnosis(text, symptoms, "Gemini", lang);
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

    return { aiResult: fallbackDiagnosis(symptoms, lang) };
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
    aiResult: fallbackDiagnosis(symptoms, lang),
    message: aiFailed ? text.fallbackMessage : "",
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

function isIpRateLimited(req, now = Date.now()) {
  const key = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
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
  if (["high", "élevé", "eleve", "مرتفع"].includes(v)) return "High";
  if (["medium", "moyen", "متوسط"].includes(v)) return "Medium";
  return "Low";
}

function normalizeUrgency(value) {
  const v = String(value || "").trim().toLowerCase();
  if (["urgent", "urgence", "عاجل"].includes(v)) return "Urgent";
  if (["soon", "bientot", "bientôt", "قريبا", "قريبًا"].includes(v)) return "Soon";
  return "Routine";
}

function capLikelihood(current, maxAllowed) {
  const order = { Low: 1, Medium: 2, High: 3 };
  const now = normalizeLikelihood(current);
  const cap = normalizeLikelihood(maxAllowed);
  return order[now] > order[cap] ? cap : now;
}

function normalizeAiResult(raw, symptoms, lang) {
  if (!raw || typeof raw !== "object") return null;
  const text = localeText(lang);

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
        description: String(c?.description || text.defaultDescription)
          .trim()
          .slice(0, 280),
        specialist: String(c?.specialist || text.defaultSpecialist).trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  if (!conditions.length) return null;

  return {
    conditions,
    advice: String(raw.advice || text.defaultAdvice)
      .trim()
      .slice(0, 380),
    urgency: normalizeUrgency(raw.urgency),
    disclaimer: String(raw.disclaimer || text.defaultDisclaimer)
      .trim()
      .slice(0, 380),
  };
}

function fallbackDiagnosis(symptoms, lang) {
  const text = localeText(lang);
  const t = symptoms.join(" ").toLowerCase();
  const conditions = [];
  let urgency = "Routine";
  const hasChestPain = /chest pain|chest pressure|chest tightness/.test(t);
  const hasBreathingIssue = /shortness of breath|breathlessness/.test(t);
  const hasNeuroOrAutonomic = /dizziness|faint|nausea|vomiting|sweating/.test(t);

  if (hasChestPain && (hasBreathingIssue || hasNeuroOrAutonomic)) {
    urgency = "Urgent";
    conditions.push({
      name: text.acuteName,
      likelihood: "High",
      description: text.acuteDescription,
      specialist: text.acuteSpecialist,
    });
  } else if (hasBreathingIssue || hasChestPain) {
    urgency = "Soon";
    conditions.push({
      name: text.cardioName,
      likelihood: "Medium",
      description: text.cardioDescription,
      specialist: text.cardioSpecialist,
    });
  }
  if (/fever|cough|sore throat|fatigue/.test(t)) {
    urgency = urgency === "Urgent" ? "Urgent" : "Soon";
    conditions.push({
      name: text.viralName,
      likelihood: "Medium",
      description: text.viralDescription,
      specialist: text.viralSpecialist,
    });
  }
  if (/nausea|vomiting|loss of appetite/.test(t)) {
    conditions.push({
      name: text.giName,
      likelihood: "Medium",
      description: text.giDescription,
      specialist: text.giSpecialist,
    });
  }
  if (/rash|joint pain/.test(t)) {
    conditions.push({
      name: text.inflammationName,
      likelihood: "Low",
      description: text.inflammationDescription,
      specialist: text.inflammationSpecialist,
    });
  }
  if (!conditions.length) {
    conditions.push({
      name: text.nonSpecificName,
      likelihood: "Low",
      description: text.nonSpecificDescription,
      specialist: text.nonSpecificSpecialist,
    });
  }

  return {
    conditions: conditions.slice(0, 4),
    advice: text.defaultAdvice,
    urgency,
    disclaimer: text.defaultDisclaimer,
  };
}

app.post("/predict", requireAuth, async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: requestErrorText(req, "firestoreNotConfigured") });
  }
  const lang = resolveRequestLanguage(req);
  const now = Date.now();
  maybeRunPredictMaintenance(now);

  if (isIpRateLimited(req, now)) {
    return res.status(429).json({ error: requestErrorText(req, "tooManyRequestsIp") });
  }

  const symptoms = req.body?.symptoms;

  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return res.status(400).json({ error: requestErrorText(req, "symptomsArrayInvalid") });
  }

  const cleaned = cleanSymptomsInput(symptoms);

  if (!cleaned.length) {
    return res.status(400).json({ error: requestErrorText(req, "noValidSymptoms") });
  }

  const uid = req.user.uid;
  if (now - getLastRequestAt(uid) < MIN_MS_BETWEEN_PREDICT) {
    return res.status(429).json({ error: requestErrorText(req, "predictThrottle") });
  }
  setLastRequestAt(uid, now);

  const cacheKey = `${uid}:${lang}:${normalizeSymptomsKey(cleaned)}`;
  const cached = predictResponseCache.get(cacheKey);
  if (cached && now - cached.cachedAt < PREDICT_CACHE_TTL_MS) {
    return res.json({
      ...cached.payload,
      cached: true,
    });
  }

  try {
    const symptomsForAi = cleaned.slice(0, MAX_SYMPTOMS_FOR_AI);
    const analysis = await runAiAnalysis(symptomsForAi, lang);
    const aiResult = analysis.aiResult;
    const message = analysis.message || "";

    const entry = {
      uid: req.user.uid,
      lang,
      symptoms: cleaned,
      aiResult,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("diagnoses").add(entry);
    const payload = {
      id: ref.id,
      lang,
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
    return res.status(500).json({ error: requestErrorText(req, "internalServerError") });
  }
});

app.get("/history", requireAuth, async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: requestErrorText(req, "firestoreNotConfigured") });
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
    return res.status(500).json({ error: requestErrorText(req, "internalServerError") });
  }
});

app.delete("/history/:id", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: requestErrorText(req, "firestoreNotConfigured") });
  try {
    const doc = await db.collection("diagnoses").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: requestErrorText(req, "notFound") });
    if (doc.data().uid !== req.user.uid) {
      return res.status(403).json({ error: requestErrorText(req, "forbidden") });
    }
    await doc.ref.delete();
    return res.json({ ok: true });
  } catch (err) {
    console.error("/history delete error:", err);
    return res.status(500).json({ error: requestErrorText(req, "internalServerError") });
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
// Liste statique de symptômes (tu peux l'enrichir)
const DEFAULT_SYMPTOMS = [
  "Headache", "Fever", "Fatigue", "Cough", "Sore throat",
  "Nausea", "Shortness of breath", "Chest pain", "Back pain",
  "Dizziness", "Rash", "Joint pain", "Vomiting", "Loss of appetite",
  "Blurred vision"
];

app.get("/api/symptoms", (req, res) => {
  res.json({ symptoms: DEFAULT_SYMPTOMS });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
