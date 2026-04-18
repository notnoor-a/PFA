"""
Trains the symptom → disease classifier.

Fixes vs. the original:
  • The target column in Testing.csv is 'prognosis', not 'disease'.
  • We now save feature_names alongside the model so predict.py can
    build the input vector by name, not by position.
  • We save to backend/model.pkl as a bundle: {"model", "features", "classes"}.
"""

import os
import warnings

# The tiny Testing.csv has 41 unique classes across 42 rows, which trips sklearn's
# "could represent a regression problem" warning dozens of times. The condition is
# already documented in SETUP.md; silencing here keeps the output readable.
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

TARGET = "prognosis"

# 1. Load dataset
csv_path = os.path.join(os.path.dirname(__file__), "Testing.csv")
data = pd.read_csv(csv_path)

# 2. Clean up: drop the junk trailing column some versions of this dataset have
#    (a stray "Unnamed: 133" column full of NaN).
data = data.loc[:, ~data.columns.str.contains("^Unnamed")]

# Strip whitespace from feature/column names so "spotting_ urination" etc. are stable
data.columns = [c.strip() for c in data.columns]

if TARGET not in data.columns:
    raise ValueError(
        f"Expected target column '{TARGET}' not found. "
        f"Available columns: {list(data.columns)[:5]}..."
    )

data = data.fillna(0)

X = data.drop(TARGET, axis=1)
y = data[TARGET]

feature_names = list(X.columns)
print(f"Dataset: {len(data)} rows, {len(feature_names)} features, "
      f"{y.nunique()} unique diseases")

# 3. Train/test split — only if we have enough rows per class
model = RandomForestClassifier(n_estimators=200, random_state=42)
counts = y.value_counts()

if len(data) >= 100 and counts.min() >= 2:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    model.fit(X_train, y_train)
    print(f"Test accuracy: {model.score(X_test, y_test):.4f}")
else:
    # Dataset is tiny (1 row/class in Testing.csv) — train on everything.
    # For a real deployment, swap Testing.csv for a bigger dataset
    # (e.g. the Kaggle "Disease Symptom Prediction" Training.csv, 4920 rows).
    print(
        f"⚠  Only {len(data)} rows with {counts.min()} row(s) per class — "
        "training on full dataset, no held-out test set."
    )
    model.fit(X, y)
    print(f"Train accuracy: {model.score(X, y):.4f}")

# 6. Save bundle
out_path = os.path.join(os.path.dirname(__file__), "..", "backend", "model.pkl")
bundle = {
    "model": model,
    "features": feature_names,
    "classes": list(model.classes_),
}
joblib.dump(bundle, out_path)
print(f"Model saved to: {os.path.abspath(out_path)}")
