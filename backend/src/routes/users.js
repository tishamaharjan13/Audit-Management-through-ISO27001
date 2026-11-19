// Admin-only user management.
const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { validatePassword, hashPassword } = require("../utils/password");
const { logAction } = require("../utils/logger");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, requireRole("admin")); // every route below needs: signed in AND admin

const ROLES = ["admin", "auditor", "client"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/users -> list all users
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.organisation_id, o.name AS organisation_name,
            u.is_active, u.last_login,
            (u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS locked
     FROM users u
     LEFT JOIN organisations o ON o.id = u.organisation_id
     ORDER BY u.id`,
    );
    res.json(rows);
  }),
);

// POST /api/users   body: { name, email, role, password, organisation_id? }
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const role = String(req.body.role || "");
    const password = String(req.body.password || "");
    const organisationId = req.body.organisation_id
      ? Number(req.body.organisation_id)
      : null;

    if (!name || name.length > 100)
      return res
        .status(400)
        .json({ message: "Enter a name (max 100 characters)." });
    if (!EMAIL_RE.test(email) || email.length > 150)
      return res.status(400).json({ message: "Enter a valid email." });
    if (!ROLES.includes(role))
      return res
        .status(400)
        .json({ message: "Role must be admin, auditor or client." });
    if (validatePassword(password).length)
      return res.status(400).json({
        message: "Temporary password does not meet the requirements.",
      });

    if (organisationId) {
      const org = await db.query("SELECT id FROM organisations WHERE id = $1", [
        organisationId,
      ]);
      if (!org.rows[0])
        return res.status(400).json({ message: "Organisation not found." });
    }

    const exists = await db.query(
      "SELECT 1 FROM users WHERE LOWER(email) = $1",
      [email],
    );
    if (exists.rows[0])
      return res
        .status(409)
        .json({ message: "A user with this email already exists." });

    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role, organisation_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, email, await hashPassword(password), role, organisationId],
    );
    await logAction({
      userId: req.user.id,
      action: "user_created",
      entity: "user",
      entityId: rows[0].id,
      details: { email, role },
    });

    res.status(201).json({ id: rows[0].id });
  }),
);

// PATCH /api/users/:id/active   body: { active: true|false }
// active = true also unlocks the account.
router.patch(
  "/:id/active",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id))
      return res.status(400).json({ message: "Invalid user id." });
    if (typeof req.body.active !== "boolean")
      return res.status(400).json({ message: "active must be true or false." });
    if (id === req.user.id && !req.body.active)
      return res
        .status(400)
        .json({ message: "You cannot deactivate your own account." });

    const { rowCount } = await db.query(
      `UPDATE users SET is_active = $2,
       failed_logins = CASE WHEN $2 THEN 0 ELSE failed_logins END,
       locked_until = CASE WHEN $2 THEN NULL ELSE locked_until END
     WHERE id = $1`,
      [id, req.body.active],
    );
    if (!rowCount) return res.status(404).json({ message: "User not found." });

    await logAction({
      userId: req.user.id,
      action: req.body.active ? "user_activated" : "user_deactivated",
      entity: "user",
      entityId: id,
    });
    res.json({ id });
  }),
);

module.exports = router;
