// Tabelas no CELULAR viram lista de cartões — automático p/ o app inteiro (Fase 0 mobile).
// Observa o DOM e, em tela ≤ 767px, marca cada tabela "simples" (1 linha de cabeçalho, sem
// colunas agrupadas) com a classe rt-card e cada célula com data-label = título da coluna.
// O CSS (mobile.css) faz o resto: cabeçalho some, cada linha vira um cartão; a coluna de
// nome (Cliente/PDV/Produto/…) vira o título do cartão; as demais aparecem rótulo + valor.
// Matrizes (cabeçalho em 2 linhas / colspan) ficam como estão (rolagem lateral).
// Para manter uma tabela como tabela no celular: <table data-rt="off">.
import { QUERY_MOBILE } from "./mobile";

const TITULO_RE = /^(cliente|pdv|nome( pdv| fantasia)?|produto|missão|missao|task|indicador|setor · rn|rn|categoria|kpi|item)$/i;
const limpa = (t) => String(t || "").replace(/[⇅▲▼↕]/g, "").replace(/\s+/g, " ").trim();

function processar(table) {
  if (table.dataset.rt === "off" || table.dataset.rtFeito === "1") return;
  const thead = table.tHead;
  if (!thead || thead.rows.length !== 1) { table.dataset.rtFeito = "1"; return; }
  const ths = [...thead.rows[0].cells];
  if (ths.length < 3 || ths.some((th) => th.colSpan > 1 || th.rowSpan > 1)) { table.dataset.rtFeito = "1"; return; }
  const rotulos = ths.map((th) => limpa(th.textContent));
  let iTit = rotulos.findIndex((r) => TITULO_RE.test(r));
  if (iTit < 0) iTit = rotulos.findIndex((r) => /cliente|pdv|produto|nome|missão/i.test(r));
  if (iTit < 0) iTit = 0;
  table.classList.add("rt-card");
  table.dataset.rtFeito = "1";
  marcarLinhas(table, rotulos, iTit);
  table.dataset.rtTit = String(iTit);
}

function marcarLinhas(table, rotulos, iTit) {
  for (const tb of table.tBodies) {
    for (const tr of tb.rows) {
      if (tr.dataset.rtOk === "1") continue;
      const cells = [...tr.cells];
      if (cells.length !== rotulos.length) { tr.classList.add("rt-solta"); tr.dataset.rtOk = "1"; continue; }
      cells.forEach((td, i) => {
        td.dataset.label = rotulos[i];
        if (i === iTit) td.classList.add("rt-tit");
        if (!limpa(td.textContent) || limpa(td.textContent) === "—") td.classList.add("rt-vazia");
      });
      tr.dataset.rtOk = "1";
    }
  }
}

let agendado = false;
function varrer() {
  agendado = false;
  if (!window.matchMedia(QUERY_MOBILE).matches) return;
  document.querySelectorAll("table").forEach((t) => {
    if (t.dataset.rtFeito === "1") {
      // linhas novas (lista filtrada/paginada) numa tabela já marcada
      if (t.classList.contains("rt-card")) {
        const rot = [...t.tHead.rows[0].cells].map((th) => limpa(th.textContent));
        marcarLinhas(t, rot, Number(t.dataset.rtTit || 0));
      }
      return;
    }
    processar(t);
  });
}

export function ativarTabelasMobile() {
  if (typeof window === "undefined" || !window.MutationObserver) return;
  const agendar = () => { if (!agendado) { agendado = true; requestAnimationFrame(varrer); } };
  new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.matchMedia(QUERY_MOBILE).addEventListener?.("change", () => {
    // girou para paisagem/desktop: desfaz; voltou p/ celular: refaz
    document.querySelectorAll("table[data-rt-feito]").forEach((t) => { delete t.dataset.rtFeito; t.classList.remove("rt-card"); t.querySelectorAll("tr[data-rt-ok]").forEach((tr) => delete tr.dataset.rtOk); });
    agendar();
  });
  agendar();
}
