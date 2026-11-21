const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/logger");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Every organization route requires Admin authentication.
router.use(authenticate, requireRole("admin"));

// GET /api/organisations
// Admin can see all organizations.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(`
      SELECT
        o.id,
        o.name,
        o.org_type,
        o.created_at,
        COUNT(u.id)::int AS user_count
      FROM organisations o
      LEFT JOIN users u ON u.organisation_id = o.id
      GROUP BY o.id
      ORDER BY o.name ASC
    `);

    res.json(rows);
  }),
);

// POST /api/organisations
// Create a new organization.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const orgType = String(req.body.org_type || "client").trim();

    // Validate name.
    if (!name || name.length > 150) {
      return res.status(400).json({
        message:
          "Organization name is required and must be 150 characters or less.",
      });
    }

    // Validate organization type.
    if (!["client", "audit_firm"].includes(orgType)) {
      return res.status(400).json({
        message: "Organization type must be client or audit_firm.",
      });
    }

    // Check for duplicate organization name.
    const existing = await db.query(
      `SELECT id FROM organisations
       WHERE LOWER(name) = LOWER($1)`,
      [name],
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: "An organization with this name already exists.",
      });
    }

    // Insert into PostgreSQL.
    const { rows } = await db.query(
      `INSERT INTO organisations (name, org_type)
       VALUES ($1, $2)
       RETURNING id, name, org_type, created_at`,
      [name, orgType],
    );

    const organization = rows[0];

    // Record the action in the audit log.
    await logAction({
      userId: req.user.id,
      action: "organization_created",
      entity: "organisation",
      entityId: organization.id,
      details: {
        name: organization.name,
        org_type: organization.org_type,
      },
    });

    res.status(201).json({
      message: "Organization created successfully.",
      organization,
    });
  }),
);

module.exports = router;
