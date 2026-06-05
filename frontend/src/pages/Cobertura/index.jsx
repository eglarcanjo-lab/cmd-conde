import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const CATEGORIAS = [
  { key: "GIRO RGB",                   label: "GIRO RGB" },
  { key: "LITRINHO",                   label: "LITRINHO" },
  { key: "CERVEJA",                    label: "CERVEJA" },
  { key: "CERVEJA ZERO",               label: "CERV. ZERO" },
  { key: "CERVEJA MULTIPACK",          label: "MULTIPACK" },
  { key: "HE",                         label: "HE" },
  { key: "NAB",                        label: "NAB" },
  { key: "NAB ZERO",                   label: "NAB ZERO" },
  { key: "MATCH",                      label: "MATCH" },
  { key: "MKTP",                       label: "MKTP" },
  { key: "BALANCED CHOICE",            label: "BALANCED" },
  { key: "TRIMARCA RGB HE (Original)", label: "Trimarca HE Original" },
  { key: "TRIMARCA RGB HE (Stella)",   label: "Trimarca HE Stella" },
  { key: "TRIMARCA RGB HE (Spaten)",   label: "Trimarca HE Spaten" },
];

// Primeiras 11 categorias (sem os sub-SKUs HE)
const CAT_MAIN = CATEGORIAS.slice(0, 11);

const DIAS = [
  { key: "SEG", label: "Segunda" },
  { key: "TER", label: "Terça" },
  { key: "QUA", label: "Quarta" },
  { key: "QUI", label: "Quinta" },
  { key: "SEX", label: "Sexta" },
  { key: "SAB", label: "Sábado" },
];

const STATUS_COLORS = {
  OK:       { bg: "rgba(34,197,94,0.15)",  color: "#4ade80" },
  PENDENTE: { bg: "rgba(125,186,61,0.15)",  color: "#7DBA3D" },
  NOK:      { bg: "rgba(239,68,68,0.15)",  color: "#f87171" },
  "—":      { bg: "transparent",           color: "rgba(255,255,255,0.15)" },
};

function getDiaHoje() {
  const dias = ["DOM","SEG","TER","QUA","QUI","SEX","SAB"];
  return dias[new Date().getDay()];
}

// Normaliza qualquer formato de dia → "SEG", "TER", "QUA", "QUI", "SEX", "SAB"
const DIA_MAP = {
  SEG: "SEG", SEGUNDA: "SEG", "SEGUNDA-FEIRA": "SEG", "2": "SEG",
  TER: "TER", TERCA: "TER", "TERÇA": "TER", "TERCA-FEIRA": "TER", "TERÇA-FEIRA": "TER", "3": "TER",
  QUA: "QUA", QUARTA: "QUA", "QUARTA-FEIRA": "QUA", "4": "QUA",
  QUI: "QUI", QUINTA: "QUI", "QUINTA-FEIRA": "QUI", "5": "QUI",
  SEX: "SEX", SEXTA: "SEX", "SEXTA-FEIRA": "SEX", "6": "SEX",
  SAB: "SAB", SABADO: "SAB", "SÁBADO": "SAB", "SABADO-LETIVO": "SAB", "7": "SAB",
};
function normalizeDia(raw) {
  const s = String(raw || "").trim().toUpperCase().split(/[\/,; \-]/)[0].trim();
  return DIA_MAP[s] || s;
}

function corNumDist(n) {
  if (n === 0) return "#f87171";
  if (n === 1) return "#fb923c";
  if (n <= 3)  return "#7DBA3D";
  return "#4ade80";
}

export default function Cobertura() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [cobertura, setCobertura]       = useState([]);
  const [pdvBase, setPdvBase]           = useState([]);
  const [pdvMix, setPdvMix]             = useState([]);
  const [produtosBase, setProdutosBase] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [diaFiltro, setDiaFiltro]   = useState(getDiaHoje());
  const [busca, setBusca]           = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroRN, setFiltroRN]     = useState("");
  const [filtroNOKCat, setFiltroNOKCat] = useState("");
  const [aba, setAba]               = useState("cobertura");
  const [catFiltro, setCatFiltro]   = useState(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [resC, resP, resM, resPB] = await Promise.all([
        api.get("/api/cobertura"),
        api.get("/api/cobertura/pdv-base"),
        api.get("/api/pdvs/mix").catch(() => ({ data: [] })),
        api.get("/api/pdvs/categorias-produto").catch(() => ({ data: [] })),
      ]);
      setCobertura(resC.data || []);
      setPdvBase(resP.data || []);
      setPdvMix(resM.data || []);
      setProdutosBase(resPB.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const isGestor = ["admin","director","gv1","gv3"].includes(usuario?.perfil);
  const isAdmin  = usuario?.perfil === "admin";

  // Opções de RN (setor) para o filtro admin — derivadas de toda a base
  const rnOptions = isAdmin
    ? [...new Set(pdvBase.map((p) => p.setor).filter(Boolean))].sort()
    : [];

  const coberturaSetor = isGestor ? cobertura
    : cobertura.filter((r) => r.setor === usuario?.cod);

  const pdvSetor = isGestor ? pdvBase
    : pdvBase.filter((r) => r.setor === usuario?.cod);

  const pdvsDia = pdvSetor.filter((p) => normalizeDia(p.dia_visita) === diaFiltro);

  // Mapa cobertura: { cod_pdv: { categoria: status } }
  const mapaCob = {};
  coberturaSetor.forEach((r) => {
    if (!mapaCob[r.cod_pdv]) mapaCob[r.cod_pdv] = {};
    mapaCob[r.cod_pdv][r.categoria] = r.status;
  });

  // ── Map cod_produto → categorias[] usando produtos_base (suporta multi-categoria)
  const mapProdCats = {};
  produtosBase.forEach((p) => {
    const rawCats = p.categorias || p.categoria || "";
    if (!rawCats || !p.cod) return;
    const cats = String(rawCats).split(/[,;|]/).map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (cats.length) mapProdCats[String(p.cod).trim()] = cats;
  });

  // ── Mapa distribuição: { cod_pdv: { categoria: Set<cod_prod> } }
  // Usa produtos_base.categorias para suportar múltiplas categorias por produto.
  // mapaNomeProd: cod_prod → nome_prod (para exibir nos top3/bottom3)
  const mapaNomeProd = {};
  const mapaDist = {};
  pdvMix.forEach((r) => {
    const cod = String(r.cod_prod || "").trim();
    const pdv = String(r.cod_pdv  || "").trim();
    if (!cod || !pdv) return;
    if (r.nome_prod) mapaNomeProd[cod] = r.nome_prod;
    // Categorias via produtos_base (multi-categoria); fallback para pdv_mix.categoria
    const cats = mapProdCats[cod] || [String(r.categoria || "").trim().toUpperCase()].filter(Boolean);
    cats.forEach((cat) => {
      if (!cat) return;
      if (!mapaDist[pdv]) mapaDist[pdv] = {};
      if (!mapaDist[pdv][cat]) mapaDist[pdv][cat] = new Set();
      mapaDist[pdv][cat].add(cod);
    });
  });

  // ── Estatísticas por categoria — usando produtos_base para multi-categoria
  const catStats = {};
  CAT_MAIN.forEach((c) => {
    // pdvSkus: cod_pdv → Set<cod_prod> para esta categoria
    const pdvSkus = {};
    // skuPdvs: cod_prod → Set<cod_pdv> para ranquear top/bottom
    const skuPdvs = {};
    pdvMix.forEach((r) => {
      const cod = String(r.cod_prod || "").trim();
      const pdv = String(r.cod_pdv  || "").trim();
      if (!cod || !pdv) return;
      const cats = mapProdCats[cod] || [String(r.categoria || "").trim().toUpperCase()].filter(Boolean);
      if (!cats.includes(c.key)) return;
      if (!pdvSkus[pdv]) pdvSkus[pdv] = new Set();
      pdvSkus[pdv].add(cod);
      if (!skuPdvs[cod]) skuPdvs[cod] = new Set();
      skuPdvs[cod].add(pdv);
    });
    const total       = Object.values(pdvSkus).reduce((s, set) => s + set.size, 0);
    const pdvsComDist = Object.keys(pdvSkus).length;
    const sorted = Object.entries(skuPdvs)
      .map(([cod, pdvSet]) => [mapaNomeProd[cod] || cod, pdvSet.size])
      .sort((a, b) => b[1] - a[1]);
    catStats[c.key] = {
      total,
      pdvsComDist,
      top3:    sorted.slice(0, 3),
      bottom3: sorted.length > 3 ? [...sorted].reverse().slice(0, 3) : [],
    };
  });

  // ── PDVs do dia com dados enriquecidos ────────────────────────────────────
  const pdvsComDados = pdvsDia.map((p) => {
    const distByCat = {};
    CAT_MAIN.forEach((c) => {
      distByCat[c.key] = mapaDist[p.cod_pdv]?.[c.key]?.size ?? 0;
    });
    const distTotal = Object.values(distByCat).reduce((s, v) => s + v, 0);
    return { ...p, cob: mapaCob[p.cod_pdv] || {}, distByCat, distTotal };
  });

  const pdvsFiltrados = pdvsComDados.filter((p) => {
    const buscaOk   = !busca
      || p.nome_fantasia?.toLowerCase().includes(busca.toLowerCase())
      || p.cod_pdv?.includes(busca);
    const statusOk  = !filtroStatus  || Object.values(p.cob).includes(filtroStatus);
    const rnOk      = !filtroRN      || String(p.setor) === String(filtroRN);
    const nokCatOk  = !filtroNOKCat  || p.cob[filtroNOKCat] === "NOK";
    return buscaOk && statusOk && rnOk && nokCatOk;
  });

  const pdvsDistFiltrados = pdvsComDados.filter((p) =>
    !busca
      || p.nome_fantasia?.toLowerCase().includes(busca.toLowerCase())
      || p.cod_pdv?.includes(busca)
  );

  // ── Resumo cobertura por categoria ───────────────────────────────────────
  function calcResumo(pdvList) {
    const resumo = {};
    CATEGORIAS.forEach((c) => { resumo[c.key] = { OK: 0, PENDENTE: 0, NOK: 0, total: 0 }; });
    pdvList.forEach((p) => {
      CATEGORIAS.forEach((c) => {
        const st = mapaCob[p.cod_pdv]?.[c.key];
        if (st && resumo[c.key]) {
          resumo[c.key][st] = (resumo[c.key][st] || 0) + 1;
          resumo[c.key].total++;
        }
      });
    });
    return resumo;
  }

  const resumoTotal = calcResumo(pdvSetor);
  const totalOk   = Object.values(resumoTotal).reduce((a, b) => a + b.OK, 0);
  const totalPend = Object.values(resumoTotal).reduce((a, b) => a + b.PENDENTE, 0);
  const totalNok  = Object.values(resumoTotal).reduce((a, b) => a + b.NOK, 0);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title}>📊 Cobertura & Distribuição</h1>
            <p style={styles.subtitle}>Setor {usuario?.cod} · {usuario?.nome}</p>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Sair</button>
      </div>

      <div style={styles.content}>

        {/* ── Sub-abas ── */}
        <div style={styles.abas}>
          <button
            style={{ ...styles.abaBtn, ...(aba === "cobertura" ? styles.abaBtnAtivo : {}) }}
            onClick={() => setAba("cobertura")}
          >
            📊 Cobertura
          </button>
          <button
            style={{ ...styles.abaBtn, ...(aba === "distribuicao" ? styles.abaBtnAtivo : {}) }}
            onClick={() => setAba("distribuicao")}
          >
            📦 Distribuição
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ABA COBERTURA
        ════════════════════════════════════════════════════════════════════ */}
        {aba === "cobertura" && (
          <>
            {/* Dashboard */}
            <div style={styles.dashRow}>
              <div style={styles.dashCard}>
                <p style={styles.dashLabel}>PDVs na base</p>
                <p style={styles.dashVal}>{pdvSetor.length}</p>
              </div>
              <div style={{ ...styles.dashCard, borderColor: "rgba(34,197,94,0.3)" }}>
                <p style={styles.dashLabel}>✅ OK (total base)</p>
                <p style={{ ...styles.dashVal, color: "#4ade80" }}>{totalOk}</p>
              </div>
              <div style={{ ...styles.dashCard, borderColor: "rgba(125,186,61,0.3)" }}>
                <p style={styles.dashLabel}>⏳ Pendente</p>
                <p style={{ ...styles.dashVal, color: "#7DBA3D" }}>{totalPend}</p>
              </div>
              <div style={{ ...styles.dashCard, borderColor: "rgba(239,68,68,0.3)" }}>
                <p style={styles.dashLabel}>❌ NOK</p>
                <p style={{ ...styles.dashVal, color: "#f87171" }}>{totalNok}</p>
              </div>
              <div style={{ ...styles.dashCard, borderColor: "rgba(125,186,61,0.2)" }}>
                <p style={styles.dashLabel}>📅 Visitas hoje</p>
                <p style={{ ...styles.dashVal, color: "#7DBA3D" }}>{pdvsDia.length}</p>
              </div>
            </div>

            {/* Resumo por categoria */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Resumo por Categoria — Base Total</h3>
              <div style={styles.catGrid}>
                {CATEGORIAS.map((c) => {
                  const r = resumoTotal[c.key] || { OK: 0, PENDENTE: 0, NOK: 0, total: 0 };
                  const pct = r.total > 0 ? Math.round((r.OK / r.total) * 100) : 0;
                  return (
                    <div key={c.key} style={styles.catCard}>
                      <p style={styles.catLabel}>{c.label}</p>
                      <p style={styles.catPct}>{pct}%</p>
                      <div style={styles.catBar}>
                        <div style={{ ...styles.catBarFill, width: `${pct}%`, background: pct >= 70 ? "#4ade80" : pct >= 40 ? "#7DBA3D" : "#f87171" }} />
                      </div>
                      <div style={styles.catCounts}>
                        <span style={{ color: "#4ade80" }}>{r.OK}</span>
                        <span style={{ color: "#7DBA3D" }}>{r.PENDENTE}</span>
                        <span style={{ color: "#f87171" }}>{r.NOK}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visitas do dia */}
            <div style={styles.section}>
              <div style={styles.diaRow}>
                <h3 style={styles.sectionTitle}>Visitas do Dia</h3>
                <div style={styles.diasBtns}>
                  {DIAS.map((d) => (
                    <button key={d.key}
                      style={{ ...styles.diaBtn, ...(diaFiltro === d.key ? styles.diaBtnAtivo : {}) }}
                      onClick={() => setDiaFiltro(d.key)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.filtrosRow}>
                <input style={styles.inputFiltro} placeholder="Buscar PDV..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                <select style={styles.inputFiltro} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                  <option value="">Todos os status</option>
                  <option value="OK">OK</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="NOK">NOK</option>
                </select>
                <select
                  style={{ ...styles.inputFiltro, borderColor: filtroNOKCat ? "rgba(248,113,113,0.5)" : undefined }}
                  value={filtroNOKCat}
                  onChange={(e) => setFiltroNOKCat(e.target.value)}
                >
                  <option value="">NOK por categoria...</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                {isAdmin && (
                  <select
                    style={{ ...styles.inputFiltro, borderColor: filtroRN ? "rgba(125,186,61,0.5)" : undefined }}
                    value={filtroRN}
                    onChange={(e) => setFiltroRN(e.target.value)}
                  >
                    <option value="">Todos os RNs</option>
                    {rnOptions.map((rn) => (
                      <option key={rn} value={rn}>{rn}</option>
                    ))}
                  </select>
                )}
                <span style={styles.countLabel}>{pdvsFiltrados.length} PDVs</span>
              </div>
              {loading ? (
                <p style={styles.msg}>Carregando...</p>
              ) : pdvsFiltrados.length === 0 ? (
                <p style={styles.msg}>Nenhum PDV encontrado para {diaFiltro}.</p>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, ...styles.thFixed }}>Cód</th>
                        <th style={{ ...styles.th, minWidth: "160px" }}>Nome</th>
                        <th style={styles.th}>Cidade</th>
                        {CATEGORIAS.map((c) => (
                          <th key={c.key} style={{ ...styles.th, ...styles.thCat }}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pdvsFiltrados.map((p) => (
                        <tr key={p.cod_pdv} style={styles.tr}>
                          <td style={{ ...styles.td, ...styles.thFixed }}>
                            <span style={styles.codBadge}>{p.cod_pdv}</span>
                          </td>
                          <td style={{ ...styles.td, fontSize: "0.82rem" }}>{p.nome_fantasia}</td>
                          <td style={{ ...styles.td, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>{p.cidade}</td>
                          {CATEGORIAS.map((c) => {
                            const st = p.cob[c.key] || "—";
                            const clr = STATUS_COLORS[st] || STATUS_COLORS["—"];
                            return (
                              <td key={c.key} style={{ ...styles.td, ...styles.tdCat }}>
                                <span style={{ ...styles.statusPill, background: clr.bg, color: clr.color }}>
                                  {st === "PENDENTE" ? "PEN" : st}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ABA DISTRIBUIÇÃO
        ════════════════════════════════════════════════════════════════════ */}
        {aba === "distribuicao" && (
          <>
            {/* ── Cards por categoria ─────────────────────────────────────── */}
            <div style={styles.distCatGrid}>
              {CAT_MAIN.map((c) => {
                const s = catStats[c.key] || { total: 0, pdvsComDist: 0 };
                const ativo = catFiltro === c.key;
                return (
                  <div
                    key={c.key}
                    style={{ ...styles.distCatCard, ...(ativo ? styles.distCatCardAtivo : {}) }}
                    onClick={() => setCatFiltro(ativo ? null : c.key)}
                  >
                    <p style={styles.distCatLabel}>{c.label}</p>
                    <p style={{ ...styles.distCatNum, color: ativo ? "#7DBA3D" : "#fff" }}>
                      {s.total}
                    </p>
                    <p style={styles.distCatPdvs}>{s.pdvsComDist} PDVs cobertos</p>
                    <div style={styles.distCatAA}>
                      <span>AA —</span>
                      <span>Δ —</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Detalhe da categoria selecionada ────────────────────────── */}
            {catFiltro && catStats[catFiltro] && (
              <div style={{ ...styles.section, borderColor: "rgba(125,186,61,0.25)", marginTop: "4px" }}>
                <h3 style={{ ...styles.sectionTitle, color: "#7DBA3D" }}>
                  🔍 {CAT_MAIN.find((c) => c.key === catFiltro)?.label} — SKUs por distribuição
                </h3>
                <div style={styles.top3Grid}>
                  {/* Top 3 mais distribuídos */}
                  <div>
                    <p style={styles.top3Titulo}>🏆 Top 3 mais distribuídos</p>
                    {catStats[catFiltro].top3.length === 0 ? (
                      <p style={styles.semDados}>Sem dados de SKU</p>
                    ) : (
                      catStats[catFiltro].top3.map(([sku, cnt], i) => (
                        <div key={sku} style={styles.skuRow}>
                          <span style={{ ...styles.skuRank, color: "#4ade80" }}>#{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={styles.skuNome}>{sku}</p>
                            <p style={styles.skuQtd}>{cnt} PDVs</p>
                          </div>
                          <span style={{ ...styles.skuBadge, background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>{cnt}</span>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Top 3 menos distribuídos */}
                  <div>
                    <p style={styles.top3Titulo}>⚠️ Top 3 menos distribuídos</p>
                    {catStats[catFiltro].bottom3.length === 0 ? (
                      <p style={styles.semDados}>Sem dados suficientes</p>
                    ) : (
                      catStats[catFiltro].bottom3.map(([sku, cnt], i) => (
                        <div key={sku} style={styles.skuRow}>
                          <span style={{ ...styles.skuRank, color: "#f87171" }}>#{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={styles.skuNome}>{sku}</p>
                            <p style={styles.skuQtd}>{cnt} PDVs</p>
                          </div>
                          <span style={{ ...styles.skuBadge, background: "rgba(248,113,113,0.12)", color: "#f87171" }}>{cnt}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tabela PDVs do dia — SKUs distribuídos por categoria ────── */}
            <div style={{ ...styles.section, border: "1px solid rgba(255,255,255,0.13)" }}>
              <div style={styles.diaRow}>
                <div>
                  <h3 style={{ ...styles.sectionTitle, color: "#fff" }}>📋 PDVs do Dia — SKUs por Categoria</h3>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>
                    {pdvsDia.length} PDVs no roteiro de {diaFiltro}
                  </p>
                </div>
                <div style={styles.diasBtns}>
                  {DIAS.map((d) => (
                    <button key={d.key}
                      style={{ ...styles.diaBtn, ...(diaFiltro === d.key ? styles.diaBtnAtivo : {}) }}
                      onClick={() => setDiaFiltro(d.key)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.filtrosRow}>
                <input
                  style={styles.inputFiltro}
                  placeholder="Buscar PDV..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                <span style={styles.countLabel}>{pdvsDistFiltrados.length} PDVs</span>
              </div>
              {loading ? (
                <p style={styles.msg}>Carregando...</p>
              ) : pdvsDia.length === 0 ? (
                <p style={{ ...styles.msg, color: "rgba(255,255,255,0.55)" }}>
                  Nenhum PDV no roteiro de <strong style={{ color: "#7DBA3D" }}>{diaFiltro}</strong>. Selecione outro dia.
                </p>
              ) : pdvsDistFiltrados.length === 0 ? (
                <p style={{ ...styles.msg, color: "rgba(255,255,255,0.55)" }}>
                  Nenhum PDV encontrado para o filtro atual.
                </p>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, ...styles.thFixed }}>Cód</th>
                        <th style={{ ...styles.th, minWidth: "160px", textAlign: "left" }}>Nome</th>
                        <th style={{ ...styles.th, ...styles.thCat }}>Total</th>
                        {(catFiltro ? CAT_MAIN.filter((c) => c.key === catFiltro) : CAT_MAIN).map((c) => (
                          <th key={c.key} style={{ ...styles.th, ...styles.thCat }}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pdvsDistFiltrados.map((p) => {
                        const colsCat = catFiltro ? CAT_MAIN.filter((c) => c.key === catFiltro) : CAT_MAIN;
                        return (
                          <tr key={p.cod_pdv} style={styles.tr}>
                            <td style={{ ...styles.td, ...styles.thFixed }}>
                              <span style={styles.codBadge}>{p.cod_pdv}</span>
                            </td>
                            <td style={{ ...styles.td, fontSize: "0.82rem", textAlign: "left" }}>{p.nome_fantasia}</td>
                            <td style={{ ...styles.td, ...styles.tdCat }}>
                              <span style={{ fontWeight: "700", color: corNumDist(p.distTotal), fontSize: "0.88rem" }}>
                                {p.distTotal}
                              </span>
                            </td>
                            {colsCat.map((c) => (
                              <td key={c.key} style={{ ...styles.td, ...styles.tdCat }}>
                                <span style={{ fontWeight: "700", color: corNumDist(p.distByCat[c.key]), fontSize: "0.88rem" }}>
                                  {p.distByCat[c.key]}
                                </span>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </>
        )}

      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0c1410", fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "clamp(12px,3vw,20px) clamp(16px,4vw,32px)", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: "12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", minHeight: "44px" },
  title: { margin: 0, fontSize: "clamp(1rem,5vw,1.3rem)", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", minHeight: "44px" },
  content: { padding: "clamp(16px,4vw,24px) clamp(16px,4vw,32px)", maxWidth: "1400px", margin: "0 auto" },
  abas: { display: "flex", gap: "6px", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0" },
  abaBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "10px 20px", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px", fontWeight: "500" },
  abaBtnAtivo: { color: "#7DBA3D", borderBottom: "2px solid #7DBA3D", fontWeight: "700" },
  // Cobertura
  dashRow: { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  dashCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px 20px", minWidth: "120px", flex: 1 },
  dashLabel: { margin: "0 0 6px", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" },
  dashVal: { margin: 0, fontSize: "1.8rem", fontWeight: "700" },
  section: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px", marginBottom: "20px" },
  sectionTitle: { margin: "0 0 16px", fontSize: "0.95rem", fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  catGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" },
  catCard: { background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "12px 10px", textAlign: "center" },
  catLabel: { margin: "0 0 4px", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", fontWeight: "600" },
  catPct: { margin: "0 0 8px", fontSize: "1.3rem", fontWeight: "700" },
  catBar: { height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden", marginBottom: "6px" },
  catBarFill: { height: "100%", borderRadius: "2px", transition: "width 0.3s" },
  catCounts: { display: "flex", justifyContent: "space-around", fontSize: "0.72rem", fontWeight: "600" },
  diaRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" },
  diasBtns: { display: "flex", gap: "6px", flexWrap: "wrap" },
  diaBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "10px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", minHeight: "44px" },
  diaBtnAtivo: { background: "rgba(125,186,61,0.15)", border: "1px solid rgba(125,186,61,0.4)", color: "#7DBA3D", fontWeight: "600" },
  filtrosRow: { display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" },
  inputFiltro: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 12px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" },
  countLabel: { color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginLeft: "auto" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.70rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.03em", padding: "8px 6px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "normal", lineHeight: "1.3", maxWidth: "80px" },
  thFixed: { textAlign: "left", padding: "10px 12px" },
  thCat: { minWidth: "60px" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "10px 8px", color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", textAlign: "center" },
  tdCat: { padding: "8px 4px" },
  codBadge: { background: "rgba(125,186,61,0.12)", color: "#7DBA3D", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "700" },
  statusPill: { display: "inline-block", padding: "3px 6px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: "700", minWidth: "36px" },
  // Distribuição
  catFiltroRow: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" },
  catFiltroBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "8px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", minHeight: "36px", whiteSpace: "nowrap" },
  catFiltroBtnAtivo: { background: "rgba(125,186,61,0.15)", border: "1px solid rgba(125,186,61,0.5)", color: "#7DBA3D", fontWeight: "700" },
  distCatGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px", marginBottom: "20px" },
  distCatCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px 12px", cursor: "pointer", transition: "border-color 0.2s, background 0.2s" },
  distCatCardAtivo: { background: "rgba(125,186,61,0.06)", border: "1px solid rgba(125,186,61,0.45)" },
  distCatLabel: { margin: "0 0 8px", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em" },
  distCatNum: { margin: "0 0 4px", fontSize: "2rem", fontWeight: "800", lineHeight: 1 },
  distCatPdvs: { margin: "0 0 10px", fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" },
  distCatAA: { display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" },
  top3Grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },
  top3Titulo: { margin: "0 0 14px", fontSize: "0.82rem", fontWeight: "700" },
  skuRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" },
  skuRank: { fontSize: "0.82rem", fontWeight: "800", width: "24px", flexShrink: 0 },
  skuNome: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.85)", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  skuQtd: { margin: 0, fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" },
  skuBadge: { padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "800", flexShrink: 0 },
  semDados: { fontSize: "0.78rem", color: "rgba(255,255,255,0.25)", margin: 0 },
};
