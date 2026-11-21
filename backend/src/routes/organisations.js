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

// CLIENT SUBMITS A SELF-ASSESSMENT FOR ONE CONTROL
router.post(
  "/:auditId/controls/:auditControlId/submit",
  asyncHandler(async (req, res) => {
    const auditId = Number(req.params.auditId);
    const auditControlId = Number(req.params.auditControlId);
    const explanation = String(req.body.client_explanation || "").trim();

    if (
      !Number.isInteger(auditId) ||
      auditId <= 0 ||
      !Number.isInteger(auditControlId) ||
      auditControlId <= 0
    ) {
      return res.status(400).json({
        message: "Invalid audit or control ID.",
      });
    }

    if (!explanation || explanation.length < 10) {
      return res.status(400).json({
        message: "Please provide an explanation of at least 10 characters.",
      });
    }

    if (explanation.length > 5000) {
      return res.status(400).json({
        message: "Explanation must be 5000 characters or less.",
      });
    }

    // Confirm this audit belongs to the logged-in client's organization
    const auditResult = await db.query(
      `SELECT id, status
         FROM audits
         WHERE id = $1
           AND client_org_id = (
               SELECT organisation_id
               FROM users
               WHERE id = $2
           )`,
      [auditId, req.user.id],
    );

    if (auditResult.rows.length === 0) {
      return res.status(404).json({
        message: "Audit not found or not assigned to your organization.",
      });
    }

    if (auditResult.rows[0].status !== "in_progress") {
      return res.status(400).json({
        message: "This audit is not currently accepting submissions.",
      });
    }

    // Only allow submission for controls assigned to this audit
    const result = await db.query(
      `UPDATE audit_controls
         SET
            client_explanation = $1,
            workflow_status = 'submitted',
            submitted_at = NOW()
         WHERE id = $2
           AND audit_id = $3
           AND workflow_status IN ('pending', 'more_evidence')
         RETURNING id, audit_id, control_id, client_explanation,
                   workflow_status, submitted_at`,
      [explanation, auditControlId, auditId],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message:
          "Control not found, not assigned to this audit, or already submitted for review.",
      });
    }

    res.json({
      message: "Self-assessment submitted successfully.",
      submission: result.rows[0],
    });
  }),
);

module.exports = router;
