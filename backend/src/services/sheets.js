// Camada de dados do backend — SEMPRE PostgreSQL (Supabase), implementada em sqlRepo.js.
// A implementação antiga em Google Sheets (googleapis) foi removida na auditoria de out/2026:
// a migração p/ SQL está concluída e a planilha virou só um backup congelado (não é mais
// lida nem gravada). O nome do arquivo fica porque as rotas fazem
// require("../services/sheets"). Estrutura das tabelas: backend/db/schema.sql.
// O código antigo está no git (antes da v3.86.0).
module.exports = require("./sqlRepo");
