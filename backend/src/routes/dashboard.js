const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// ADMIN DASHBOARD
router.get(
  "/admin",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const [organisations, users, audits, controls, findings] =
      await Promise.all([
        db.query(
          `SELECT COUNT(*)::int AS total
         FROM organisations`,
        ),

        db.query(
          `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE is_active = true)::int AS active
         FROM users`,
        ),

        db.query(
          `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
           COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
         FROM audits`,
        ),

        db.query(
          `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE result = 'C')::int AS compliant,
           COUNT(*) FILTER (WHERE result = 'NA')::int AS not_applicable,
           COUNT(*) FILTER (WHERE result = 'PC')::int AS partially_compliant,
           COUNT(*) FILTER (WHERE result = 'NC')::int AS non_compliant,
           COUNT(*) FILTER (WHERE workflow_status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE workflow_status = 'submitted')::int AS awaiting_review,
           COUNT(*) FILTER (WHERE workflow_status = 'remediation')::int AS remediation
         FROM audit_controls`,
        ),

        db.query(
          `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'open')::int AS open,
           COUNT(*) FILTER (WHERE status = 'remediation_submitted')::int AS awaiting_verification,
           COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved
         FROM findings`,
        ),
      ]);

    const controlStats = controls.rows[0];

    const assessedControls =
      controlStats.compliant +
      controlStats.not_applicable +
      controlStats.partially_compliant +
      controlStats.non_compliant;

    const complianceRate =
      assessedControls > 0
        ? Number(
            (
              ((controlStats.compliant + controlStats.not_applicable) /
                assessedControls) *
              100
            ).toFixed(2),
          )
        : 0;

    res.json({
      organisations: organisations.rows[0],
      users: users.rows[0],
      audits: audits.rows[0],
      controls: controlStats,
      findings: findings.rows[0],
      compliance_rate: complianceRate,
    });
  }),
);

// AUDITOR DASHBOARD
router.get(
  "/auditor",
  authenticate,
  requireRole("auditor"),
  asyncHandler(async (req, res) => {
    const auditorId = req.user.id;

    const [audits, controls, findings] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (
             WHERE status = 'in_progress'
           )::int AS in_progress,
           COUNT(*) FILTER (
             WHERE status = 'completed'
           )::int AS completed,
           COUNT(*) FILTER (
             WHERE status = 'closed'
           )::int AS closed
         FROM audits
         WHERE auditor_id = $1`,
        [auditorId],
      ),

      db.query(
        `SELECT
           COUNT(ac.id)::int AS total,
           COUNT(ac.id) FILTER (
             WHERE ac.workflow_status = 'submitted'
           )::int AS awaiting_review,
           COUNT(ac.id) FILTER (
             WHERE ac.workflow_status = 'evaluated'
           )::int AS evaluated,
           COUNT(ac.id) FILTER (
             WHERE ac.workflow_status = 'remediation'
           )::int AS remediation,
           COUNT(ac.id) FILTER (
             WHERE ac.workflow_status = 'pending'
           )::int AS pending,
           COUNT(ac.id) FILTER (
             WHERE ac.result = 'C'
           )::int AS compliant,
           COUNT(ac.id) FILTER (
             WHERE ac.result = 'NA'
           )::int AS not_applicable,
           COUNT(ac.id) FILTER (
             WHERE ac.result = 'PC'
           )::int AS partially_compliant,
           COUNT(ac.id) FILTER (
             WHERE ac.result = 'NC'
           )::int AS non_compliant
         FROM audit_controls ac
         JOIN audits a ON a.id = ac.audit_id
         WHERE a.auditor_id = $1`,
        [auditorId],
      ),

      db.query(
        `SELECT
           COUNT(f.id)::int AS total,
           COUNT(f.id) FILTER (
             WHERE f.status = 'open'
           )::int AS open,
           COUNT(f.id) FILTER (
             WHERE f.status = 'remediation_submitted'
           )::int AS awaiting_verification,
           COUNT(f.id) FILTER (
             WHERE f.status = 'resolved'
           )::int AS resolved
         FROM findings f
         JOIN audit_controls ac ON ac.id = f.audit_control_id
         JOIN audits a ON a.id = ac.audit_id
         WHERE a.auditor_id = $1`,
        [auditorId],
      ),
    ]);

    res.json({
      audits: audits.rows[0],
      controls: controls.rows[0],
      findings: findings.rows[0],
    });
  }),
);

// CLIENT DASHBOARD
router.get(
  "/client",
  authenticate,
  requireRole("client"),
  asyncHandler(async (req, res) => {
    const clientId = req.user.id;

    const [audits, controls, findings, auditList] = await Promise.all([
      // Audit statistics
      db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (
             WHERE status = 'in_progress'
           )::int AS in_progress,
           COUNT(*) FILTER (
             WHERE status = 'completed'
           )::int AS completed,
           COUNT(*) FILTER (
             WHERE status = 'closed'
           )::int AS closed
         FROM audits
         WHERE client_org_id = (
           SELECT organisation_id
           FROM users
           WHERE id = $1
         )`,
        [clientId],
      ),

      // Control statistics
      db.query(
        `SELECT
           COUNT(ac.id)::int AS total,
           COUNT(ac.id) FILTER (
             WHERE ac.workflow_status = 'pending'
           )::int AS pending,
           COUNT(ac.id) FILTER (
             WHERE ac.workflow_status = 'submitted'
           )::int AS awaiting_review,
           COUNT(ac.id) FILTER (
             WHERE ac.workflow_status = 'evaluated'
           )::int AS evaluated,
           COUNT(ac.id) FILTER (
             WHERE ac.workflow_status = 'remediation'
           )::int AS remediation,
           COUNT(ac.id) FILTER (
             WHERE ac.result = 'C'
           )::int AS compliant,
           COUNT(ac.id) FILTER (
             WHERE ac.result = 'NA'
           )::int AS not_applicable,
           COUNT(ac.id) FILTER (
             WHERE ac.result = 'PC'
           )::int AS partially_compliant,
           COUNT(ac.id) FILTER (
             WHERE ac.result = 'NC'
           )::int AS non_compliant
         FROM audits a
         JOIN audit_controls ac ON ac.audit_id = a.id
         WHERE a.client_org_id = (
           SELECT organisation_id
           FROM users
           WHERE id = $1
         )`,
        [clientId],
      ),

      // Finding statistics
      db.query(
        `SELECT
           COUNT(f.id)::int AS total,
           COUNT(f.id) FILTER (
             WHERE f.status = 'open'
           )::int AS open,
           COUNT(f.id) FILTER (
             WHERE f.status = 'remediation_submitted'
           )::int AS awaiting_verification,
           COUNT(f.id) FILTER (
             WHERE f.status = 'resolved'
           )::int AS resolved
         FROM findings f
         JOIN audit_controls ac ON ac.id = f.audit_control_id
         JOIN audits a ON a.id = ac.audit_id
         WHERE a.client_org_id = (
           SELECT organisation_id
           FROM users
           WHERE id = $1
         )`,
        [clientId],
      ),

      // Recent audits list
      db.query(
        `SELECT
           a.id,
           a.title,
           a.scope,
           a.status,
           a.start_date,
           a.end_date,
           COUNT(ac.id)::int AS total_controls,
           COUNT(ac.id) FILTER (
             WHERE ac.workflow_status = 'evaluated'
           )::int AS evaluated_controls
         FROM audits a
         LEFT JOIN audit_controls ac ON ac.audit_id = a.id
         WHERE a.client_org_id = (
           SELECT organisation_id
           FROM users
           WHERE id = $1
         )
         GROUP BY a.id
         ORDER BY a.created_at DESC`,
        [clientId],
      ),
    ]);

    res.json({
      audits: audits.rows[0],
      controls: controls.rows[0],
      findings: findings.rows[0],
      audit_list: auditList.rows,
    });
  }),
);

module.exports = router;
