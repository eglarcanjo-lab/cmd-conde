// Menu ÚNICO do app (Auditoria out/26): as duas Homes (clássica e dashboard) e o Admin
// leem daqui. Tela nova = 1 linha em MODULOS; aba nova do Admin = 1 linha em ADMIN_TABS.
//
// Regras de perfil por item:
//   perfis: [...]  → só esses perfis veem (ex.: ["admin"], ["admin","director"])
//   semGestao      → admin/director não veem (é do RN/GV, ex.: Remuneração)
//   semRn          → RN não vê
//   grupo: "admin" → fica dentro do grupo Admin na barra lateral (Home dashboard)

export const MODULOS = [
  { icon: "🏆", label: "Incentivos",               route: "/incentivos-rn" },
  { icon: "🗂️", label: "Outros relatórios",        route: "/incentivos" },
  { icon: "📈", label: "Volume Diário",            route: "/volume-diario" },
  { icon: "📊", label: "Cobertura & Distribuição", route: "/cobertura" },
  { icon: "🗺️", label: "PDVs",                     route: "/pdvs" },
  { icon: "📦", label: "Produtos",                 route: "/produtos" },
  { icon: "✅", label: "Tasks",                    route: "/tasks" },
  { icon: "💰", label: "Remuneração",              route: "/rv", semGestao: true },
  { icon: "🏅", label: "SPO",                      route: "/spo" },
  { icon: "🚨", label: "Solicitações",             route: "/incidentes" },
  { icon: "🧾", label: "Faturados × Buffer",       route: "/faturados-buffer" },
  { icon: "🌿", label: "Devolução × Ruptura",      route: "/detalhamento" },
  { icon: "🛣️", label: "Rota Efetiva",             route: "/rota-efetiva", semRn: true },
  { icon: "🧊", label: "Equipamentos",             route: "/refrigeradores", perfis: ["admin", "director"] },
  { icon: "🧮", label: "RV Simulador",             route: "/rv-admin", perfis: ["admin", "director"] },
  { icon: "🏷️", label: "Ações de Preço",           route: "/acoes-preco", perfis: ["admin"], grupo: "admin" },
  { icon: "📋", label: "Input de Tasks",           route: "/input-tasks", perfis: ["admin"], grupo: "admin" },
];

export function modulosDoPerfil(perfil) {
  const gestao = perfil === "admin" || perfil === "director";
  return MODULOS.filter((m) => {
    if (m.perfis && !m.perfis.includes(perfil)) return false;
    if (m.semGestao && gestao) return false;
    if (m.semRn && perfil === "rn") return false;
    return true;
  });
}

// Abas do Admin (deep-link /admin?tab=id). Agrupadas por assunto.
export const ADMIN_TABS = [
  { id: "usuarios",      icon: "👥", label: "Usuários",      grupo: "Pessoas" },
  { id: "engajamento",   icon: "📉", label: "Engajamento",   grupo: "Pessoas" },
  { id: "metas",         icon: "🎯", label: "Metas",         grupo: "Metas e RV" },
  { id: "ap",            icon: "🎯", label: "AT. Produtivo", grupo: "Metas e RV" },
  { id: "spo_metas",     icon: "🏅", label: "SPO Metas",     grupo: "Metas e RV" },
  { id: "spo_desafios",  icon: "📋", label: "SPO Desafios",  grupo: "Metas e RV" },
  { id: "incentivos",    icon: "🏆", label: "Campanhas",     grupo: "Metas e RV" },
  { id: "arquivos",      icon: "📁", label: "Arquivos",      grupo: "Dados" },
  { id: "produtos",      icon: "📦", label: "Produtos",      grupo: "Dados" },
  { id: "alertas",       icon: "📧", label: "Alertas",       grupo: "Dados" },
  { id: "configuracoes", icon: "⚙️", label: "Configurações", grupo: "Dados" },
  { id: "incidentes",    icon: "🚨", label: "Solicitações",  grupo: "Comunicação" },
  { id: "popups",        icon: "🖼️", label: "Popups",        grupo: "Comunicação" },
  { id: "avisos",        icon: "❔", label: "Avisos",        grupo: "Comunicação" },
];
export const ADMIN_GRUPOS = ["Pessoas", "Metas e RV", "Dados", "Comunicação"];
