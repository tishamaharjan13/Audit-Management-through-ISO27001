const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/auth");

app.get("/", (req, res) => {
  res.json({
    message: "ISO Audit Management API is running!",
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

app.use("/api/auth", authRoutes);
module.exports = app;
