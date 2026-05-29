import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const DIAS = [
  { key: "SEG", label: "Segunda" },
  { key: "TER", label: "Terça" },
  { key: "QUA", label: "Quarta" },
  { key: "QUI", label: "Quinta" },
  { key: "SEX", label: "Sexta" },
  { key: "SAB", label: "Sábado" },
];

const ABAS = [
  { key: "dia",        label: "📅 Visitas do Dia" },
  { key: "sem_compra", label: "🕐 Sem Compra" },
  { key: "inadimplentes", label: "⚠️ Inadimplentes" },
  { key: "rank",       label: "🏆 Rank de Clientes" },
];

function getDiaHoje() {
  const dias = ["DOM","SEG","TER","QUA","QUI","SEX","SAB"];
  return dias[new Date().getDay()];
}

// Converte valor que pode vir como "35,5" (locale BR) ou "35.5" ou número
const parseHl = (v) => {
  if (typeof v === "number" && !isNaN(v)) return v;
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

export default function PDVs() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [diaFiltro, setDiaFiltro] = useState(getDiaHoje());
  const [aba, setAba] = useState("dia");
  const [busca, setBusca] = useState("");
  const [pdvBase, setPdvBase] = useState([]);
  const [cobertura, setCobertura] = useState([]);
  const [mix, setMix] = useState([]);
  const [inadimplentes, setInadimplentes] = useState([]);
  const [rank, setRank] = useState([]);
  const [semCompra, setSemCompra] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pdvSelecionado, setPdvSelecionado] = useState(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [resBase, resCob, resMix, resInad, resRank, resSC] = await Promise.all([
        api.get("/api/cobertura/pdv-base"),
        api.get("/api/cobertura"),
        api.get("/api/pdvs/mix"),
        api.get("/api/pdvs/inadimplentes"),
        api.get("/api/pdvs/rank"),
        api.get("/api/pdvs/sem-compra"),
      ]);
      setPdvBase(resBase.data || []);
      setCobertura(resCob.data || []);
      setMix(resMix.data || []);
      setInadimplentes(resInad.data || []);
      setRank(resRank.data || []);
      setSemCompra(resSC.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Mapa de cobertura por PDV
  const mapaCob = {};
  cobertura.forEach((r) => {
    if (!mapaCob[r.cod_pdv]) mapaCob[r.cod_pdv] = {};
    mapaCob[r.cod_pdv][r.categoria] = r.status;
  });

  function coberturaOk(cod) {
    const cob = mapaCob[cod] || {};
    const vals = Object.values(cob);
    const ok = vals.filter((v) => v === "OK").length;
    return { ok, total: vals.length };
  }

  // Mapa base (cod_pdv → PDV completo)
  const mapaBase = {};
  pdvBase.forEach((p) => { mapaBase[p.cod_pdv] = p; });

  // Mapa de inadimplência
  const mapaInad = {};
  inadimplentes.forEach((i) => { mapaInad[i.cod_pdv] = i; });

  // PDVs do dia selecionado
  const pdvsDia = pdvBase.filter((p) => {
    const dia = String(p.dia_visita || "").trim().toUpperCase().split("/")[0].trim();
    return dia === diaFiltro;
  });

  // Filtro busca
  function filtrar(lista) {
    if (!busca) return lista;
    return lista.filter((p) =>
      p.nome_fantasia?.toLowerCase().includes(busca.toLowerCase()) ||
      p.cod_pdv?.includes(busca)
    );
  }

  // Dashboard contadores
  const totalDia = pdvsDia.length;
  const inadDia = pdvsDia.filter((p) => mapaInad[p.cod_pdv]).length;
  const semCompraDia = pdvsDia.filter((p) => Number(p.dias_sem_compra) > 30).length;

  // Top compradores do dia (por volume últimos 4m)
  const rankDia = rank
    .filter((r) => pdvsDia.some((p) => p.cod_pdv === r.cod_pdv))
    .sort((a, b) => parseHl(b.volume_4m_hl) - parseHl(a.volume_4m_hl))
    .slice(0, 5);

  // Mix do PDV selecionado
  const mixPdv = pdvSelecionado
    ? mix.filter((m) => m.cod_pdv === pdvSelecionado.cod_pdv).slice(0, 10)
    : [];

  const cobPdv = pdvSelecionado ? mapaCob[pdvSelecionado.cod_pdv] || {} : {};

  return (
    <div style={styles.root}>
      <style>{`
        @media (max-width: 600px) {
          .pdv-content  { padding: 12px 14px !important; }

          /* Header */
          .pdv-header   { padding: 10px 14px !important; gap: 8px !important; }
          .pdv-title    { font-size: 1rem !important; }
          .pdv-subtitle { font-size: 0.67rem !important; max-width: 190px;
                          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .pdv-back-btn   { padding: 5px 10px !important; font-size: 0.76rem !important; }
          .pdv-logout-btn { padding: 4px 9px  !important; font-size: 0.74rem !important; }

          /* Dias — scroll horizontal, sem quebra de linha */
          .pdv-dias { flex-wrap: nowrap !important; overflow-x: auto !important;
                      padding-bottom: 4px; scrollbar-width: none;
                      -webkit-overflow-scrolling: touch; }
          .pdv-dias::-webkit-scrollbar { display: none; }
          .pdv-dia-btn { flex-shrink: 0 !important; font-size: 0.74rem !important;
                         padding: 5px 11px !important; }

          /* Dashboard — 2 colunas, top-compradores largura total */
          .pdv-dash { display: grid !important; grid-template-columns: 1fr 1fr !important;
                      gap: 8px !important; }
          .pdv-dash > *:last-child { grid-column: 1 / -1; }
          .pdv-dash-val   { font-size: 1.35rem !important; }
          .pdv-dash-label { font-size: 0.69rem !important; }
          .pdv-rank-mini-item { font-size: 0.74rem !important; }

          /* Abas — scroll horizontal, sem quebra */
          .pdv-abas { overflow-x: auto !important; scrollbar-width: none;
                      -webkit-overflow-scrolling: touch; }
          .pdv-abas::-webkit-scrollbar { display: none; }
          .pdv-aba-btn { white-space: nowrap !important; flex-shrink: 0 !important;
                         font-size: 0.76rem !important; padding: 8px 9px !important; }

          /* Campo de busca — largura total */
          .pdv-search { width: 100% !important; box-sizing: border-box !important; }

          /* Tabelas */
          .pdv-table th { font-size: 0.59rem !important; padding: 7px 5px !important;
                          letter-spacing: 0 !important; }
          .pdv-table td { font-size: 0.72rem !important; padding: 8px 5px !important; }
          .pdv-badge    { font-size: 0.62rem !important; padding: 2px 5px !important; }
          .pdv-tag      { font-size: 0.62rem !important; padding: 2px 5px !important; }

          /* Esconde coluna Cidade em todas as tabelas no mobile */
          .pdv-col-hide { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div style={styles.header} className="pdv-header">
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} className="pdv-back-btn" onClick={() => navigate("/")}>← Voltar</button>
          <div>
            <h1 style={styles.title} className="pdv-title">🗺️ PDVs</h1>
            <p style={styles.subtitle} className="pdv-subtitle">Setor {usuario?.cod} · {usuario?.nome}</p>
          </div>
        </div>
        <button style={styles.logoutBtn} className="pdv-logout-btn" onClick={logout}>Sair</button>
      </div>

      <div style={styles.content} className="pdv-content">
        {/* Seletor de dia */}
        <div style={styles.diasRow} className="pdv-dias">
          {DIAS.map((d) => (
            <button
              key={d.key}
              className="pdv-dia-btn"
              style={{ ...styles.diaBtn, ...(diaFiltro === d.key ? styles.diaBtnAtivo : {}) }}
              onClick={() => setDiaFiltro(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Dashboard */}
        <div style={styles.dashRow} className="pdv-dash">
          <div style={styles.dashCard}>
            <p style={styles.dashLabel} className="pdv-dash-label">📅 Visitas hoje</p>
            <p style={styles.dashVal} className="pdv-dash-val">{totalDia}</p>
          </div>
          <div style={{ ...styles.dashCard, borderColor: "rgba(239,68,68,0.3)" }}>
            <p style={styles.dashLabel} className="pdv-dash-label">⚠️ Inadimplentes</p>
            <p style={{ ...styles.dashVal, color: "#f87171" }} className="pdv-dash-val">{inadDia}</p>
          </div>
          <div style={{ ...styles.dashCard, borderColor: "rgba(251,185,0,0.3)" }}>
            <p style={styles.dashLabel} className="pdv-dash-label">🕐 +30 dias s/ compra</p>
            <p style={{ ...styles.dashVal, color: "#fbb900" }} className="pdv-dash-val">{semCompraDia}</p>
          </div>
          <div style={{ ...styles.dashCard, flex: 2, borderColor: "rgba(251,185,0,0.15)" }}>
            <p style={styles.dashLabel} className="pdv-dash-label">🏆 Top compradores do dia</p>
            <div style={styles.rankMini}>
              {rankDia.length === 0
                ? <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}>—</span>
                : rankDia.map((r, i) => (
                  <span key={r.cod_pdv} style={styles.rankMiniItem} className="pdv-rank-mini-item">
                    <span style={styles.rankPos}>{i + 1}°</span>
                    {mapaBase[r.cod_pdv]?.nome_fantasia || r.nome_fantasia || r.cod_pdv}
                    <span style={styles.rankVol}>{parseHl(r.volume_4m_hl).toFixed(0)} HL</span>
                  </span>
                ))
              }
            </div>
          </div>
        </div>

        {/* Abas */}
        <div style={styles.abas} className="pdv-abas">
          {ABAS.map((a) => (
            <button
              key={a.key}
              className="pdv-aba-btn"
              style={{ ...styles.abaBtn, ...(aba === a.key ? styles.abaBtnAtivo : {}) }}
              onClick={() => { setAba(a.key); setBusca(""); }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div style={styles.filtroRow}>
          <input
            className="pdv-search"
            style={styles.inputFiltro}
            placeholder="Buscar por nome ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Conteúdo da aba */}
        {loading ? (
          <p style={styles.msg}>Carregando...</p>
        ) : (
          <>
            {aba === "dia" && (
              <TabelaPDVs
                pdvs={filtrar(pdvsDia)}
                mapaInad={mapaInad}
                coberturaOk={coberturaOk}
                onSelect={setPdvSelecionado}
              />
            )}
            {aba === "sem_compra" && (
              <TabelaSemCompra pdvs={filtrar(semCompra)} mapaInad={mapaInad} onSelect={(p) => { setPdvSelecionado(pdvBase.find(b => b.cod_pdv === p.cod_pdv) || p); }} />
            )}
            {aba === "inadimplentes" && (
              <TabelaInadimplentes pdvs={filtrar(inadimplentes)} />
            )}
            {aba === "rank" && (
              <TabelaRank
                pdvs={filtrar(rank)}
                mapaInad={mapaInad}
                mapaBase={mapaBase}
                onSelect={(p) => setPdvSelecionado(mapaBase[p.cod_pdv] || p)}
              />
            )}
          </>
        )}
      </div>

      {/* Modal detalhe PDV */}
      {pdvSelecionado && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && setPdvSelecionado(null)}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{pdvSelecionado.nome_fantasia}</h2>
                <span style={styles.codBadge}>{pdvSelecionado.cod_pdv}</span>
                {mapaInad[pdvSelecionado.cod_pdv] && (
                  <span style={styles.inadBadge}>⚠️ Inadimplente</span>
                )}
              </div>
              <button style={styles.closeBtn} onClick={() => setPdvSelecionado(null)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              {/* Info básica */}
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Cidade</span>
                  <span style={styles.infoVal}>{pdvSelecionado.cidade || "—"}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Dias sem compra</span>
                  <span style={{ ...styles.infoVal, color: Number(pdvSelecionado.dias_sem_compra) > 30 ? "#f87171" : "#4ade80" }}>
                    {pdvSelecionado.dias_sem_compra || "—"} dias
                  </span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Última compra</span>
                  <span style={styles.infoVal}>{pdvSelecionado.ultima_compra || "—"}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Próxima visita</span>
                  <span style={styles.infoVal}>{pdvSelecionado.data_prox_visita || "—"}</span>
                </div>
              </div>

              {/* Inadimplência */}
              {mapaInad[pdvSelecionado.cod_pdv] && (
                <div style={styles.inadBox}>
                  <p style={styles.inadTitle}>⚠️ Títulos em Aberto</p>
                  <div style={styles.inadGrid}>
                    <div>
                      <span style={styles.infoLabel}>Qtd. títulos</span>
                      <p style={{ ...styles.infoVal, color: "#f87171" }}>{mapaInad[pdvSelecionado.cod_pdv].qtd_titulos}</p>
                    </div>
                    <div>
                      <span style={styles.infoLabel}>Valor total</span>
                      <p style={{ ...styles.infoVal, color: "#f87171" }}>
                        R$ {Number(mapaInad[pdvSelecionado.cod_pdv].valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span style={styles.infoLabel}>Maior atraso</span>
                      <p style={{ ...styles.infoVal, color: "#f87171" }}>{mapaInad[pdvSelecionado.cod_pdv].maior_atraso} dias</p>
                    </div>
                    <div>
                      <span style={styles.infoLabel}>Aging</span>
                      <p style={styles.infoVal}>{mapaInad[pdvSelecionado.cod_pdv].aging}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cobertura */}
              <div>
                <p style={styles.secLabel}>Cobertura por Categoria</p>
                <div style={styles.cobGrid}>
                  {Object.entries(cobPdv).map(([cat, st]) => (
                    <span key={cat} style={{
                      ...styles.cobPill,
                      background: st === "OK" ? "rgba(34,197,94,0.15)" : st === "PENDENTE" ? "rgba(251,185,0,0.15)" : "rgba(239,68,68,0.15)",
                      color: st === "OK" ? "#4ade80" : st === "PENDENTE" ? "#fbb900" : "#f87171",
                    }}>
                      {cat.replace("TRIMARCA RGB HE ", "").replace("CERVEJA ", "C.")} · {st}
                    </span>
                  ))}
                </div>
              </div>

              {/* Mix de produtos */}
              <div>
                <p style={styles.secLabel}>Top Produtos (últimos 4 meses)</p>
                {mixPdv.length === 0 ? (
                  <p style={styles.msg}>Sem histórico de compras.</p>
                ) : (
                  <div style={styles.mixList}>
                    {mixPdv.map((m, i) => (
                      <div key={i} style={styles.mixItem}>
                        <span style={styles.mixPos}>{i + 1}</span>
                        <div style={styles.mixInfo}>
                          <span style={styles.mixNome}>{m.nome_prod}</span>
                          <span style={styles.mixCat}>{m.categoria || "—"}</span>
                        </div>
                        <span style={styles.mixVol}>{parseHl(m.volume_total_hl).toFixed(2)} HL</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabelaPDVs({ pdvs, mapaInad, coberturaOk, onSelect }) {
  if (pdvs.length === 0) return <p style={styles.msg}>Nenhum PDV encontrado.</p>;
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table} className="pdv-table">
        <thead>
          <tr>
            <th style={styles.th}>Cód</th>
            <th style={styles.th}>Nome</th>
            <th style={styles.th} className="pdv-col-hide">Cidade</th>
            <th style={styles.th}>Dias s/ Compra</th>
            <th style={styles.th}>Inad.</th>
          </tr>
        </thead>
        <tbody>
          {pdvs.map((p) => {
            const inad = mapaInad[p.cod_pdv];
            return (
              <tr key={p.cod_pdv} style={{ ...styles.tr, cursor: "pointer" }} onClick={() => onSelect(p)}>
                <td style={styles.td}><span className="pdv-badge" style={styles.codBadge}>{p.cod_pdv}</span></td>
                <td style={{ ...styles.td, textAlign: "left" }}>{p.nome_fantasia}</td>
                <td style={{ ...styles.td, color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }} className="pdv-col-hide">{p.cidade}</td>
                <td style={{ ...styles.td, color: Number(p.dias_sem_compra) > 30 ? "#f87171" : "#4ade80" }}>
                  {p.dias_sem_compra || "—"} dias
                </td>
                <td style={styles.td}>
                  {inad ? <span className="pdv-tag" style={styles.inadTag}>⚠️ Sim</span> : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TabelaSemCompra({ pdvs, mapaInad, onSelect }) {
  if (pdvs.length === 0) return <p style={styles.msg}>Nenhum PDV encontrado.</p>;
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table} className="pdv-table">
        <thead>
          <tr>
            <th style={styles.th}>#</th>
            <th style={styles.th}>Cód</th>
            <th style={styles.th}>Nome</th>
            <th style={styles.th} className="pdv-col-hide">Cidade</th>
            <th style={styles.th}>Dias</th>
            <th style={styles.th} className="pdv-col-hide">Última Compra</th>
            <th style={styles.th}>Inad.</th>
          </tr>
        </thead>
        <tbody>
          {pdvs.map((p, i) => (
            <tr key={p.cod_pdv} style={{ ...styles.tr, cursor: "pointer" }} onClick={() => onSelect(p)}>
              <td style={{ ...styles.td, color: "rgba(255,255,255,0.3)" }}>{i + 1}</td>
              <td style={styles.td}><span className="pdv-badge" style={styles.codBadge}>{p.cod_pdv}</span></td>
              <td style={{ ...styles.td, textAlign: "left" }}>{p.nome_fantasia}</td>
              <td style={{ ...styles.td, color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }} className="pdv-col-hide">{p.cidade}</td>
              <td style={{ ...styles.td, color: "#f87171", fontWeight: "700" }}>{p.dias_sem_compra} dias</td>
              <td style={{ ...styles.td, color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }} className="pdv-col-hide">{p.ultima_compra}</td>
              <td style={styles.td}>{mapaInad[p.cod_pdv] ? <span className="pdv-tag" style={styles.inadTag}>⚠️ Sim</span> : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaInadimplentes({ pdvs }) {
  // Ordena por valor_total decrescente; empata pela qtd_titulos
  const lista = [...pdvs].sort((a, b) => {
    const vA = Number(a.valor_total) || 0;
    const vB = Number(b.valor_total) || 0;
    if (vB !== vA) return vB - vA;
    return (Number(b.qtd_titulos) || 0) - (Number(a.qtd_titulos) || 0);
  });

  if (lista.length === 0) return <p style={styles.msg}>Nenhum inadimplente encontrado.</p>;
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table} className="pdv-table">
        <thead>
          <tr>
            <th style={styles.th}>Cód</th>
            <th style={styles.th}>Nome</th>
            <th style={styles.th}>Títulos</th>
            <th style={styles.th}>Valor Total</th>
            <th style={styles.th}>Atraso</th>
            <th style={styles.th} className="pdv-col-hide">Aging</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => {
            const valor = Number(p.valor_total) || 0;
            const atraso = Number(p.maior_atraso) || 0;
            return (
              <tr key={p.cod_pdv} style={styles.tr}>
                <td style={styles.td}><span className="pdv-badge" style={styles.codBadge}>{p.cod_pdv}</span></td>
                <td style={{ ...styles.td, textAlign: "left" }}>{p.nome_fantasia}</td>
                <td style={styles.td}>{p.qtd_titulos || "—"}</td>
                <td style={{ ...styles.td, color: valor > 0 ? "#f87171" : "rgba(255,255,255,0.3)", fontWeight: valor > 0 ? "600" : "400" }}>
                  {valor > 0 ? `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                </td>
                <td style={{ ...styles.td, color: atraso > 0 ? "#f87171" : "rgba(255,255,255,0.3)" }}>
                  {atraso > 0 ? `${atraso} dias` : "—"}
                </td>
                <td style={{ ...styles.td, color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }} className="pdv-col-hide">{p.aging || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TabelaRank({ pdvs, mapaInad, mapaBase, onSelect }) {
  if (pdvs.length === 0) return <p style={styles.msg}>Nenhum dado encontrado.</p>;
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table} className="pdv-table">
        <thead>
          <tr>
            <th style={styles.th}>#</th>
            <th style={styles.th}>Cód</th>
            <th style={styles.th}>Nome</th>
            <th style={styles.th}>Volume 4m</th>
            <th style={styles.th}>Inad.</th>
          </tr>
        </thead>
        <tbody>
          {pdvs.map((p, i) => {
            const nome = mapaBase[p.cod_pdv]?.nome_fantasia || p.nome_fantasia || "—";
            const inad = mapaInad[p.cod_pdv];
            return (
              <tr
                key={p.cod_pdv}
                style={{ ...styles.tr, cursor: "pointer" }}
                onClick={() => onSelect(p)}
              >
                <td style={{ ...styles.td, color: i < 3 ? "#fbb900" : "rgba(255,255,255,0.3)", fontWeight: "700" }}>{i + 1}°</td>
                <td style={styles.td}><span className="pdv-badge" style={styles.codBadge}>{p.cod_pdv}</span></td>
                <td style={{ ...styles.td, textAlign: "left" }}>{nome}</td>
                <td style={{ ...styles.td, color: "#4ade80", fontWeight: "600" }}>
                  {parseHl(p.volume_4m_hl).toFixed(2)} HL
                </td>
                <td style={styles.td}>{inad ? <span className="pdv-tag" style={styles.inadTag}>⚠️ Sim</span> : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0a0f1e", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" },
  headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
  backBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  title: { margin: 0, fontSize: "1.3rem", fontWeight: "700" },
  subtitle: { margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  content: { padding: "24px 32px", maxWidth: "1200px", margin: "0 auto" },
  diasRow: { display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" },
  diaBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "6px 16px", borderRadius: "20px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit" },
  diaBtnAtivo: { background: "rgba(251,185,0,0.15)", border: "1px solid rgba(251,185,0,0.4)", color: "#fbb900", fontWeight: "600" },
  dashRow: { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  dashCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px 18px", flex: 1, minWidth: "120px" },
  dashLabel: { margin: "0 0 6px", fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" },
  dashVal: { margin: 0, fontSize: "1.6rem", fontWeight: "700" },
  rankMini: { display: "flex", flexDirection: "column", gap: "4px" },
  rankMiniItem: { display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "rgba(255,255,255,0.7)" },
  rankPos: { color: "#fbb900", fontWeight: "700", minWidth: "20px" },
  rankVol: { marginLeft: "auto", color: "#4ade80", fontWeight: "600" },
  abas: { display: "flex", gap: "4px", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0" },
  abaBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", padding: "10px 16px", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", borderBottom: "2px solid transparent", marginBottom: "-1px" },
  abaBtnAtivo: { color: "#fbb900", borderBottom: "2px solid #fbb900" },
  filtroRow: { marginBottom: "14px" },
  inputFiltro: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", padding: "8px 14px", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", width: "280px" },
  msg: { color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "40px" },
  tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 12px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "10px 12px", color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", textAlign: "center" },
  codBadge: { background: "rgba(251,185,0,0.12)", color: "#fbb900", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "700" },
  inadTag: { background: "rgba(239,68,68,0.15)", color: "#f87171", padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "600" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modal: { background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", width: "100%", maxWidth: "620px", maxHeight: "90vh", overflow: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  modalTitle: { margin: "0 0 8px", fontSize: "1.1rem", fontWeight: "700" },
  closeBtn: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.2rem", cursor: "pointer" },
  modalBody: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: "20px" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" },
  infoItem: { display: "flex", flexDirection: "column", gap: "4px" },
  infoLabel: { color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" },
  infoVal: { color: "#fff", fontSize: "0.9rem", fontWeight: "500" },
  inadBox: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "14px" },
  inadTitle: { margin: "0 0 12px", color: "#f87171", fontWeight: "600", fontSize: "0.9rem" },
  inadGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" },
  inadBadge: { background: "rgba(239,68,68,0.15)", color: "#f87171", padding: "2px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600", marginLeft: "8px" },
  secLabel: { margin: "0 0 10px", color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em" },
  cobGrid: { display: "flex", flexWrap: "wrap", gap: "6px" },
  cobPill: { padding: "4px 10px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "600" },
  mixList: { display: "flex", flexDirection: "column", gap: "6px" },
  mixItem: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: "8px" },
  mixPos: { color: "rgba(255,255,255,0.3)", fontWeight: "700", minWidth: "20px", fontSize: "0.82rem" },
  mixInfo: { flex: 1, display: "flex", flexDirection: "column", gap: "2px" },
  mixNome: { color: "#fff", fontSize: "0.85rem" },
  mixCat: { color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" },
  mixVol: { color: "#4ade80", fontWeight: "600", fontSize: "0.85rem" },
};
