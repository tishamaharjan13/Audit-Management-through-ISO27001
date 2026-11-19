const jwt = require("jsonwebtoken");
const db = require("../db");
const config = require("../config");

// Middleware 1: "Is this person signed in?"
// Reads the token from the header "Authorization: Bearer <token>".
async function authenticate(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Not signed in." });
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    } catch {
      return res
        .status(401)
        .json({ message: "Session expired. Sign in again." });
    }

    // Check the database every time, so a deactivated user is blocked immediately.
    const { rows } = await db.query(
      "SELECT id, name, email, role, organisation_id, is_active FROM users WHERE id = $1",
      [payload.id],
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res
        .status(401)
        .json({ message: "Account not available. Contact an administrator." });
    }

    req.user = user; // later code can read req.user.role, req.user.id ...
    next();
  } catch (err) {
    next(err);
  }
}

// Middleware 2: "Is this person allowed to do this?"  Example: requireRole("admin")
const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res
          .status(403)
          .json({ message: "You do not have permission for this action." });

module.exports = { authenticate, requireRole };
