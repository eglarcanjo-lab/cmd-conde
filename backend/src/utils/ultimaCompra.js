// Última compra do PDV pelos PEDIDOS (CORA), não só pela base de clientes.
// A "Data da Última Compra" da base (0105070402) só muda quando a base é reimportada e o
// dias_sem_compra é calculado no dia do import — PDV que comprou depois continuava em
// "Sem Compra". Aqui: última compra = maior data entre a base e vendas_cliente_produto
// (venda/bonificação válida do CORA, inclusive D+1 ainda não entregue — mesma regra da RV),
// e os dias são recalculados para HOJE (Brasília).
const { readSheetMonths } = require("../services/sheets");

const p2 = (n) => String(n).padStart(2, "0");
const normCod = (v) => String(v ?? "").trim().replace(/\.0$/, "").replace(/^0+/, "");
const num = (v) => parseFloat(String(v ?? "0").replace(",", ".")) || 0;
// dd/mm/aaaa (ou aaaa-mm-dd) → Date (meia-noite) | null
const paraData = (s) => {
  const t = String(s || "").trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const fmt = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;

function hojeBR() {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return new Date(br.getFullYear(), br.getMonth(), br.getDate());
}

// Mês atual + 3 anteriores (o que é mais antigo a base de clientes já cobre)
function mesesRecentes(hoje) {
  const out = [];
  for (let k = 0; k < 4; k++) { const d = new Date(hoje.getFullYear(), hoje.getMonth() - k, 1); out.push(`${d.getFullYear()}-${p2(d.getMonth() + 1)}`); }
  return out;
}

let _cache = null; // { ts, mapa } — a página de PDVs chama 3 rotas de uma vez
const TTL = 60 * 1000;

// cod_pdv (normalizado) → Date da última compra nos pedidos
async function mapaUltimaCompraPedidos() {
  if (_cache && Date.now() - _cache.ts < TTL) return _cache.mapa;
  const vendas = await readSheetMonths("vendas_cliente_produto", "mes_referencia", mesesRecentes(hojeBR())).catch(() => []);
  const mapa = {};
  vendas.forEach((v) => {
    if (num(v.volume_hl) < 0) return;
    const cod = normCod(v.cod_pdv), d = paraData(v.ultima_compra);
    if (cod && d && (!mapa[cod] || d > mapa[cod])) mapa[cod] = d;
  });
  _cache = { ts: Date.now(), mapa };
  return mapa;
}

// Devolve as linhas com ultima_compra / dias_sem_compra atualizados pelos pedidos.
async function aplicarUltimaCompra(linhas) {
  const mapa = await mapaUltimaCompraPedidos();
  const hoje = hojeBR();
  return linhas.map((p) => {
    const base = paraData(p.ultima_compra), ped = mapa[normCod(p.cod_pdv)];
    const ult = ped && (!base || ped > base) ? ped : base;
    if (!ult) return p;
    const dias = Math.max(0, Math.round((hoje - ult) / 86400000));
    return { ...p, ultima_compra: fmt(ult), dias_sem_compra: String(dias) };
  });
}

// Comprou no mês corrente (pela última compra já atualizada)?
function comprouNoMes(p) {
  const d = paraData(p.ultima_compra), h = hojeBR();
  return !!d && d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth();
}

module.exports = { aplicarUltimaCompra, comprouNoMes };
