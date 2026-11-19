const bcrypt = require("bcryptjs");

// Same rules as the frontend. The backend must check again, because the frontend can be bypassed.
const RULES = [
  [(p) => p.length >= 8, "At least 8 characters"],
  [(p) => p.length <= 72, "At most 72 characters"],
  [(p) => /[A-Z]/.test(p), "One uppercase letter"],
  [(p) => /[a-z]/.test(p), "One lowercase letter"],
  [(p) => /[0-9]/.test(p), "One number"],
  [(p) => /[^A-Za-z0-9]/.test(p), "One special character"],
];

// Returns the rules that are NOT met (empty list = password is fine)
const validatePassword = (p) =>
  RULES.filter(([test]) => !test(p)).map(([, label]) => label);

// bcrypt turns a password into a one-way hash. The real password is never stored.
const hashPassword = (p) => bcrypt.hash(p, 12);

module.exports = { validatePassword, hashPassword };
