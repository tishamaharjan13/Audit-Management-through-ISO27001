const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/logger");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate, requireRole("auditor"));

// GET audits assigned to the logged-in auditor
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
            o.name AS client_organization,
            COUNT(ac.id)::int AS total_controls,
            COUNT(ac.id) FILTER (
                WHERE ac.workflow_status = 'submitted'
            )::int AS awaiting_review,
            COUNT(ac.id) FILTER (
                WHERE ac.workflow_status = 'evaluated'
            )::int AS evaluated_controls,
            COUNT(ac.id) FILTER (
                WHERE ac.workflow_status = 'remediation'
            )::int AS remediation_controls
         FROM audits a
         JOIN organisations o ON o.id = a.client_org_id
         LEFT JOIN audit_controls ac ON ac.audit_id = a.id
         WHERE a.auditor_id = $1
         GROUP BY a.id, o.name
         ORDER BY a.created_at DESC`,
      [req.user.id],
    );

    res.json(rows);
  }),
);

// GET one assigned audit and its controls
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const auditId = Number(req.params.id);

    if (!Number.isInteger(auditId) || auditId <= 0) {
      return res.status(400).json({ message: "Invalid audit ID." });
    }

    const auditResult = await db.query(
      `SELECT
            a.id,
            a.title,
            a.scope,
            a.status,
            a.start_date,
            a.end_date,
            o.name AS client_organization
         FROM audits a
         JOIN organisations o ON o.id = a.client_org_id
         WHERE a.id = $1 AND a.auditor_id = $2`,
      [auditId, req.user.id],
    );

    if (auditResult.rows.length === 0) {
      return res.status(404).json({
        message: "Audit not found or not assigned to you.",
      });
    }

    const { rows: controls } = await db.query(
      `SELECT
            ac.id AS audit_control_id,
            c.control_id,
            c.theme,
            c.title,
            ac.workflow_status,
            ac.result,
            ac.client_explanation,
            ac.auditor_comment,
            ac.submitted_at,
            ac.evaluated_at
         FROM audit_controls ac
         JOIN controls c ON c.id = ac.control_id
         WHERE ac.audit_id = $1
         ORDER BY c.control_id`,
      [auditId],
    );

    res.json({
      audit: auditResult.rows[0],
      controls,
    });
  }),
);

// Evaluate a submitted control
router.patch(
  "/:auditId/controls/:auditControlId/evaluate",
  asyncHandler(async (req, res) => {
    const auditId = Number(req.params.auditId);
    const auditControlId = Number(req.params.auditControlId);

    const resultCode = String(req.body.result || "").toUpperCase();
    const auditorComment = String(req.body.auditor_comment || "").trim();

    const findingDescription = String(
      req.body.finding_description || "",
    ).trim();

    const severity = String(req.body.severity || "medium").toLowerCase();
    const dueDate = req.body.due_date || null;

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

    if (!["C", "NA", "PC", "NC"].includes(resultCode)) {
      return res.status(400).json({
        message: "Result must be C, NA, PC, or NC.",
      });
    }

    if (auditorComment.length > 5000) {
      return res.status(400).json({
        message: "Auditor comment must be 5000 characters or less.",
      });
    }

    const needsFinding = ["PC", "NC"].includes(resultCode);

    if (needsFinding) {
      if (findingDescription.length < 10) {
        return res.status(400).json({
          message: "Provide a finding description of at least 10 characters.",
        });
      }

      if (!["low", "medium", "high"].includes(severity)) {
        return res.status(400).json({
          message: "Severity must be low, medium, or high.",
        });
      }

      if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return res.status(400).json({
          message: "A due date in YYYY-MM-DD format is required for PC and NC.",
        });
      }
    }

    const outcome = await db.transaction(async (client) => {
      // Verify that this audit belongs to the logged-in auditor
      const auditCheck = await client.query(
        `SELECT id
                 FROM audits
                 WHERE id = $1 AND auditor_id = $2
                   AND status = 'in_progress'`,
        [auditId, req.user.id],
      );

      if (auditCheck.rows.length === 0) {
        const error = new Error(
          "Audit not found, not assigned to you, or not active.",
        );
        error.status = 404;
        throw error;
      }

      // Only evaluate controls that the client has submitted
      const controlUpdate = await client.query(
        `UPDATE audit_controls
                 SET result = $1,
                     auditor_comment = $2,
                     workflow_status = $3,
                     evaluated_by = $4,
                     evaluated_at = NOW()
                 WHERE id = $5
                   AND audit_id = $6
                   AND workflow_status = 'submitted'
                 RETURNING id, audit_id, control_id, result,
                           auditor_comment, workflow_status, evaluated_at`,
        [
          resultCode,
          auditorComment || null,
          needsFinding ? "remediation" : "evaluated",
          req.user.id,
          auditControlId,
          auditId,
        ],
      );

      if (controlUpdate.rows.length === 0) {
        const error = new Error(
          "Control not found, not submitted, or already evaluated.",
        );
        error.status = 400;
        throw error;
      }

      let finding = null;

      if (needsFinding) {
        const findingResult = await client.query(
          `INSERT INTO findings
                        (audit_control_id, severity, description,
                         due_date, created_by)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, audit_control_id, severity,
                               description, due_date, status`,
          [auditControlId, severity, findingDescription, dueDate, req.user.id],
        );

        finding = findingResult.rows[0];
      }

      return {
        control: controlUpdate.rows[0],
        finding,
      };
    });

    await logAction({
      userId: req.user.id,
      auditId,
      action: "control_evaluated",
      entity: "audit_control",
      entityId: auditControlId,
      details: {
        result: resultCode,
        finding_created: needsFinding,
      },
    });

    res.json({
      message: "Control evaluated successfully.",
      ...outcome,
    });
  }),
);

// AUDITOR: VERIFY CLIENT CORRECTIVE ACTION
router.patch(
  "/:auditId/findings/:findingId/verify",
  asyncHandler(async (req, res) => {
    const auditId = Number(req.params.auditId);
    const findingId = Number(req.params.findingId);
    const { verified, auditor_feedback } = req.body;

    const feedback = String(auditor_feedback || "").trim();

    if (
      !Number.isInteger(auditId) ||
      auditId <= 0 ||
      !Number.isInteger(findingId) ||
      findingId <= 0
    ) {
      return res.status(400).json({ message: "Invalid IDs." });
    }

    if (typeof verified !== "boolean") {
      return res.status(400).json({
        message: "verified must be true or false.",
      });
    }

    if (feedback.length < 5 || feedback.length > 5000) {
      return res.status(400).json({
        message: "Feedback must be between 5 and 5000 characters.",
      });
    }

    const submission = await db.transaction(async (client) => {
      const findingResult = await client.query(
        `SELECT f.id, f.status, ac.id AS audit_control_id
         FROM findings f
         JOIN audit_controls ac ON ac.id = f.audit_control_id
         JOIN audits a ON a.id = ac.audit_id
         WHERE f.id = $1
           AND a.id = $2
           AND a.auditor_id = $3
           AND a.status = 'in_progress'
         FOR UPDATE OF f`,
        [findingId, auditId, req.user.id],
      );

      if (!findingResult.rows.length) {
        const error = new Error("Finding not found or not assigned to you.");
        error.status = 404;
        throw error;
      }

      if (findingResult.rows[0].status !== "remediation_submitted") {
        const error = new Error("No pending remediation to verify.");
        error.status = 400;
        throw error;
      }

      const latest = await client.query(
        `SELECT id
         FROM remediation_submissions
         WHERE finding_id = $1
         ORDER BY round_no DESC
         LIMIT 1
         FOR UPDATE`,
        [findingId],
      );

      if (!latest.rows.length) {
        const error = new Error("Remediation submission not found.");
        error.status = 404;
        throw error;
      }

      const updated = await client.query(
        `UPDATE remediation_submissions
         SET verified = $1,
             auditor_feedback = $2,
             verified_at = NOW()
         WHERE id = $3
         RETURNING id, finding_id, round_no, verified,
                   auditor_feedback, verified_at`,
        [verified, feedback, latest.rows[0].id],
      );

      if (verified) {
        await client.query(
          `UPDATE findings
           SET status = 'resolved', resolved_at = NOW()
           WHERE id = $1`,
          [findingId],
        );

        await client.query(
          `UPDATE audit_controls
           SET workflow_status = 'evaluated'
           WHERE id = $1`,
          [findingResult.rows[0].audit_control_id],
        );
      } else {
        await client.query(
          `UPDATE findings
           SET status = 'open'
           WHERE id = $1`,
          [findingId],
        );
      }

      return updated.rows[0];
    });

    await logAction({
      userId: req.user.id,
      auditId,
      action: verified ? "remediation_accepted" : "remediation_rejected",
      entity: "finding",
      entityId: findingId,
      details: { auditor_feedback: feedback },
    });

    res.json({
      message: verified
        ? "Corrective action accepted. Finding resolved."
        : "Corrective action rejected. Client can resubmit.",
      submission,
    });
  }),
);

module.exports = router;
