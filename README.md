# CMD Ambev · Conde — RN App

Plataforma de gestão de campo para Representantes de Negócios da CMD Ambev.

---

## Stack

| Camada | Tecnologia | Hospedagem |
|---|---|---|
| Frontend | React + Vite | Vercel (grátis) |
| Backend | Node.js + Express | Railway (~$5/mês) |
| Banco de dados | Google Sheets API | Google Cloud (grátis) |
| Auth | OTP via WhatsApp Business API Meta | — |
| Imagens | Cloudinary | Grátis até 25GB |

---

## Estrutura do Projeto

```
cmd-conde/
├── backend/
│   ├── src/
│   │   ├── index.js              # Entrada principal
│   │   ├── routes/
│   │   │   ├── auth.js           # OTP + JWT
│   │   │   └── admin.js          # Gestão de usuários e metas
│   │   ├── services/
│   │   │   ├── sheets.js         # Google Sheets API
│   │   │   └── whatsapp.js       # WhatsApp Business API
│   │   └── middleware/
│   │       ├── auth.js           # JWT + controle de perfis
│   │       └── maintenance.js    # Janela de manutenção
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx               # Rotas
    │   ├── contexts/
    │   │   └── AuthContext.jsx   # Auth global
    │   ├── services/
    │   │   └── api.js            # Axios configurado
    │   ├── components/
    │   │   └── PrivateRoute.jsx  # Proteção de rotas
    │   └── pages/
    │       ├── Login.jsx         # Tela de login + OTP
    │       ├── Home.jsx          # Dashboard inicial
    │       └── Manutencao.jsx    # Tela de manutenção
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Configuração Local

### 1. Clonar e instalar

```bash
git clone https://github.com/seu-usuario/cmd-conde.git
cd cmd-conde

# Backend
cd backend
npm install
cp .env.example .env
# Preencha o .env com suas credenciais

# Frontend
cd ../frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:3001
```

### 2. Variáveis de ambiente do Backend (.env)

```env
GOOGLE_SHEET_ID=1nqeNqOx0rxpDbjyu512nuHkbmvayhh-yfASd-CZBIvI
GOOGLE_SERVICE_ACCOUNT_EMAIL=seu-service@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

WHATSAPP_TOKEN=seu_token_meta
WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id
WHATSAPP_OTP_TEMPLATE=otp_autenticacao

JWT_SECRET=string_aleatoria_longa_aqui

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ADMIN_WHATSAPP=5583XXXXXXXXX
MAINTENANCE_START=05:00
MAINTENANCE_END=06:00
```

### 3. Rodar em desenvolvimento

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

---

## Deploy

### Backend → Railway

1. Crie um projeto no [railway.app](https://railway.app)
2. Conecte o repositório GitHub, selecione a pasta `/backend`
3. Configure todas as variáveis de ambiente no painel do Railway
4. Deploy automático a cada push

### Frontend → Vercel

1. Importe o repositório no [vercel.com](https://vercel.com)
2. Configure Root Directory: `frontend`
3. Adicione a variável: `VITE_API_URL=https://seu-backend.railway.app`
4. Deploy automático a cada push

---

## Perfis de Acesso

| Perfil | Código | Acesso |
|---|---|---|
| Gestor | `admin` | Tudo + Configurações |
| Diretor | `director` | Tudo, sem config |
| Supervisor GV1 | `gv1` | RNs 101–106 |
| Supervisor GV3 | `gv3` | RNs 301–305 |
| RN | `101`–`305` | Próprio setor |

---

## Fases de Desenvolvimento

- [x] **Fase 1** — Base, autenticação OTP, Google Sheets, Admin básico
- [ ] **Fase 2** — Cobertura, PDVs, Produtos, Tasks
- [ ] **Fase 3** — Incidentes com imagens e notificações
- [ ] **Fase 4** — Remuneração Variável (RV)
- [ ] **Fase 5** — Assistente IA
- [ ] **Fase 6** — SPO (futura)
