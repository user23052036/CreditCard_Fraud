from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
import os
from pydantic import BaseModel
from typing import List

class InputData(BaseModel):
    features: List[float]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(BASE_DIR, "..", "models", "xgboost_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "..", "models", "scaler.pkl")

model  = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

print(f"Model loaded:  {type(model).__name__}")
print(f"Scaler loaded: {type(scaler).__name__}")

@app.post("/predict")
def predict(data: InputData):
    features = np.array(data.features).reshape(1, -1)

    # Features order: [Time, V1..V28, Amount] — 30 total
    # Scale Time (index 0) and Amount (index 29) exactly like training did
    time_amount = features[:, [0, 29]]
    features[:, [0, 29]] = scaler.transform(time_amount)

    prob = model.predict_proba(features)[0][1]
    return {"probability": float(prob)}