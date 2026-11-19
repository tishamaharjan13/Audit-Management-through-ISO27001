const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const db = require("../db");
const config = require("../config");
const { authenticate } = require("../middleware/auth");
const { validatePassword, hashPassword } = require("../utils/password");
const { logAction } = require("../utils/logger");
const { sendMail } = require("../utils/mailer");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Used so "email not found" takes as long as "wrong password" (hides which emails exist)
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

// Slows down guessing: max 30 requests per 15 minutes per IP on these routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Try again in a few minutes." },
});

const cleanEmail = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();
const hmac = (code) =>
  crypto.createHmac("sha256", config.jwtSecret).update(code).digest("hex");
const sameHash = (a, b) =>
  a.length === b.length &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// POST /api/auth/login   body: { email, password }

router.post(
  "/login",
  limiter,
  asyncHandler(async (req, res) => {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required." });

    const { rows } = await db.query(
      `SELECT u.*,
            (u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS is_locked,
            CEIL(EXTRACT(EPOCH FROM (u.locked_until - NOW())) / 60) AS lock_minutes
     FROM users u WHERE LOWER(u.email) = $1`,
      [email],
    );
    const user = rows[0];
    const generic = "Incorrect email or password.";

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      await logAction({
        action: "login_failed",
        details: { email, reason: "unknown_email" },
      });
      return res.status(401).json({ message: generic });
    }

    if (user.is_locked) {
      return res.status(429).json({
        message: `Too many failed attempts. Try again in ${user.lock_minutes} minute(s).`,
      });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      // +1 failed attempt; at the limit, lock the account and reset the counter
      await db.query(
        `UPDATE users SET
         locked_until = CASE WHEN failed_logins + 1 >= $2 THEN NOW() + make_interval(mins => $3) ELSE locked_until END,
         failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END
       WHERE id = $1`,
        [user.id, config.maxFailedLogins, config.lockMinutes],
      );
      await logAction({
        userId: user.id,
        action: "login_failed",
        details: { reason: "wrong_password" },
      });
      return res.status(401).json({ message: generic });
    }

    if (!user.is_active) {
      return res.status(403).json({
        message: "This account is deactivated. Contact an administrator.",
      });
    }

    await db.query(
      "UPDATE users SET failed_logins = 0, locked_until = NULL, last_login = NOW() WHERE id = $1",
      [user.id],
    );

    // The token is a signed "ID card". The frontend sends it with every request.
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
      algorithm: "HS256",
    });

    await logAction({ userId: user.id, action: "login" });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organisation_id: user.organisation_id,
        is_active: user.is_active,
      },
    });
  }),
);

// ---------------------------------------------------------------
// GET /api/auth/me   (needs token) -> who am I?
// ---------------------------------------------------------------
router.get("/me", authenticate, (req, res) => res.json({ user: req.user }));

// ---------------------------------------------------------------
// POST /api/auth/forgot-password   body: { email }
// Always answers the same message, so nobody can test which emails exist.
// ---------------------------------------------------------------
router.post(
  "/forgot-password",
  limiter,
  asyncHandler(async (req, res) => {
    const email = cleanEmail(req.body.email);
    if (!email) return res.status(400).json({ message: "Email is required." });

    const message = "If this email is registered, a reset code has been sent.";
    const { rows } = await db.query(
      "SELECT id, name, email FROM users WHERE LOWER(email) = $1 AND is_active = TRUE",
      [email],
    );
    const user = rows[0];

    if (user) {
      const code = String(crypto.randomInt(100000, 1000000)); // 6 digits
      await db.query(
        "UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE",
        [user.id],
      );
      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
        [user.id, hmac(code), config.resetMinutes], // only a hash of the code is stored
      );
      sendMail({
        to: user.email,
        subject: "Your password reset code",
        text: `Hello ${user.name},\n\nYour password reset code is ${code}.\nIt expires in ${config.resetMinutes} minutes.\nIf you did not ask for this, ignore this email.`,
      }).catch((err) => console.error("Email failed:", err.message));
      await logAction({ userId: user.id, action: "password_reset_requested" });
    }

    res.json({ message });
  }),
);

// ---------------------------------------------------------------
// POST /api/auth/reset-password   body: { email, code, newPassword }
// ---------------------------------------------------------------
router.post(
  "/reset-password",
  limiter,
  asyncHandler(async (req, res) => {
    const email = cleanEmail(req.body.email);
    const code = String(req.body.code || "").trim();
    const newPassword = String(req.body.newPassword || "");
    if (!email || !code || !newPassword)
      return res
        .status(400)
        .json({ message: "Email, code and new password are required." });

    const problems = validatePassword(newPassword);
    if (problems.length)
      return res.status(400).json({
        message: "Password does not meet the requirements.",
        details: problems,
      });

    const invalid = { message: "Invalid or expired code." };
    const userRes = await db.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 AND is_active = TRUE",
      [email],
    );
    if (!userRes.rows[0]) return res.status(400).json(invalid);
    const userId = userRes.rows[0].id;

    const tokenRes = await db.query(
      `SELECT id, token_hash FROM password_reset_tokens
     WHERE user_id = $1 AND used = FALSE AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
      [userId],
    );
    const token = tokenRes.rows[0];
    if (!token) return res.status(400).json(invalid);

    if (!sameHash(token.token_hash, hmac(code))) {
      // Wrong code: count it, and cancel the code after 5 wrong tries
      await db.query(
        "UPDATE password_reset_tokens SET attempts = attempts + 1, used = (attempts + 1 >= 5) WHERE id = $1",
        [token.id],
      );
      return res.status(400).json(invalid);
    }

    const hash = await hashPassword(newPassword);
    await db.transaction(async (client) => {
      await client.query(
        "UPDATE users SET password_hash = $1, failed_logins = 0, locked_until = NULL WHERE id = $2",
        [hash, userId],
      );
      await client.query(
        "UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1",
        [userId],
      );
    });
    await logAction({ userId, action: "password_reset_done" });

    res.json({ message: "Password updated. You can sign in now." });
  }),
);

// ---------------------------------------------------------------
// POST /api/auth/change-password   (needs token)  body: { currentPassword, newPassword }
// Wrong current password answers 400, not 401, so the frontend does not sign the user out.
// ---------------------------------------------------------------
router.post(
  "/change-password",
  authenticate,
  asyncHandler(async (req, res) => {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "Current and new password are required." });

    const problems = validatePassword(newPassword);
    if (problems.length)
      return res.status(400).json({
        message: "Password does not meet the requirements.",
        details: problems,
      });

    const { rows } = await db.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id],
    );
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res
        .status(400)
        .json({ message: "Current password is incorrect." });
    }
    if (currentPassword === newPassword)
      return res
        .status(400)
        .json({ message: "New password must be different." });

    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      await hashPassword(newPassword),
      req.user.id,
    ]);
    await logAction({ userId: req.user.id, action: "password_changed" });

    res.json({ message: "Password changed." });
  }),
);

module.exports = router;
