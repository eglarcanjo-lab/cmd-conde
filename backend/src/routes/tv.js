// Painel TV — slides para a Smart TV da empresa (logo, 10 princípios, princípio em destaque,
// volumes da operação, avisos, recados do RH, vagas). Conteúdo editado em Admin › Painel TV.
//
// A TV abre /tv e digita o CÓDIGO de 6 números (ou /tv?k=CÓDIGO), sem login. GET /api/tv/painel valida a chave e devolve TUDO que a TV
// precisa (nada de dado sensível: só o consolidado da operação, sem RN). Admin edita por
// /api/tv/admin/* (login admin). Isento da manutenção (middleware/maintenance.js) p/ a TV não apagar.
//
// Tabelas (criadas sozinhas, TEXT, via sobrescreverAba):
//   tv_itens  — id, tipo, titulo, texto, imagem_url, ativo, data_inicio, data_fim, ordem, duracao, criado_em
//               tipo: principio | destaque | aviso | rh | vaga
//   tv_config — chave, valor   (chave da TV, logo, tempos e slides ligados — JSON em "config")
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { readSheet, sobrescreverAba } = require("../services/sheets");
const { authMiddleware, adminOnly } = require("../middleware/auth");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const TIPOS = ["principio", "destaque", "aviso", "rh", "vaga"];
const HEADERS = ["id", "tipo", "titulo", "texto", "imagem_url", "ativo", "data_inicio", "data_fim", "ordem", "duracao", "criado_em"];
// Slides na ordem em que passam. Tempo padrão (s) de cada um — o item pode ter o próprio.
const SLIDES = ["abertura", "principios", "destaque", "volumes", "aviso", "rh", "vagas"];
const CONFIG_PADRAO = {
  chave: "",
  logo_url: "",
  nome: "CMD",
  tempos: { abertura: 10, principios: 25, destaque: 15, volumes: 20, aviso: 15, rh: 15, vagas: 20 },
  ligados: { abertura: true, principios: true, destaque: true, volumes: true, aviso: true, rh: true, vagas: true },
};

const isTrue = (v) => ["true", "1", "sim"].includes(String(v).trim().toLowerCase());
const gerarId = () => "TV" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString("hex").toUpperCase();
// Código de 6 números (fácil de digitar no controle da TV). Painel não tem dado sensível
// (só consolidado da operação + avisos) e o chute é limitado por IP (ver tentativasErradas).
const gerarChave = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
const chaveValida = (c) => /^d{6}$/.test(String(c || ""));
// Anti-chute: 10 códigos errados por IP em 15 min → bloqueia até a janela passar.
const _erros = new Map(); // ip → { n, ts }
const JANELA_ERROS = 15 * 60 * 1000, MAX_ERROS = 10;
const ipDe = (req) => String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
function bloqueado(ip) { const e = _erros.get(ip); if (!e) return false; if (Date.now() - e.ts > JANELA_ERROS) { _erros.delete(ip); return false; } return e.n >= MAX_ERROS; }
function errou(ip) { const e = _erros.get(ip); if (!e || Date.now() - e.ts > JANELA_ERROS) _erros.set(ip, { n: 1, ts: Date.now() }); else e.n++; if (_erros.size > 5000) _erros.clear(); }
const hojeISO = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function lerItens() {
  const rows = await readSheet("tv_itens").catch(() => []);
  return rows.filter((r) => r && r.id);
}
async function gravarItens(lista) {
  await sobrescreverAba("tv_itens", [HEADERS, ...lista.map((r) => HEADERS.map((h) => r[h] ?? ""))]);
}
async function lerConfig() {
  const rows = await readSheet("tv_config").catch(() => []);
  const raw = rows.find((r) => r.chave === "config")?.valor;
  let c = {};
  try { c = raw ? JSON.parse(raw) : {}; } catch { c = {}; }
  return {
    ...CONFIG_PADRAO, ...c,
    tempos: { ...CONFIG_PADRAO.tempos, ...(c.tempos || {}) },
    ligados: { ...CONFIG_PADRAO.ligados, ...(c.ligados || {}) },
  };
}
async function gravarConfig(cfg) {
  await sobrescreverAba("tv_config", [["chave", "valor"], ["config", JSON.stringify(cfg)]]);
}
// Primeira vez: cria a chave da TV sozinho.
async function configComChave() {
  const cfg = await lerConfig();
  if (!chaveValida(cfg.chave)) { cfg.chave = gerarChave(); await gravarConfig(cfg); } // 1ª vez ou chave antiga (longa) → código de 6 números
  return cfg;
}

const cloudinaryOk = () => !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
function uploadCloudinary(buffer, mimetype) {
  return new Promise((resolve, reject) => {
    const resource_type = mimetype?.startsWith("video") ? "video" : "image";
    const stream = cloudinary.uploader.upload_stream(
      { folder: "cmd-conde/tv", resource_type, timeout: 60000 },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Volumes: consolidado da operação (mesmo cálculo do Report Volumes do WhatsApp). Cache 5 min —
// a TV chama a cada poucos minutos e o cálculo lê rv_resultado/rv_volume inteiros.
let _volCache = { ts: 0, data: null };
async function volumesOperacao() {
  if (_volCache.data && Date.now() - _volCache.ts < 5 * 60 * 1000) return _volCache.data;
  const { montarMensagens } = require("./farol-volumes");
  const m = await montarMensagens();
  const rep = m && m.report;
  const linha = rep?.secoes?.[0]?.linhas?.[0];
  const data = !linha ? null : {
    data: m.data, diasUteis: m.diasUteis,
    categorias: rep.categorias.map((c) => {
      const v = linha.cats[c.key] || {};
      return {
        key: c.key, label: c.label,
        meta: v._meta ?? null, real: v._real ?? 0, tend: v._tend ?? 0,
        pct: v._p ?? null, pctT: v._pT ?? null,
        metaFmt: v.meta, realFmt: v.real, tendFmt: v.tend,
      };
    }),
  };
  _volCache = { ts: Date.now(), data };
  return data;
}

// ─── PÚBLICO (TV, com chave) ─────────────────────────────────────────────────────

// GET /api/tv/painel?k=CHAVE
router.get("/painel", async (req, res) => {
  try {
    const cfg = await lerConfig();
    const k = String(req.query.k || "").replace(/D/g, "");
    const ip = ipDe(req);
    if (bloqueado(ip)) return res.status(429).json({ error: "Muitos códigos errados. Espere 15 minutos." });
    if (!cfg.chave || !k || k.length !== cfg.chave.length
        || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(cfg.chave))) {
      errou(ip);
      return res.status(403).json({ error: "Código da TV inválido. Veja o código em Admin › Painel TV." });
    }
    _erros.delete(ip);
    const hoje = hojeISO();
    const vigente = (r) => isTrue(r.ativo)
      && (!r.data_inicio || String(r.data_inicio).slice(0, 10) <= hoje)
      && (!r.data_fim || String(r.data_fim).slice(0, 10) >= hoje);
    const ord = (a, b) => (parseInt(a.ordem) || 99) - (parseInt(b.ordem) || 99);
    const limpa = ({ id, tipo, titulo, texto, imagem_url, ordem, duracao }) =>
      ({ id, tipo, titulo, texto, imagem_url, ordem, duracao: parseInt(duracao) || null });
    const itens = (await lerItens()).filter(vigente).sort(ord).map(limpa);
    const por = (t) => itens.filter((i) => i.tipo === t);

    let volumes = null;
    if (cfg.ligados.volumes) volumes = await volumesOperacao().catch((e) => { console.error("tv volumes:", e.message); return null; });

    res.set("Cache-Control", "no-store");
    return res.json({
      gerado_em: new Date().toISOString(),
      nome: cfg.nome, logo_url: cfg.logo_url, tempos: cfg.tempos, ligados: cfg.ligados, ordem: SLIDES,
      principios: por("principio"), destaques: por("destaque"), avisos: por("aviso"), rh: por("rh"), vagas: por("vaga"),
      volumes,
    });
  } catch (e) {
    console.error("tv/painel:", e);
    return res.status(500).json({ error: "Erro ao montar o painel." });
  }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────────
const adm = [authMiddleware, adminOnly];

router.get("/admin", adm, async (req, res) => {
  try {
    const [cfg, itens] = await Promise.all([configComChave(), lerItens()]);
    return res.json({ config: cfg, itens, tipos: TIPOS, slides: SLIDES });
  } catch (e) {
    console.error("tv admin GET:", e);
    return res.status(500).json({ error: "Erro ao carregar o Painel TV." });
  }
});

// PUT /api/tv/admin/config — { nome, logo_url, tempos, ligados }
router.put("/admin/config", adm, async (req, res) => {
  try {
    const cfg = await configComChave();
    const b = req.body || {};
    if (b.nome !== undefined) cfg.nome = String(b.nome).slice(0, 60);
    if (b.logo_url !== undefined) cfg.logo_url = String(b.logo_url);
    if (b.tempos) SLIDES.forEach((s) => { const n = parseInt(b.tempos[s]); if (n >= 3 && n <= 600) cfg.tempos[s] = n; });
    if (b.ligados) SLIDES.forEach((s) => { if (b.ligados[s] !== undefined) cfg.ligados[s] = !!b.ligados[s]; });
    await gravarConfig(cfg);
    return res.json({ success: true, config: cfg });
  } catch (e) {
    console.error("tv config PUT:", e);
    return res.status(500).json({ error: "Erro ao salvar a configuração." });
  }
});

// POST /api/tv/admin/chave — gera uma chave nova (o link antigo para de funcionar)
router.post("/admin/chave", adm, async (req, res) => {
  try {
    const cfg = await lerConfig();
    cfg.chave = gerarChave();
    await gravarConfig(cfg);
    return res.json({ success: true, chave: cfg.chave });
  } catch (e) {
    return res.status(500).json({ error: "Erro ao gerar a chave." });
  }
});

// POST /api/tv/admin/upload — sobe imagem (logo/aviso/RH) e devolve a URL
router.post("/admin/upload", adm, upload.single("imagem"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Envie a imagem." });
    if (!cloudinaryOk()) return res.status(500).json({ error: "Upload indisponível: Cloudinary não configurado (CLOUDINARY_*)." });
    const r = await uploadCloudinary(req.file.buffer, req.file.mimetype);
    return res.json({ success: true, url: r.secure_url });
  } catch (e) {
    console.error("tv upload:", e);
    return res.status(500).json({ error: `Erro no upload: ${e.message}` });
  }
});

function montarItem(b, base = {}) {
  const tipo = TIPOS.includes(b.tipo) ? b.tipo : base.tipo;
  return {
    ...base,
    tipo,
    titulo: b.titulo !== undefined ? String(b.titulo) : (base.titulo || ""),
    texto: b.texto !== undefined ? String(b.texto) : (base.texto || ""),
    imagem_url: b.imagem_url !== undefined ? String(b.imagem_url) : (base.imagem_url || ""),
    ativo: b.ativo !== undefined ? (isTrue(b.ativo) || b.ativo === true ? "true" : "false") : (base.ativo || "true"),
    data_inicio: b.data_inicio !== undefined ? String(b.data_inicio || "") : (base.data_inicio || ""),
    data_fim: b.data_fim !== undefined ? String(b.data_fim || "") : (base.data_fim || ""),
    ordem: b.ordem !== undefined ? String(b.ordem || "") : (base.ordem || ""),
    duracao: b.duracao !== undefined ? String(b.duracao || "") : (base.duracao || ""),
  };
}

router.post("/admin/item", adm, async (req, res) => {
  try {
    const b = req.body || {};
    if (!TIPOS.includes(b.tipo)) return res.status(400).json({ error: "Tipo inválido." });
    if (!String(b.titulo || "").trim() && !String(b.texto || "").trim() && !b.imagem_url) {
      return res.status(400).json({ error: "Preencha o título, o texto ou a imagem." });
    }
    const itens = await lerItens();
    const novo = { ...montarItem(b), id: gerarId(), criado_em: new Date().toISOString() };
    if (!novo.ordem) novo.ordem = String(itens.filter((i) => i.tipo === novo.tipo).length + 1);
    await gravarItens([...itens, novo]);
    return res.json({ success: true, item: novo });
  } catch (e) {
    console.error("tv item POST:", e);
    return res.status(500).json({ error: "Erro ao salvar o item." });
  }
});

router.put("/admin/item/:id", adm, async (req, res) => {
  try {
    const itens = await lerItens();
    const i = itens.findIndex((x) => x.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "Item não encontrado." });
    itens[i] = montarItem(req.body || {}, itens[i]);
    await gravarItens(itens);
    return res.json({ success: true, item: itens[i] });
  } catch (e) {
    console.error("tv item PUT:", e);
    return res.status(500).json({ error: "Erro ao salvar o item." });
  }
});

router.delete("/admin/item/:id", adm, async (req, res) => {
  try {
    const itens = await lerItens();
    await gravarItens(itens.filter((x) => x.id !== req.params.id));
    return res.json({ success: true });
  } catch (e) {
    console.error("tv item DELETE:", e);
    return res.status(500).json({ error: "Erro ao remover o item." });
  }
});

module.exports = router;
