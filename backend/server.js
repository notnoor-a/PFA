const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// =======================
// PREDICT ROUTE
// =======================
app.post("/predict", (req, res) => {
  const symptoms = req.body.symptoms;

  // validation
  if (!symptoms || !Array.isArray(symptoms)) {
    return res.status(400).json({
      error: "Symptoms must be an array",
    });
  }

  // safer: use spawn instead of exec
  const python = spawn("python", [
    "predict.py",
    JSON.stringify(symptoms),
  ]);

  let result = "";
  let errorOutput = "";

  python.stdout.on("data", (data) => {
    result += data.toString();
  });

  python.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });

  python.on("close", (code) => {
    if (code !== 0) {
      console.error(errorOutput);
      return res.status(500).json({
        error: "Python model error",
        details: errorOutput,
      });
    }

    res.json({
      disease: result.trim(),
    });
  });
});

// =======================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});