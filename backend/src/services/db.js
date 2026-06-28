// Pool de conexão PostgreSQL (Supabase) — usado pelo sqlRepo quando DATA_BACKEND=sql.
// pg só é carregado aqui; se a dependência/URL faltar, só o modo SQL falha.
const { Pool } = require("pg");

let _pool = null;
function getPool() {
  if (!_pool) {
    const cs = process.env.DATABASE_URL;
    if (!cs) throw new Error("DATABASE_URL não configurada no ambiente do backend.");
    _pool = new Pool({
      connectionString: cs,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      // Supabase exige SSL; o node-pg não liga sozinho (ao contrário do psycopg2).
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

module.exports = { query, getPool };
