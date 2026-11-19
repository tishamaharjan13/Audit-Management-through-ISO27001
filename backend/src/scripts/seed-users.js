// Creates the demo organisations and the 3 demo users (with bcrypt-hashed passwords).
// Run:  npm run seed      (safe to run again; it resets these 3 demo accounts)
// FOR DEVELOPMENT ONLY. Delete these accounts before a real deployment.
const bcrypt = require("bcryptjs");
const db = require("../db");

async function ensureOrg(name, type) {
  const found = await db.query("SELECT id FROM organisations WHERE name = $1", [
    name,
  ]);
  if (found.rows[0]) {
    await db.query("UPDATE organisations SET org_type = $2 WHERE id = $1", [
      found.rows[0].id,
      type,
    ]);
    return found.rows[0].id;
  }
  const created = await db.query(
    "INSERT INTO organisations (name, org_type) VALUES ($1, $2) RETURNING id",
    [name, type],
  );
  return created.rows[0].id;
}

async function main() {
  const firmId = await ensureOrg("Audit Firm Ltd", "audit_firm");
  const clientId = await ensureOrg("Demo Client Company", "client");

  const demo = [
    {
      name: "Admin User",
      email: "admin@audit.com",
      password: "Admin@123",
      role: "admin",
      org: firmId,
    },
    {
      name: "Jasana Kayastha",
      email: "auditor@audit.com",
      password: "Auditor@123",
      role: "auditor",
      org: firmId,
    },
    {
      name: "Client Representative",
      email: "client@audit.com",
      password: "Client@123",
      role: "client",
      org: clientId,
    },
  ];

  for (const u of demo) {
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, organisation_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
         organisation_id = EXCLUDED.organisation_id, is_active = TRUE, failed_logins = 0, locked_until = NULL`,
      [u.name, u.email, await bcrypt.hash(u.password, 12), u.role, u.org],
    );
    console.log(`Ready: ${u.email} (${u.role})`);
  }
  await db.pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
