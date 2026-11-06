// Painel TV — slides em tela cheia para a Smart TV da empresa.
// Abre por /tv e pede o CÓDIGO de 6 números (Admin › Painel TV), sem login; /tv?k=CÓDIGO também
// funciona. O código fica guardado na TV — depois da 1ª vez abre direto.
// Ordem: Abertura (logo) → 10 Princípios → Princípio em foco → Volumes → Avisos → RH → Vagas.
// Conteúdo recarrega a cada 3 min SEM recarregar a página (recarregar tiraria a tela cheia).
// Sem internet: continua passando o último conteúdo que recebeu.
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";

const BASE = api.defaults.baseURL;
const ATUALIZA_MS = 3 * 60 * 1000;
const LS_CHAVE = "tv_chave";
const LS_DADOS = "tv_ultimo_painel";
const VERDE = "#7DBA3D";
const FUNDO = "#0c1410";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const pad = (n) => String(n).padStart(2, "0");
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const saudacao = (h) => (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
const corPct = (p) => (p == null ? "rgba(255,255,255,0.5)" : p >= 100 ? VERDE : p >= 90 ? "#E8C547" : "#E5534B");
const linhas = (t) => String(t || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

function chaveDaUrl() {
  const k = new URLSearchParams(window.location.search).get("k");
  if (k) { try { localStorage.setItem(LS_CHAVE, k); } catch { /* */ } return k; }
  try { return localStorage.getItem(LS_CHAVE) || ""; } catch { return ""; }
}

function entrarTelaCheia() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (fn) { try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch { /* */ } }
}
const emTelaCheia = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

// Monta a fila de slides a partir do que veio do backend.
function montarSlides(d) {
  if (!d) return [];
  const t = d.tempos || {}, on = d.ligados || {};
  const dur = (item, tipo) => (item?.duracao || t[tipo] || 15) * 1000;
  const s = [];
  if (on.abertura) s.push({ k: "abertura", tipo: "abertura", ms: dur(null, "abertura") });
  if (on.principios && d.principios?.length) s.push({ k: "principios", tipo: "principios", ms: dur(null, "principios") });
  if (on.destaque) (d.destaques || []).forEach((it) => s.push({ k: "d" + it.id, tipo: "destaque", item: it, ms: dur(it, "destaque") }));
  if (on.volumes && d.volumes?.categorias?.length) s.push({ k: "volumes", tipo: "volumes", ms: dur(null, "volumes") });
  if (on.aviso) (d.avisos || []).forEach((it) => s.push({ k: "a" + it.id, tipo: "aviso", item: it, ms: dur(it, "aviso") }));
  if (on.rh) (d.rh || []).forEach((it) => s.push({ k: "r" + it.id, tipo: "rh", item: it, ms: dur(it, "rh") }));
  if (on.vagas && d.vagas?.length) s.push({ k: "vagas", tipo: "vagas", ms: dur(null, "vagas") });
  if (!s.length) s.push({ k: "abertura", tipo: "abertura", ms: 15000 });
  return s;
}

export default function PainelTV() {
  const [chave, setChave] = useState(chaveDaUrl);
  const [pedirCodigo, setPedirCodigo] = useState(() => !chaveDaUrl());
  const [msgCodigo, setMsgCodigo] = useState("");
  const [tentativa, setTentativa] = useState(0); // remonta a tela do código (limpa o campo) a cada erro
  const [dados, setDados] = useState(() => { try { return JSON.parse(localStorage.getItem(LS_DADOS) || "null"); } catch { return null; } });
  const [erro, setErro] = useState("");
  const [idx, setIdx] = useState(0);
  const [agora, setAgora] = useState(new Date());
  const [mostrarBotao, setMostrarBotao] = useState(!emTelaCheia());
  const botaoRef = useRef(null);

  // Busca o conteúdo (e repete). Erro mantém o último conteúdo na tela.
  useEffect(() => {
    if (!chave) { setPedirCodigo(true); return; }
    let vivo = true;
    const buscar = () => fetch(`${BASE}/api/tv/painel?k=${encodeURIComponent(chave)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.status === 403 || r.status === 429) {
          // código errado/trocado no admin → volta pra tela do código (esquece o conteúdo antigo)
          const e = new Error(j.error || "Código inválido"); e.codigo = true; throw e;
        }
        if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
        return j;
      })
      .then((j) => {
        if (!vivo) return;
        setDados(j); setErro(""); setPedirCodigo(false);
        try { localStorage.setItem(LS_DADOS, JSON.stringify(j)); } catch { /* */ }
      })
      .catch((e) => {
        if (!vivo) return;
        if (e.codigo) {
          try { localStorage.removeItem(LS_CHAVE); localStorage.removeItem(LS_DADOS); } catch { /* */ }
          setDados(null); setMsgCodigo(e.message); setPedirCodigo(true); setChave(""); setTentativa((t) => t + 1);
          return;
        }
        setErro(e.message || "Sem conexão");
      });
    buscar();
    const iv = setInterval(buscar, ATUALIZA_MS);
    return () => { vivo = false; clearInterval(iv); };
  }, [chave]);

  // Relógio
  useEffect(() => { const iv = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(iv); }, []);

  // Tela cheia: navegador só deixa com um clique/OK do controle. Botão já vem focado (OK do
  // controle remoto = Enter). Some sozinho em 30s (segue passando, só sem tela cheia).
  useEffect(() => {
    const onFs = () => setMostrarBotao(!emTelaCheia());
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    const onKey = (e) => { if ((e.key === "Enter" || e.keyCode === 13) && !emTelaCheia()) entrarTelaCheia(); };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => setMostrarBotao(false), 30000);
    botaoRef.current?.focus();
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, []);

  // Não deixar a TV entrar em descanso de tela (onde o navegador suporta)
  useEffect(() => {
    let lock = null;
    const pedir = () => { try { navigator.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {}); } catch { /* */ } };
    pedir();
    const onVis = () => { if (document.visibilityState === "visible") pedir(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); try { lock?.release(); } catch { /* */ } };
  }, []);

  const slides = useMemo(() => montarSlides(dados), [dados]);
  const atual = slides[idx % slides.length] || slides[0];

  // Passa o slide
  useEffect(() => {
    if (!atual) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % Math.max(1, slides.length)), atual.ms);
    return () => clearTimeout(t);
  }, [idx, atual, slides.length]);

  if (pedirCodigo) {
    return <TelaCodigo key={tentativa} msg={msgCodigo} conferindo={!!chave} onCodigo={(c) => {
      try { localStorage.setItem(LS_CHAVE, c); } catch { /* */ }
      setMsgCodigo(""); setChave(c);
    }} />;
  }

  if (!dados) {
    return (
      <div style={S.tela}>
        <CssGlobal />
        <div style={{ margin: "auto", textAlign: "center" }}>
          <div style={{ fontSize: "4vw", fontWeight: 800, color: VERDE }}>Painel TV</div>
          <div style={{ fontSize: "1.6vw", opacity: 0.7, marginTop: "1vw" }}>{erro || "Carregando…"}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.tela} onDoubleClick={entrarTelaCheia}>
      <CssGlobal />
      {/* Cabeçalho fixo: logo + data/hora */}
      <header style={S.topo}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
          {dados.logo_url
            ? <img src={dados.logo_url} alt="" style={{ height: "4.2vw", objectFit: "contain" }} />
            : <span style={{ fontSize: "2.4vw", fontWeight: 800, color: VERDE, letterSpacing: "0.1em" }}>{dados.nome || "CMD"}</span>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "2.6vw", fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pad(agora.getHours())}:{pad(agora.getMinutes())}</div>
          <div style={{ fontSize: "1vw", opacity: 0.6}}>{cap(DIAS[agora.getDay()])}, {agora.getDate()} de {MESES[agora.getMonth()]}</div>
        </div>
      </header>

      <main key={atual.k + "-" + idx} className="tv-entra" style={S.palco}>
        <Slide s={atual} d={dados} agora={agora} />
      </main>

      {/* Rodapé: barra de tempo do slide + bolinhas */}
      <footer style={S.rodape}>
        <div style={{ display: "flex", gap: "0.5vw", justifyContent: "center", marginBottom: "0.8vw" }}>
          {slides.map((x, i) => (
            <span key={x.k} style={{ width: i === idx % slides.length ? "2vw" : "0.6vw", height: "0.6vw", borderRadius: "1vw", background: i === idx % slides.length ? VERDE : "rgba(255,255,255,0.2)", transition: "all .4s" }} />
          ))}
        </div>
        <div style={{ height: "0.35vw", background: "rgba(255,255,255,0.08)" }}>
          <div key={atual.k + idx} className="tv-barra" style={{ height: "100%", background: VERDE, animationDuration: `${atual.ms}ms` }} />
        </div>
      </footer>

      {erro && <div style={S.offline}>● sem conexão — mostrando o último conteúdo</div>}

      {mostrarBotao && (
        <button ref={botaoRef} autoFocus onClick={() => { entrarTelaCheia(); setMostrarBotao(false); }} style={S.botaoFs}>
          ⛶ Aperte OK para tela cheia
        </button>
      )}
    </div>
  );
}

// 1ª vez na TV: digita o código de 6 números (Admin › Painel TV) com os números do controle.
// Com 6 números já confere sozinho; a TV guarda o código e não pede mais.
function TelaCodigo({ msg, conferindo, onCodigo }) {
  const [v, setV] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const mudar = (x) => { const d = x.replace(/D/g, "").slice(0, 6); setV(d); if (d.length === 6) onCodigo(d); };
  return (
    <div style={S.tela} onClick={() => ref.current?.focus()}>
      <CssGlobal />
      <style>{"html, body { cursor: auto; }"}</style>
      <div style={{ margin: "auto", textAlign: "center" }}>
        <div style={{ fontSize: "3.4vw", fontWeight: 800, color: VERDE }}>📺 Painel TV</div>
        <div style={{ fontSize: "1.8vw", opacity: 0.8, margin: "1.5vw 0 2.5vw" }}>Digite o código da TV <span style={{ opacity: 0.6 }}>(HOP › Admin › Painel TV)</span></div>
        <input ref={ref} autoFocus value={v} onChange={(e) => mudar(e.target.value)} inputMode="numeric" type="tel" maxLength={6}
          style={{ width: "26vw", fontSize: "5vw", letterSpacing: "0.5em", textAlign: "center", padding: "1vw 0 1vw 0.5em", borderRadius: "1vw",
            border: `0.25vw solid ${VERDE}`, background: "rgba(255,255,255,0.06)", color: "#fff", fontFamily: "inherit", fontWeight: 800, outline: "none" }} />
        {conferindo && <div style={{ fontSize: "1.5vw", marginTop: "1.5vw", opacity: 0.7 }}>Conferindo…</div>}
        {!conferindo && msg && <div style={{ color: "#E5534B", fontSize: "1.5vw", marginTop: "1.5vw" }}>{msg}</div>}
        <div style={{ fontSize: "1.2vw", opacity: 0.45, marginTop: "2vw" }}>Use os números do controle remoto · a TV lembra o código</div>
      </div>
    </div>
  );
}

function Slide({ s, d, agora }) {
  switch (s.tipo) {
    case "abertura": return <Abertura d={d} agora={agora} />;
    case "principios": return <Principios lista={d.principios} />;
    case "destaque": return <Destaque it={s.item} />;
    case "volumes": return <Volumes v={d.volumes} />;
    case "aviso": return <Aviso it={s.item} />;
    case "rh": return <Rh it={s.item} />;
    case "vagas": return <Vagas lista={d.vagas} />;
    default: return null;
  }
}

function Rotulo({ children }) {
  return <div style={{ color: VERDE, fontSize: "1.3vw", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "1vw" }}>{children}</div>;
}

function Abertura({ d, agora }) {
  return (
    <div style={{ margin: "auto", textAlign: "center" }}>
      {d.logo_url
        ? <img src={d.logo_url} alt="" style={{ maxHeight: "38vh", maxWidth: "60vw", objectFit: "contain" }} />
        : <div style={{ fontSize: "12vw", fontWeight: 900, color: VERDE, letterSpacing: "0.08em", lineHeight: 1 }}>{d.nome || "CMD"}</div>}
      <div style={{ fontSize: "4vw", fontWeight: 700, marginTop: "3vw" }}>{saudacao(agora.getHours())}, time {d.nome || "CMD"}!</div>
      <div style={{ fontSize: "1.8vw", opacity: 0.6, marginTop: "0.6vw"}}>
        {cap(DIAS[agora.getDay()])}, {agora.getDate()} de {MESES[agora.getMonth()]} de {agora.getFullYear()}
      </div>
    </div>
  );
}

function Principios({ lista }) {
  const l = (lista || []).slice(0, 10);
  return (
    <div style={{ width: "100%" }}>
      <Rotulo>Nossos {l.length} princípios</Rotulo>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: "1.1vw 3vw", height: "62vh" }}>
        {l.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "1.2vw", background: "rgba(255,255,255,0.04)", borderRadius: "0.8vw", padding: "0.6vw 1.2vw", borderLeft: `0.3vw solid ${VERDE}` }}>
            <span style={{ fontSize: "2.6vw", fontWeight: 900, color: VERDE, minWidth: "3.4vw", fontVariantNumeric: "tabular-nums" }}>{pad(i + 1)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "1.45vw", fontWeight: 700, lineHeight: 1.15 }}>{p.titulo}</div>
              {p.texto && <div style={{ fontSize: "0.95vw", opacity: 0.65, marginTop: "0.25vw", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.texto}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Destaque({ it }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4vw", width: "100%" }}>
      <div style={{ flex: 1.3 }}>
        <Rotulo>Princípio em foco</Rotulo>
        <div style={{ fontSize: "4.6vw", fontWeight: 800, lineHeight: 1.08 }}>{it.titulo}</div>
        {linhas(it.texto).map((l, i) => <p key={i} style={{ fontSize: "2vw", opacity: 0.8, lineHeight: 1.4, margin: "1.4vw 0 0" }}>{l}</p>)}
      </div>
      {it.imagem_url && <img src={it.imagem_url} alt="" style={{ flex: 1, maxWidth: "38vw", maxHeight: "66vh", objectFit: "contain", borderRadius: "1vw" }} />}
    </div>
  );
}

function Volumes({ v }) {
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("pt-BR");
  const mesNome = (() => { const [dd, mm] = String(v.data || "").split("/"); return mm ? MESES[+mm - 1] : ""; })();
  const cats = v.categorias || [];
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "2vw" }}>
        <Rotulo>Volumes da operação · {mesNome}</Rotulo>
        {v.diasUteis && <span style={{ marginLeft: "auto", fontSize: "1.2vw", opacity: 0.6 }}>Dia útil {v.diasUteis.feitos} de {v.diasUteis.total} · atualizado {v.data}</span>}
      </div>
      <div style={{ display: "flex", gap: "1.5vw", fontSize: "1vw", opacity: 0.55, margin: "-0.3vw 0 1.4vw" }}>
        <span>Barra = tendência do mês ÷ meta</span><span>│ marca branca = 100% da meta</span><span>│ sem meta: mostra o realizado</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
        {cats.map((c) => {
          const temMeta = c.meta != null && c.meta > 0;
          const p = temMeta ? c.pctT : null;
          const larg = temMeta ? Math.min(100, (p || 0) / 1.2) : 0; // escala até 120% da meta
          const un = c.key === "mktp" ? "R$" : "HL";
          const val = (n) => `${un === "R$" ? "R$ " : ""}${fmt(n)}${un === "HL" ? " HL" : ""}`;
          // Sem meta: barra neutra = realizado ÷ tendência (quanto do mês já foi feito) e o
          // número da direita vira o REALIZADO (em vez de "—").
          const largSem = !temMeta && c.tend > 0 ? Math.min(100, (c.real / c.tend) * 100 / 1.2) : 0;
          return (
            <div key={c.key} style={{ display: "grid", gridTemplateColumns: "13vw 1fr 12vw", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ fontSize: "1.8vw", fontWeight: 700 }}>{c.label}</div>
              <div>
                <div style={{ position: "relative", height: "3.2vh", background: "rgba(255,255,255,0.07)", borderRadius: "0.5vw" }}>
                  {temMeta && <div className="tv-cresce" style={{ position: "absolute", inset: 0, width: `${larg}%`, background: corPct(p), borderRadius: "0.5vw" }} />}
                  {temMeta && <div style={{ position: "absolute", top: "-0.5vh", bottom: "-0.5vh", left: `${100 / 1.2}%`, width: "0.2vw", background: "#fff" }} />}
                  {!temMeta && largSem > 0 && <div className="tv-cresce" style={{ position: "absolute", inset: 0, width: `${largSem}%`, background: "rgba(125,186,61,0.45)", borderRadius: "0.5vw" }} />}
                </div>
                <div style={{ fontSize: "1.05vw", opacity: 0.7, marginTop: "0.4vh" }}>
                  {temMeta
                    ? <>Real {val(c.real)} · Meta {val(c.meta)} · Tendência {val(c.tend)}</>
                    : <>Tendência {val(c.tend)} · sem meta no mês</>}
                </div>
              </div>
              {temMeta
                ? <div style={{ fontSize: "3vw", fontWeight: 800, textAlign: "right", color: corPct(p), fontVariantNumeric: "tabular-nums" }}>{p == null ? "—" : `${p}%`}</div>
                : <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", lineHeight: 1.05 }}>
                    <div style={{ fontSize: un === "R$" ? "1.9vw" : "2.3vw", fontWeight: 800 }}>{val(c.real)}</div>
                    <div style={{ fontSize: "0.9vw", opacity: 0.55 }}>realizado</div>
                  </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Aviso({ it }) {
  const temTexto = !!(String(it.titulo || "").trim() || String(it.texto || "").trim());
  if (it.imagem_url && !temTexto) {
    return <img src={it.imagem_url} alt="" style={{ margin: "auto", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "1vw" }} />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4vw", width: "100%" }}>
      <div style={{ flex: 1.2 }}>
        <Rotulo>Aviso</Rotulo>
        <div style={{ fontSize: "4.2vw", fontWeight: 800, lineHeight: 1.1 }}>{it.titulo}</div>
        {linhas(it.texto).map((l, i) => <p key={i} style={{ fontSize: "2vw", opacity: 0.85, lineHeight: 1.4, margin: "1.2vw 0 0" }}>{l}</p>)}
      </div>
      {it.imagem_url && <img src={it.imagem_url} alt="" style={{ flex: 1, maxWidth: "42vw", maxHeight: "66vh", objectFit: "contain", borderRadius: "1vw" }} />}
    </div>
  );
}

// RH: cada linha do texto vira um cartão (ex.: "05/11 – Maria (Vendas)"). Poucas linhas = texto grande.
function Rh({ it }) {
  const ls = linhas(it.texto);
  const lista = ls.length >= 3;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3vw", width: "100%" }}>
      <div style={{ flex: 1.4, minWidth: 0 }}>
        <Rotulo>Recado do RH</Rotulo>
        <div style={{ fontSize: "3.8vw", fontWeight: 800, lineHeight: 1.1, marginBottom: "2vw" }}>{it.titulo}</div>
        {lista ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${ls.length > 8 ? 3 : 2}, 1fr)`, gap: "1vw" }}>
            {ls.slice(0, 18).map((l, i) => (
              <div key={i} style={{ background: "rgba(125,186,61,0.1)", border: "1px solid rgba(125,186,61,0.3)", borderRadius: "0.8vw", padding: "0.9vw 1.2vw", fontSize: ls.length > 8 ? "1.35vw" : "1.7vw", fontWeight: 600 }}>{l}</div>
            ))}
          </div>
        ) : ls.map((l, i) => <p key={i} style={{ fontSize: "2.1vw", opacity: 0.85, lineHeight: 1.4, margin: "0 0 1vw" }}>{l}</p>)}
      </div>
      {it.imagem_url && <img src={it.imagem_url} alt="" style={{ flex: 1, maxWidth: "36vw", maxHeight: "66vh", objectFit: "contain", borderRadius: "1vw" }} />}
    </div>
  );
}

function Vagas({ lista }) {
  const l = (lista || []).slice(0, 6);
  return (
    <div style={{ width: "100%" }}>
      <Rotulo>Vagas em aberto</Rotulo>
      <div style={{ display: "grid", gridTemplateColumns: l.length > 3 ? "1fr 1fr 1fr" : `repeat(${l.length}, 1fr)`, gap: "1.6vw" }}>
        {l.map((v) => (
          <div key={v.id} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "1vw", padding: "1.8vw", borderTop: `0.35vw solid ${VERDE}` }}>
            <div style={{ fontSize: "2.2vw", fontWeight: 800, lineHeight: 1.15 }}>{v.titulo}</div>
            {linhas(v.texto).slice(0, 6).map((x, i) => <div key={i} style={{ fontSize: "1.3vw", opacity: 0.75, marginTop: "0.6vw", lineHeight: 1.35 }}>{x}</div>)}
          </div>
        ))}
      </div>
      <div style={{ fontSize: "1.6vw", marginTop: "2.5vw", opacity: 0.85 }}>Interessou? Procure o <b style={{ color: VERDE }}>RH</b> e indique alguém!</div>
    </div>
  );
}

function CssGlobal() {
  return (
    <style>{`
      .assinatura { display: none !important; }
      html, body { background: ${FUNDO}; overflow: hidden; cursor: none; }
      .tv-entra { animation: tvEntra .7s ease both; }
      @keyframes tvEntra { from { opacity: 0; transform: translateY(1.5vh); } to { opacity: 1; transform: none; } }
      .tv-barra { width: 0; animation-name: tvBarra; animation-timing-function: linear; animation-fill-mode: forwards; }
      @keyframes tvBarra { from { width: 0; } to { width: 100%; } }
      .tv-cresce { animation: tvCresce 1.2s ease-out both; transform-origin: left; }
      @keyframes tvCresce { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    `}</style>
  );
}

const S = {
  tela: {
    position: "fixed", inset: 0, background: `radial-gradient(ellipse at top left, #18301f 0%, ${FUNDO} 60%)`,
    color: "#fff", display: "flex", flexDirection: "column", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", overflow: "hidden",
  },
  topo: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.6vw 3vw 0" },
  palco: { flex: 1, display: "flex", alignItems: "center", padding: "1vw 4vw", minHeight: 0 },
  rodape: { padding: "0 0 0" },
  offline: { position: "fixed", top: "0.6vw", left: "50%", transform: "translateX(-50%)", fontSize: "0.9vw", color: "#E8C547", opacity: 0.8 },
  botaoFs: {
    position: "fixed", bottom: "3vw", left: "50%", transform: "translateX(-50%)", zIndex: 10, cursor: "pointer",
    background: VERDE, color: FUNDO, border: "none", borderRadius: "2vw", padding: "1vw 2.4vw", fontSize: "1.4vw",
    fontWeight: 700, fontFamily: "inherit", boxShadow: "0 0 0 0.4vw rgba(125,186,61,0.3)",
  },
};
