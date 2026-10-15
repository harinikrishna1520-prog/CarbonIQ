const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const emissionFactors = {
  electricity: 0.42,
  gas: 5.3,
  car: 0.21,
  flights: 90,
};

app.use(cors({ origin: frontendOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CarbonIQ API is healthy",
  });
});

app.post("/api/emissions/calculate", (req, res) => {
  const { electricity, gas, car, flights } = req.body ?? {};
  const usage = { electricity, gas, car, flights };

  for (const [category, value] of Object.entries(usage)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return res.status(400).json({
        success: false,
        message: `${category} must be a finite, non-negative number`,
      });
    }
  }

  const emissions = {
    electricity: electricity * emissionFactors.electricity,
    gas: gas * emissionFactors.gas,
    car: car * emissionFactors.car,
    flights: flights * emissionFactors.flights / 12,
  };
  const monthly = Object.values(emissions).reduce((sum, value) => sum + value, 0);

  return res.status(200).json({
    success: true,
    data: {
      monthly,
      ...emissions,
    },
  });
});

app.listen(port, () => {
  console.log(`CarbonIQ API listening on port ${port}`);
});
