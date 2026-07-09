const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const db = require("../services/db");
const { authMiddleware, gestorOnly } = require("../middleware/auth");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

router.use(authMiddleware);

function gerarId() {
  return Date.now().toString(36).toUpperCase();
}

function uploadFoto(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "cmd-conde/refrigeradores", resource_type: "image" },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(file.buffer);
  });
}

const CATEGORIAS = ["SOPI", "VISA"];
const STATUS = ["Estoque", "Quebrado", "Comodatado"];

// POST /api/refrigeradores — cadastra um refrigerador
router.post(
  "/",
  upload.fields([{ name: "foto_etiqueta", maxCount: 1 }, { name: "foto_equipamento", maxCount: 1 }]),
  async (req, res) => {
    try {
      const {
        item, modelo, serial, rg, categoria, status,
        numero_controle_interno, cod_pdv, nome_fantasia, data_chegada,
      } = req.body;

      if (!item?.trim()) return res.status(400).json({ error: "Item obrigatório." });
      if (categoria && !CATEGORIAS.includes(categoria)) return res.status(400).json({ error: "Categoria inválida." });
      if (status && !STATUS.includes(status)) return res.status(400).json({ error: "Status inválido." });

      const fotoEtiqueta = req.files?.foto_etiqueta?.[0];
      const fotoEquipamento = req.files?.foto_equipamento?.[0];
      if (!fotoEtiqueta) return res.status(400).json({ error: "Foto da etiqueta obrigatória." });
      if (!fotoEquipamento) return res.status(400).json({ error: "Foto do equipamento obrigatória." });

      const [resEtiqueta, resEquipamento] = await Promise.all([
        uploadFoto(fotoEtiqueta),
        uploadFoto(fotoEquipamento),
      ]);

      const id = gerarId();
      const criado_em = new Date().toLocaleString("pt-BR");

      await db.query(
        `INSERT INTO refrigeradores
          (id, item, modelo, serial, rg, categoria, status, numero_controle_interno,
           cod_pdv, nome_fantasia, foto_etiqueta_url, foto_equipamento_url, data_chegada,
           criado_por, criado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id, item.trim(), modelo?.trim() || null, serial?.trim() || null, rg?.trim() || null,
          categoria || null, status || null, numero_controle_interno?.trim() || null,
          cod_pdv || null, nome_fantasia || null,
          resEtiqueta.secure_url, resEquipamento.secure_url,
          data_chegada || new Date().toISOString().split("T")[0],
          req.user.nome, criado_em,
        ]
      );

      return res.json({ success: true, id });
    } catch (err) {
      console.error("Erro ao cadastrar refrigerador:", err);
      return res.status(500).json({ error: "Erro ao cadastrar refrigerador." });
    }
  }
);

// GET /api/refrigeradores — lista com filtros opcionais
router.get("/", async (req, res) => {
  try {
    const { status, categoria, cod_pdv, q } = req.query;
    const where = [];
    const params = [];

    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (categoria) { params.push(categoria); where.push(`categoria = $${params.length}`); }
    if (cod_pdv) { params.push(cod_pdv); where.push(`cod_pdv = $${params.length}`); }
    if (q?.trim()) {
      params.push(`%${q.trim()}%`);
      const i = params.length;
      where.push(`(item ILIKE $${i} OR modelo ILIKE $${i} OR serial ILIKE $${i} OR rg ILIKE $${i} OR numero_controle_interno ILIKE $${i})`);
    }

    const sql = `SELECT * FROM refrigeradores ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY criado_em DESC`;
    const { rows } = await db.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar refrigeradores:", err);
    return res.status(500).json({ error: "Erro ao listar refrigeradores." });
  }
});

// GET /api/refrigeradores/:id
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM refrigeradores WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Refrigerador não encontrado." });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar refrigerador." });
  }
});

// PUT /api/refrigeradores/:id — edita campos e, opcionalmente, as fotos
router.put(
  "/:id",
  upload.fields([{ name: "foto_etiqueta", maxCount: 1 }, { name: "foto_equipamento", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { rows } = await db.query("SELECT * FROM refrigeradores WHERE id = $1", [req.params.id]);
      const atual = rows[0];
      if (!atual) return res.status(404).json({ error: "Refrigerador não encontrado." });

      const {
        item, modelo, serial, rg, categoria, status,
        numero_controle_interno, cod_pdv, nome_fantasia, data_chegada,
      } = req.body;

      if (categoria && !CATEGORIAS.includes(categoria)) return res.status(400).json({ error: "Categoria inválida." });
      if (status && !STATUS.includes(status)) return res.status(400).json({ error: "Status inválido." });

      const fotoEtiquetaFile = req.files?.foto_etiqueta?.[0];
      const fotoEquipamentoFile = req.files?.foto_equipamento?.[0];
      const [novaEtiqueta, novoEquipamento] = await Promise.all([
        fotoEtiquetaFile ? uploadFoto(fotoEtiquetaFile) : null,
        fotoEquipamentoFile ? uploadFoto(fotoEquipamentoFile) : null,
      ]);

      await db.query(
        `UPDATE refrigeradores SET
           item = $1, modelo = $2, serial = $3, rg = $4, categoria = $5, status = $6,
           numero_controle_interno = $7, cod_pdv = $8, nome_fantasia = $9,
           foto_etiqueta_url = $10, foto_equipamento_url = $11, data_chegada = $12
         WHERE id = $13`,
        [
          item?.trim() || atual.item, modelo?.trim() ?? atual.modelo, serial?.trim() ?? atual.serial,
          rg?.trim() ?? atual.rg, categoria || atual.categoria, status || atual.status,
          numero_controle_interno?.trim() ?? atual.numero_controle_interno,
          cod_pdv ?? atual.cod_pdv, nome_fantasia ?? atual.nome_fantasia,
          novaEtiqueta?.secure_url || atual.foto_etiqueta_url,
          novoEquipamento?.secure_url || atual.foto_equipamento_url,
          data_chegada || atual.data_chegada,
          req.params.id,
        ]
      );

      return res.json({ success: true });
    } catch (err) {
      console.error("Erro ao editar refrigerador:", err);
      return res.status(500).json({ error: "Erro ao editar refrigerador." });
    }
  }
);

// DELETE /api/refrigeradores/:id — só gestor
router.delete("/:id", gestorOnly, async (req, res) => {
  try {
    await db.query("DELETE FROM refrigeradores WHERE id = $1", [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao excluir refrigerador." });
  }
});

module.exports = router;
