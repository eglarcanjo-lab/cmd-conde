const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const db = require("../services/db");
const { authMiddleware, adminDiretorOnly } = require("../middleware/auth");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

router.use(authMiddleware);
router.use(adminDiretorOnly);

function gerarId() {
  return Date.now().toString(36).toUpperCase();
}

function uploadFoto(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "cmd-conde/material-leve", resource_type: "image" },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(file.buffer);
  });
}

// POST /api/material-leve — cadastra um item de material leve
router.post("/", upload.single("foto"), async (req, res) => {
  try {
    const { tipo, quantidade, cod_pdv, nome_fantasia, data_registro } = req.body;

    if (!tipo?.trim()) return res.status(400).json({ error: "Tipo obrigatório." });
    if (!req.file) return res.status(400).json({ error: "Foto obrigatória." });

    const resultado = await uploadFoto(req.file);

    const id = gerarId();
    const criado_em = new Date().toLocaleString("pt-BR");

    await db.query(
      `INSERT INTO material_leve
        (id, tipo, quantidade, cod_pdv, nome_fantasia, foto_url, data_registro, criado_por, criado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id, tipo.trim(), Number(quantidade) || 0, cod_pdv || null, nome_fantasia || null,
        resultado.secure_url, data_registro || new Date().toISOString().split("T")[0],
        req.user.nome, criado_em,
      ]
    );

    return res.json({ success: true, id });
  } catch (err) {
    console.error("Erro ao cadastrar material leve:", err);
    return res.status(500).json({ error: "Erro ao cadastrar material leve." });
  }
});

// GET /api/material-leve — lista com filtros opcionais
router.get("/", async (req, res) => {
  try {
    const { cod_pdv, q } = req.query;
    const where = [];
    const params = [];

    if (cod_pdv) { params.push(cod_pdv); where.push(`cod_pdv = $${params.length}`); }
    if (q?.trim()) { params.push(`%${q.trim()}%`); where.push(`tipo ILIKE $${params.length}`); }

    const sql = `SELECT * FROM material_leve ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY criado_em DESC`;
    const { rows } = await db.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar material leve:", err);
    return res.status(500).json({ error: "Erro ao listar material leve." });
  }
});

// PUT /api/material-leve/:id
router.put("/:id", upload.single("foto"), async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM material_leve WHERE id = $1", [req.params.id]);
    const atual = rows[0];
    if (!atual) return res.status(404).json({ error: "Registro não encontrado." });

    const { tipo, quantidade, cod_pdv, nome_fantasia, data_registro } = req.body;
    const novaFoto = req.file ? await uploadFoto(req.file) : null;

    await db.query(
      `UPDATE material_leve SET
         tipo = $1, quantidade = $2, cod_pdv = $3, nome_fantasia = $4, foto_url = $5, data_registro = $6
       WHERE id = $7`,
      [
        tipo?.trim() || atual.tipo,
        quantidade != null && quantidade !== "" ? Number(quantidade) : atual.quantidade,
        cod_pdv ?? atual.cod_pdv, nome_fantasia ?? atual.nome_fantasia,
        novaFoto?.secure_url || atual.foto_url,
        data_registro || atual.data_registro,
        req.params.id,
      ]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Erro ao editar material leve:", err);
    return res.status(500).json({ error: "Erro ao editar material leve." });
  }
});

// DELETE /api/material-leve/:id
router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM material_leve WHERE id = $1", [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao excluir registro." });
  }
});

module.exports = router;
