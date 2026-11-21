const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/logger");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Admin-only audit management
router.use(authenticate, requireRole("admin"));

// GET /api/audits
// Admin views all audits.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(`
      SELECT
        a.id,
        a.title,
        a.scope,
        a.status,
        a.start_date,
        a.end_date,
        a.created_at,
        o.id AS client_org_id,
        o.name AS client_organization,
        u.id AS auditor_id,
        u.name AS auditor_name,
        COUNT(ac.id)::int AS total_controls
      FROM audits a
      JOIN organisations o ON o.id = a.client_org_id
      JOIN users u ON u.id = a.auditor_id
      LEFT JOIN audit_controls ac ON ac.audit_id = a.id
      GROUP BY a.id, o.id, o.name, u.id, u.name
      ORDER BY a.created_at DESC
    `);

    res.json(rows);
  }),
);

// POST /api/audits
// Create an audit and attach the selected ISO controls.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const title = String(req.body.title || "").trim();
    const scope = String(req.body.scope || "").trim();
    const auditorId = Number(req.body.auditor_id);
    const clientOrgId = Number(req.body.client_org_id);
    const startDate = req.body.start_date || null;
    const endDate = req.body.end_date || null;
    const controlIds = req.body.control_ids;

    // Basic validation
    if (!title || title.length > 150) {
      return res.status(400).json({
        message: "Audit title is required (maximum 150 characters).",
      });
    }

    if (!scope) {
      return res.status(400).json({
        message: "Audit scope is required.",
      });
    }

    if (!Number.isInteger(auditorId) || auditorId <= 0) {
      return res.status(400).json({
        message: "Select a valid auditor.",
      });
    }

    if (!Number.isInteger(clientOrgId) || clientOrgId <= 0) {
      return res.status(400).json({
        message: "Select a valid client organization.",
      });
    }

    if (!Array.isArray(controlIds) || controlIds.length === 0) {
      return res.status(400).json({
        message: "Select at least one ISO control.",
      });
    }

    const uniqueControlIds = [...new Set(controlIds.map(Number))];

    if (uniqueControlIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).json({
        message: "Control IDs must be valid positive integers.",
      });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        message: "End date must be on or after the start date.",
      });
    }

    // Verify auditor account and role.
    const auditorResult = await db.query(
      `SELECT id, name, role, is_active
       FROM users
       WHERE id = $1`,
      [auditorId],
    );

    const auditor = auditorResult.rows[0];

    if (!auditor || auditor.role !== "auditor" || !auditor.is_active) {
      return res.status(400).json({
        message: "Selected auditor is invalid or inactive.",
      });
    }

    // Verify client organization.
    const organizationResult = await db.query(
      `SELECT id, name, org_type
       FROM organisations
       WHERE id = $1`,
      [clientOrgId],
    );

    const organization = organizationResult.rows[0];

    if (!organization || organization.org_type !== "client") {
      return res.status(400).json({
        message: "Selected organization must be a client organization.",
      });
    }

    // Verify selected controls exist.
    const controlsResult = await db.query(
      `SELECT id, control_id
       FROM controls
       WHERE id = ANY($1::int[])`,
      [uniqueControlIds],
    );

    if (controlsResult.rows.length !== uniqueControlIds.length) {
      return res.status(400).json({
        message: "One or more selected controls do not exist.",
      });
    }

    // Save audit + selected controls in a transaction.
    const createdAudit = await db.transaction(async (client) => {
      const auditResult = await client.query(
        `INSERT INTO audits
          (title, scope, auditor_id, client_org_id,
           status, start_date, end_date)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6)
         RETURNING *`,
        [title, scope, auditorId, clientOrgId, startDate, endDate],
      );

      const audit = auditResult.rows[0];

      for (const controlId of uniqueControlIds) {
        await client.query(
          `INSERT INTO audit_controls
            (audit_id, control_id, workflow_status)
           VALUES ($1, $2, 'pending')`,
          [audit.id, controlId],
        );
      }

      return audit;
    });

    // Record the action.
    await logAction({
      userId: req.user.id,
      auditId: createdAudit.id,
      action: "audit_created",
      entity: "audit",
      entityId: createdAudit.id,
      details: {
        title,
        client_org_id: clientOrgId,
        auditor_id: auditorId,
        selected_control_count: uniqueControlIds.length,
      },
    });

    res.status(201).json({
      message: "Audit created successfully.",
      audit: createdAudit,
      selected_controls: controlsResult.rows,
    });
  }),
);

// Publish an audit so the client can access it
router.patch(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const auditId = Number(req.params.id);

    if (!Number.isInteger(auditId) || auditId <= 0) {
      return res.status(400).json({
        message: "Invalid audit ID.",
      });
    }

    const result = await db.query(
      `UPDATE audits
         SET status = 'in_progress'
         WHERE id = $1 AND status = 'draft'
         RETURNING id, title, status, client_org_id`,
      [auditId],
    );

    if (result.rows.length === 0) {
      const existing = await db.query(
        "SELECT id, status FROM audits WHERE id = $1",
        [auditId],
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          message: "Audit not found.",
        });
      }

      return res.status(400).json({
        message: `Audit cannot be published. Current status: ${existing.rows[0].status}`,
      });
    }

    const audit = result.rows[0];

    await logAction({
      userId: req.user.id,
      auditId: audit.id,
      action: "audit_published",
      entity: "audit",
      entityId: audit.id,
      details: {
        title: audit.title,
        status: audit.status,
      },
    });

    res.json({
      message: "Audit published successfully.",
      audit,
    });
  }),
);

module.exports = router;
