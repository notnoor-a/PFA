import sys
import json
import joblib

model = joblib.load("model.pkl")

symptoms = json.loads(sys.argv[1])

result = model.predict([symptoms])

print(result[0])