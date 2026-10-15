// Teste rápido (smoke) do backend — rodar ANTES de cada versão (Auditoria out/26, ação 8):
//   node backend/scripts/smoke.js
// Carrega TODAS as rotas com o banco SIMULADO (nada toca produção, nada vai pra rede) e
// chama cada GET como admin em 2 cenários: banco vazio e banco com dados de exemplo.
// Falha (exit 1) se alguma rota quebrar ao carregar, lançar erro, responder 500 ou travar.
process.env.JWT_SECRET = process.env.JWT_SECRET || "smoke";
process.env.DATA_BACKEND = "sql";
const Module = require("module");
const path = require("path");
const fs = require("fs");

const SRC = path.join(__dirname, "..", "src");
const MES = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
const HOJE = new Date().toLocaleDateString("pt-BR");

// Linha "coringa": tem os campos mais usados pelas rotas, com valores plausíveis.
const LINHA = {
  cod: "101", nome: "TESTE", cpf: "11111111111", perfil: "admin", gv: "1", ativo: "true", senha: "x",
  setor: "101", cod_pdv: "1000", nome_pdv: "PDV TESTE", nome_fantasia: "PDV TESTE", cidade: "CONDE", bairro: "CENTRO",
  segmento: "BAR", categoria: "CERVEJA", categorias: "CERVEJA", dia_visita: "SEG", cod_produto: "33857",
  nome_produto: "PRODUTO TESTE", volume_hl: "1,5", volume: "1,5", meta: "10", meta_volume: "10", realizado: "5",
  mes_referencia: MES, mes: MES, data: HOJE, status: "Aguardando", valor: "100", qtd: "1", item: "1",
  bees: "123", nf: "456", pedido: "789", nota: "456", hl_marcacao: "1", hl_entrega: "1", telas_json: "{}",
};
let cenario = "vazio";
const linhas = () => (cenario === "vazio" ? [] : [{ ...LINHA }]);

// ── Mocks: banco, rede e serviços externos ──────────────────────────────────────
const fake = {
  readSheet: async () => linhas(), readSheetMonths: async () => linhas(),
  appendRow: async () => {}, updateRow: async () => {}, deleteRow: async () => {},
  sobrescrever: async () => {}, writeSheet: async () => {}, clearSheet: async () => {},
  initializeSheets: async () => {}, ensureTab: async () => {}, cacheClearAll: () => {}, cacheClear: () => {},
};
const fakeSheets = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : async () => linhas()) });
// SELECT com agregação (MAX/COUNT/SUM…) sem GROUP BY sempre devolve 1 linha no Postgres real.
const AGREG = /\b(MAX|MIN|COUNT|SUM|AVG)\s*\(/i;
const fakeDb = {
  query: async (sql) => ({ rows: cenario === "vazio" && AGREG.test(sql) && !/GROUP BY/i.test(sql) ? [{ proximo: 1, count: 0, n: 0, total: 0 }] : linhas(), rowCount: 0 }),
  getPool: () => ({ query: async () => ({ rows: [] }) }),
};
const semRede = async () => { throw new Error("smoke: sem rede"); };
const orig = Module._load;
Module._load = function (req, parent, ...rest) {
  if (/services[\\/]sheets$|\/sheets$/.test(req) && req.includes("sheets")) return fakeSheets;
  if (/(^|\/)db$/.test(req) && parent && parent.filename.startsWith(SRC)) return fakeDb;
  if (req === "axios") return Object.assign(semRede, { get: semRede, post: semRede, create: () => ({ get: semRede, post: semRede }) });
  if (req === "cloudinary") return { v2: { config: () => {}, uploader: { upload: semRede, upload_stream: semRede, destroy: semRede } } };
  if (req === "node-cron") return { schedule: () => ({ stop() {} }) };
  return orig.call(this, req, parent, ...rest);
};
global.fetch = semRede;

// ── Executa ──────────────────────────────────────────────────────────────────────
const ADMIN = { cod: "101", nome: "SMOKE", perfil: "admin", gv: "1" };
const chamar = (stack, req) => new Promise((resolve) => {
  let code = 200, fim = false;
  const done = (r) => { if (!fim) { fim = true; resolve(r); } };
  const res = {
    status(c) { code = c; return this; }, json(b) { done({ code, b }); return this; }, send(b) { done({ code, b }); return this; },
    end() { done({ code }); return this; }, setHeader() { return this; }, set() { return this; }, type() { return this; },
    attachment() { return this; }, sendFile() { done({ code }); }, download() { done({ code }); }, redirect() { done({ code: 302 }); },
    write() { return true; }, getHeader() { return undefined; }, headersSent: false, locals: {},
  };
  const run = (i) => {
    if (i >= stack.length) return done({ code: 404 });
    try {
      const r = stack[i].handle(req, res, (err) => (err ? done({ code: 500, b: { error: String(err) } }) : run(i + 1)));
      if (r && r.catch) r.catch((e) => done({ code: 500, b: { error: e.stack || String(e) } }));
    } catch (e) { done({ code: 500, b: { error: e.stack || String(e) } }); }
  };
  run(0);
  setTimeout(() => done({ code: "TIMEOUT" }), 8000);
});

(async () => {
  const falhas = [];
  let total = 0;
  const arquivos = fs.readdirSync(path.join(SRC, "routes")).filter((f) => f.endsWith(".js"));
  const erroLog = console.error; const logs = [];
  console.error = (...a) => logs.push(a.join(" ")); // as rotas logam erros esperados (ex.: sem rede)
  for (const f of arquivos) {
    let router;
    try { router = require(path.join(SRC, "routes", f)); }
    catch (e) { falhas.push(`${f}: NÃO CARREGA — ${e.message}`); continue; }
    if (!router || !router.stack) continue;
    for (const layer of router.stack) {
      if (!layer.route || !layer.route.methods.get) continue;
      const rota = layer.route.path;
      const params = Object.fromEntries((rota.match(/:(\w+)/g) || []).map((p) => [p.slice(1), "1"]));
      for (const c of ["vazio", "exemplo"]) {
        cenario = c; total++;
        const req = { method: "GET", query: { mes: MES, meses: MES, q: "1", item: "grupo:cerveja", indicador: "cobertura" }, params,
          user: ADMIN, headers: {}, body: {}, originalUrl: `/api/${f}${rota}`, get: () => "" };
        const r = await chamar(layer.route.stack, req);
        if (r.code === 500 || r.code === "TIMEOUT") {
          const msg = String(r.b?.error || r.code).split("\n").slice(0, 2).join(" | ");
          // 500 por falta de rede (serviço externo) não é bug do código
          if (!/sem rede/.test(msg) && !logs.some((l) => /sem rede/.test(l) && l.includes(rota))) falhas.push(`${f} GET ${rota} [${c}] → ${r.code}: ${msg}`);
        }
      }
    }
  }
  console.error = erroLog;
  console.log(`Smoke: ${total} chamadas em ${arquivos.length} arquivos de rota.`);
  if (falhas.length) { console.log(`❌ ${falhas.length} falha(s):\n - ` + falhas.join("\n - ")); process.exit(1); }
  console.log("✅ Tudo respondeu sem erro.");
  process.exit(0);
})();
