import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import joblib

# 1. load dataset
data = pd.read_csv("Testing.csv")

# 2. preprocessing
data = data.fillna(0)

X = data.drop("disease", axis=1)
y = data["disease"]

# 3. split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# 4. train model
model = RandomForestClassifier()
model.fit(X_train, y_train)

# 5. evaluate
print("Accuracy:", model.score(X_test, y_test))

# 6. save model 🔥
joblib.dump(model, "model.pkl")

print("Model saved successfully!")