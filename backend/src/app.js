const express = require("express");
const cors = require("cors");
const { authenticate, requireRole } = require("./middleware/auth");
const app = express();

app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const organisationsRoutes = require("./routes/organisations");
const auditsRoutes = require("./routes/audits");
const clientAuditsRoutes = require("./routes/clientAudits");

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

// RBAC testing routes

app.get("/api/admin/test", authenticate, requireRole("admin"), (req, res) => {
  res.json({ message: "Welcome Admin! Access granted." });
});

app.get(
  "/api/auditor/test",
  authenticate,
  requireRole("auditor"),
  (req, res) => {
    res.json({ message: "Welcome Auditor! Access granted." });
  },
);

app.get("/api/client/test", authenticate, requireRole("client"), (req, res) => {
  res.json({ message: "Welcome Client! Access granted." });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/organisations", organisationsRoutes);
app.use("/api/audits", auditsRoutes);
app.use("/api/client/audits", clientAuditsRoutes);

module.exports = app;
