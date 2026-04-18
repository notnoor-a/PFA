"""
Reads a JSON array of human-readable symptoms on argv[1], maps them onto
the model's 132 feature columns, and prints a JSON result:

  { "disease": "...", "confidence": 0.87, "topK": [["disease", 0.87], ...],
    "matched": [...], "unmatched": [...] }

If the model or its feature list is missing, prints a JSON error and exits 1.
"""

import json
import os
import re
import sys

import joblib


def _normalize(term: str) -> str:
    """Lowercase, trim, collapse whitespace/punct into underscores."""
    t = term.strip().lower()
    t = re.sub(r"[^a-z0-9]+", "_", t)
    t = re.sub(r"_+", "_", t).strip("_")
    return t


# Synonyms → canonical dataset column names.
# Only override where a direct normalized-string match wouldn't work
# (differing words, medical aliases, common phrasings).
SYNONYMS = {
    # Respiratory
    "shortness_of_breath": "breathlessness",
    "difficulty_breathing": "breathlessness",
    "dyspnea": "breathlessness",
    "sore_throat": "throat_irritation",
    "runny_or_stuffy_nose": "runny_nose",
    "stuffy_nose": "congestion",
    "blocked_nose": "congestion",
    "sneezing": "continuous_sneezing",

    # General / head
    "fever": "high_fever",
    "low_grade_fever": "mild_fever",
    "tired": "fatigue",
    "tiredness": "fatigue",
    "exhaustion": "fatigue",
    "blurred_vision": "blurred_and_distorted_vision",
    "blurry_vision": "blurred_and_distorted_vision",
    "double_vision": "visual_disturbances",
    "vertigo": "dizziness",

    # Digestive
    "stomach_ache": "stomach_pain",
    "belly_ache": "belly_pain",
    "tummy_pain": "abdominal_pain",
    "diarrhea": "diarrhoea",
    "loose_motions": "diarrhoea",
    "throw_up": "vomiting",
    "throwing_up": "vomiting",
    "appetite_loss": "loss_of_appetite",
    "no_appetite": "loss_of_appetite",
    "heartburn": "acidity",
    "acid_reflux": "acidity",
    "bloating": "distention_of_abdomen",

    # Skin
    "rash": "skin_rash",
    "skin_irritation": "skin_rash",
    "itchy_skin": "itching",
    "hives": "skin_rash",

    # Musculoskeletal
    "muscle_ache": "muscle_pain",
    "muscle_aches": "muscle_pain",
    "body_ache": "muscle_pain",
    "body_aches": "muscle_pain",
    "joint_ache": "joint_pain",
    "stiff_joints": "movement_stiffness",

    # Cardiac / circulatory
    "racing_heart": "fast_heart_rate",
    "heart_racing": "fast_heart_rate",
    "heart_palpitations": "palpitations",

    # Neuro / mental
    "anxious": "anxiety",
    "sad": "depression",
    "feeling_down": "depression",
    "mood_swing": "mood_swings",
    "cant_concentrate": "lack_of_concentration",
    "loss_of_focus": "lack_of_concentration",

    # Urinary
    "painful_urination": "burning_micturition",
    "burning_urination": "burning_micturition",
    "frequent_urination": "polyuria",

    # Misc
    "chills_and_shivering": "chills",
    "cold_sweats": "sweating",
    "weight_change": "weight_loss",
}


def map_symptoms(raw_symptoms, feature_names):
    """Return (vector, matched_list, unmatched_list)."""
    feature_set = set(feature_names)
    feature_index = {f: i for i, f in enumerate(feature_names)}

    vector = [0] * len(feature_names)
    matched, unmatched = [], []

    for raw in raw_symptoms:
        norm = _normalize(raw)
        if not norm:
            continue

        # 1) Direct match
        if norm in feature_set:
            vector[feature_index[norm]] = 1
            matched.append({"input": raw, "mapped": norm})
            continue

        # 2) Synonym map
        if norm in SYNONYMS and SYNONYMS[norm] in feature_set:
            canonical = SYNONYMS[norm]
            vector[feature_index[canonical]] = 1
            matched.append({"input": raw, "mapped": canonical})
            continue

        # 3) Substring fallback — match if the normalized input is a
        #    substring of exactly one feature name, or vice-versa.
        candidates = [f for f in feature_names if norm in f or f in norm]
        if len(candidates) == 1:
            vector[feature_index[candidates[0]]] = 1
            matched.append({"input": raw, "mapped": candidates[0]})
            continue

        unmatched.append(raw)

    return vector, matched, unmatched


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing symptoms arg"}))
        sys.exit(1)

    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    if not os.path.exists(model_path):
        print(json.dumps({"error": f"model.pkl not found at {model_path}"}))
        sys.exit(1)

    bundle = joblib.load(model_path)

    # Backward compatibility: support both the new bundle format
    # and the old raw-estimator format.
    if isinstance(bundle, dict) and "model" in bundle:
        model = bundle["model"]
        feature_names = bundle.get("features")
    else:
        model = bundle
        feature_names = getattr(model, "feature_names_in_", None)
        if feature_names is not None:
            feature_names = list(feature_names)

    if not feature_names:
        print(json.dumps({
            "error": "Model was trained without feature names. Retrain with the new train.py."
        }))
        sys.exit(1)

    try:
        symptoms = json.loads(sys.argv[1])
        if not isinstance(symptoms, list):
            raise ValueError("symptoms must be a JSON array")
    except Exception as e:
        print(json.dumps({"error": f"Bad symptoms input: {e}"}))
        sys.exit(1)

    vector, matched, unmatched = map_symptoms(symptoms, feature_names)

    if sum(vector) == 0:
        # Nothing mapped — don't let the model hallucinate a prediction
        print(json.dumps({
            "disease": None,
            "confidence": 0.0,
            "topK": [],
            "matched": matched,
            "unmatched": unmatched,
            "note": "No input symptoms mapped to the model's known features.",
        }))
        return

    # Predict + class probabilities. Use a DataFrame so sklearn doesn't
    # warn about missing feature names.
    try:
        try:
            import pandas as pd  # optional — only for the warning-free path
            X = pd.DataFrame([vector], columns=feature_names)
        except ImportError:
            X = [vector]
        proba = model.predict_proba(X)[0]
        classes = list(model.classes_)
        ranked = sorted(
            zip(classes, (float(p) for p in proba)),
            key=lambda x: x[1],
            reverse=True,
        )
        top_k = ranked[:3]
        disease, confidence = top_k[0]
    except Exception:
        # Model without predict_proba — fall back to predict()
        disease = str(model.predict(X)[0])
        confidence = None
        top_k = [(disease, None)]

    print(json.dumps({
        "disease": disease,
        "confidence": confidence,
        "topK": [[name, conf] for name, conf in top_k],
        "matched": matched,
        "unmatched": unmatched,
    }))


if __name__ == "__main__":
    main()
