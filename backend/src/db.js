// Shared PostgreSQL connection for the backend.
const pool = require("./config/db");

// Runs several queries as one transaction.
async function transaction(work) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  transaction,
  pool,
};
