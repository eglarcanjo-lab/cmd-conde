# Armazenamento de fotos e vídeos (Cloudinary)

Onde a HOP guarda fotos e vídeos enviados pelo app. Anotado em 15/10/2026 (v3.85.4), quando o
tipo **"Incidente / ocorrência"** das Solicitações foi removido do código. Serve de receita para
quem precisar subir foto de novo (ex.: um tipo novo de solicitação com evidência).

## Serviço
- **Cloudinary** (pacote npm `cloudinary`, v1.x, API `v2`).
- Credenciais nas variáveis de ambiente do **backend (Railway)**:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Painel: https://console.cloudinary.com (login da conta da HOP) → Media Library.

## Pastas usadas
| Pasta no Cloudinary            | Quem grava                         | Situação |
|--------------------------------|------------------------------------|----------|
| `cmd-conde/incidentes`         | Solicitações › Incidente (antigo)  | **Removido do app** — os arquivos continuam lá; os links estão na tabela `incidentes` (coluna `evidencia_url`) |
| ver `routes/popups.js`         | Admin › Popups (artes do popup)    | Ativo |
| ver `routes/refrigeradores.js` | Equipamentos (fotos do equipamento)| Ativo |
| ver `routes/materialLeve.js`   | Equipamentos › Material leve       | Ativo |

## Como o upload era feito (rota removida `POST /api/incidentes`)
Arquivo vem do app em `multipart/form-data` (campo `evidencia`), fica só na memória e vai
direto para o Cloudinary; no banco grava-se só o link (`secure_url`).

```js
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// até 100 MB, sem gravar em disco
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post("/", upload.single("evidencia"), async (req, res) => {
  const resultado = await new Promise((resolve, reject) => {
    const resourceType = req.file.mimetype.startsWith("video") ? "video" : "image";
    const stream = cloudinary.uploader.upload_stream(
      { folder: "cmd-conde/incidentes", resource_type: resourceType },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(req.file.buffer);
  });
  // resultado.secure_url → gravar na tabela
});
```

No app (frontend):
```js
const form = new FormData();
form.append("evidencia", arquivo);          // <input type="file" accept="image/*,video/*">
await api.post("/rota", form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
```

## Histórico preservado
- Tabela `incidentes` (cadastro): `id | data_criacao | setor | nome_rn | descricao | evidencia_url | status | resposta | finalizado_em | data_ocorrido | perfil_rn`.
- O código completo antigo está no git, antes do commit da v3.85.4 (`backend/src/routes/incidentes.js`, `frontend/src/pages/Incidentes/index.jsx`, `frontend/src/pages/Admin/Incidentes.jsx`).
