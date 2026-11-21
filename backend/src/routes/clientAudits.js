const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Only logged-in Client users can access these routes
router.use(authenticate, requireRole("client"));

// GET all published audits assigned to this client's organization
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT
            a.id,
            a.title,
            a.scope,
            a.status,
            a.start_date,
            a.end_date,
            a.created_at,
            o.name AS client_organization,
            u.name AS auditor_name,
            COUNT(ac.id)::int AS total_controls
         FROM audits a
         JOIN users client_user
            ON client_user.organisation_id = a.client_org_id
         JOIN organisations o
            ON o.id = a.client_org_id
         JOIN users u
            ON u.id = a.auditor_id
         LEFT JOIN audit_controls ac
            ON ac.audit_id = a.id
         WHERE client_user.id = $1
           AND a.status IN ('in_progress', 'completed')
         GROUP BY a.id, o.name, u.name
         ORDER BY a.created_at DESC`,
      [req.user.id],
    );

    res.json(rows);
  }),
);

// GET one audit with its assigned controls
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const auditId = Number(req.params.id);

    if (!Number.isInteger(auditId) || auditId <= 0) {
      return res.status(400).json({
        message: "Invalid audit ID.",
      });
    }

    const auditResult = await db.query(
      `SELECT
            a.id,
            a.title,
            a.scope,
            a.status,
            a.start_date,
            a.end_date,
            o.name AS client_organization,
            u.name AS auditor_name
         FROM audits a
         JOIN organisations o ON o.id = a.client_org_id
         JOIN users u ON u.id = a.auditor_id
         JOIN users client_user
            ON client_user.organisation_id = a.client_org_id
         WHERE a.id = $1
           AND client_user.id = $2
           AND a.status IN ('in_progress', 'completed')
         LIMIT 1`,
      [auditId, req.user.id],
    );

    if (auditResult.rows.length === 0) {
      return res.status(404).json({
        message: "Audit not found or not assigned to your organization.",
      });
    }

    const controlsResult = await db.query(
      `SELECT
            ac.id AS audit_control_id,
            c.id AS control_database_id,
            c.control_id,
            c.theme,
            c.title,
            ac.workflow_status,
            ac.result,
            ac.client_explanation,
            ac.auditor_comment
         FROM audit_controls ac
         JOIN controls c ON c.id = ac.control_id
         WHERE ac.audit_id = $1
         ORDER BY c.control_id`,
      [auditId],
    );

    res.json({
      audit: auditResult.rows[0],
      controls: controlsResult.rows,
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

    if (explanation.length < 10 || explanation.length > 5000) {
      return res.status(400).json({
        message: "Explanation must be between 10 and 5000 characters.",
      });
    }

    // Verify that the audit belongs to this client's organization
    const auditResult = await db.query(
      `SELECT id, status
       FROM audits
       WHERE id = $1
         AND client_org_id = (
           SELECT organisation_id FROM users WHERE id = $2
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
        message: "This audit is not accepting submissions.",
      });
    }

    const result = await db.query(
      `UPDATE audit_controls
       SET client_explanation = $1,
           workflow_status = 'submitted',
           submitted_at = NOW()
       WHERE id = $2
         AND audit_id = $3
         AND workflow_status IN ('pending', 'more_evidence')
       RETURNING id, audit_id, control_id,
                 client_explanation, workflow_status, submitted_at`,
      [explanation, auditControlId, auditId],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message:
          "Control not found, not assigned to this audit, or already submitted.",
      });
    }

    res.json({
      message: "Self-assessment submitted successfully.",
      submission: result.rows[0],
    });
  }),
);

module.exports = router;
