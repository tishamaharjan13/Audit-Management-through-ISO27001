const express = require("express");
const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const upload = require("../middleware/upload");

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
ac.auditor_comment,
ac.evidence_file_name,
ac.evidence_file_path,
ac.evidence_uploaded_at
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

// CLIENT SUBMITS A SELF-ASSESSMENT WITH EVIDENCE
router.post(
  "/:auditId/controls/:auditControlId/submit",
  upload.single("evidence"),
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

    const fileName = req.file ? req.file.originalname : null;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await db.query(
      `UPDATE audit_controls
       SET client_explanation = $1,
           evidence_file_name = $2,
           evidence_file_path = $3,
           evidence_uploaded_at = CASE
             WHEN $3::text IS NOT NULL THEN NOW()
             ELSE NULL
           END,
           workflow_status = 'submitted',
           submitted_at = NOW()
       WHERE id = $4
         AND audit_id = $5
         AND workflow_status IN ('pending', 'more_evidence')
       RETURNING id, audit_id, control_id,
                 client_explanation,
                 evidence_file_name,
                 evidence_file_path,
                 evidence_uploaded_at,
                 workflow_status,
                 submitted_at`,
      [explanation, fileName, filePath, auditControlId, auditId],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message:
          "Control not found, not assigned to this audit, or already submitted.",
      });
    }

    res.json({
      message: "Self-assessment and evidence submitted successfully.",
      submission: result.rows[0],
    });
  }),
);

// CLIENT: VIEW FINDINGS THAT REQUIRE CORRECTIVE ACTION
router.get(
  "/remediation/findings",
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT
                f.id AS finding_id,
                f.severity,
                f.description,
                f.due_date,
                f.status AS finding_status,
                c.control_id,
                c.title AS control_title,
                a.id AS audit_id,
                a.title AS audit_title
             FROM findings f
             JOIN audit_controls ac ON ac.id = f.audit_control_id
             JOIN controls c ON c.id = ac.control_id
             JOIN audits a ON a.id = ac.audit_id
             JOIN users client_user
                ON client_user.organisation_id = a.client_org_id
             WHERE client_user.id = $1
               AND a.status = 'in_progress'
               AND f.status IN ('open', 'remediation_submitted')
             ORDER BY f.due_date ASC NULLS LAST`,
      [req.user.id],
    );

    res.json(rows);
  }),
);

// CLIENT: SUBMIT CORRECTIVE ACTION FOR A FINDING
router.post(
  "/:auditId/findings/:findingId/remediation",
  asyncHandler(async (req, res) => {
    const auditId = Number(req.params.auditId);
    const findingId = Number(req.params.findingId);
    const clientResponse = String(req.body.client_response || "").trim();

    if (
      !Number.isInteger(auditId) ||
      auditId <= 0 ||
      !Number.isInteger(findingId) ||
      findingId <= 0
    ) {
      return res.status(400).json({
        message: "Invalid audit or finding ID.",
      });
    }

    if (clientResponse.length < 10 || clientResponse.length > 5000) {
      return res.status(400).json({
        message:
          "Corrective-action explanation must be between 10 and 5000 characters.",
      });
    }

    const submission = await db.transaction(async (client) => {
      // Verify that the finding belongs to this client's organization
      const findingResult = await client.query(
        `SELECT f.id, f.status
                 FROM findings f
                 JOIN audit_controls ac ON ac.id = f.audit_control_id
                 JOIN audits a ON a.id = ac.audit_id
                 JOIN users client_user
                    ON client_user.organisation_id = a.client_org_id
                 WHERE f.id = $1
                   AND a.id = $2
                   AND client_user.id = $3
                   AND a.status = 'in_progress'
                 FOR UPDATE OF f`,
        [findingId, auditId, req.user.id],
      );

      if (findingResult.rows.length === 0) {
        const error = new Error(
          "Finding not found or not assigned to your organization.",
        );
        error.status = 404;
        throw error;
      }

      if (findingResult.rows[0].status !== "open") {
        const error = new Error(
          "This finding is not currently accepting a remediation submission.",
        );
        error.status = 400;
        throw error;
      }

      const roundResult = await client.query(
        `SELECT COALESCE(MAX(round_no), 0)::int AS last_round
                 FROM remediation_submissions
                 WHERE finding_id = $1`,
        [findingId],
      );

      const nextRound = roundResult.rows[0].last_round + 1;

      const inserted = await client.query(
        `INSERT INTO remediation_submissions
                    (finding_id, round_no, client_response, submitted_by)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, finding_id, round_no,
                           client_response, submitted_at`,
        [findingId, nextRound, clientResponse, req.user.id],
      );

      await client.query(
        `UPDATE findings
                 SET status = 'remediation_submitted'
                 WHERE id = $1`,
        [findingId],
      );

      return inserted.rows[0];
    });

    res.status(201).json({
      message: "Corrective action submitted successfully.",
      submission,
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
      return res.status(400).json({
        message: "Invalid audit or finding ID.",
      });
    }

    if (typeof verified !== "boolean") {
      return res.status(400).json({
        message: "verified must be true or false.",
      });
    }

    if (feedback.length < 5 || feedback.length > 5000) {
      return res.status(400).json({
        message: "Auditor feedback must be between 5 and 5000 characters.",
      });
    }

    const result = await db.transaction(async (client) => {
      // Confirm this finding belongs to an audit assigned to this auditor.
      const findingResult = await client.query(
        `SELECT
           f.id,
           f.status,
           ac.id AS audit_control_id
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
        error.statusCode = 404;
        throw error;
      }

      if (findingResult.rows[0].status !== "remediation_submitted") {
        const error = new Error(
          "This finding does not have a pending remediation submission.",
        );
        error.statusCode = 400;
        throw error;
      }

      // Get the latest client submission.
      const submissionResult = await client.query(
        `SELECT id, round_no
         FROM remediation_submissions
         WHERE finding_id = $1
         ORDER BY round_no DESC
         LIMIT 1
         FOR UPDATE`,
        [findingId],
      );

      if (!submissionResult.rows.length) {
        const error = new Error("No remediation submission found.");
        error.statusCode = 404;
        throw error;
      }

      const submission = submissionResult.rows[0];

      // Save the auditor's decision and feedback.
      const updatedSubmission = await client.query(
        `UPDATE remediation_submissions
         SET verified = $1,
             auditor_feedback = $2,
             verified_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [verified, feedback, submission.id],
      );

      if (verified) {
        // Accepted: close the finding.
        await client.query(
          `UPDATE findings
           SET status = 'resolved',
               resolved_at = NOW()
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
        // Rejected: allow the client to submit another remediation round.
        await client.query(
          `UPDATE findings
           SET status = 'open'
           WHERE id = $1`,
          [findingId],
        );
      }

      return updatedSubmission.rows[0];
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
        : "Corrective action rejected. Client can submit another response.",
      submission: result,
    });
  }),
);

module.exports = router;
