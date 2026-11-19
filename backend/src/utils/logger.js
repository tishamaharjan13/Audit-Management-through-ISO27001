// Writes to the audit_logs table: who did what, and when (traceability).
// Never put passwords, tokens or reset codes in "details".
const db = require("../db");

async function logAction({
  userId = null,
  auditId = null,
  action,
  entity = null,
  entityId = null,
  details = null,
}) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, audit_id, action, entity, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        auditId,
        action,
        entity,
        entityId,
        details ? JSON.stringify(details) : null,
      ],
    );
  } catch (err) {
    console.error("Could not write audit log:", err.message); // logging must never break the request
  }
}

module.exports = { logAction };
