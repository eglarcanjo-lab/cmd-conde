// Admin › Painel TV — conteúdo da Smart TV da empresa (página /tv).
// Link da TV (com chave), logo, slides ligados + tempo de cada um, e os itens:
// 10 princípios, princípio em foco, avisos, recados do RH e vagas. Muda na TV em até ~3 min.
import { useEffect, useState } from "react";
import api from "../../services/api";

const VERDE = "#7DBA3D";
const SLIDE_LABEL = {
  abertura: "🏁 Abertura (logo + saudação)", principios: "📜 10 Princípios", destaque: "⭐ Princípio em foco",
  volumes: "📊 Volumes da operação", aviso: "📢 Avisos (1 slide cada)", rh: "🎂 Recados do RH (1 slide cada)", vagas: "💼 Vagas em aberto",
};
const SECOES = [
  { tipo: "principio", titulo: "📜 10 Princípios", dica: "Um por item, na ordem (campo Ordem = número do princípio). Título = o princípio; texto = explicação curta (opcional).", semImagem: true, semDatas: true },
  { tipo: "destaque", titulo: "⭐ Princípio em foco", dica: "O princípio da semana/mês. Use as datas para trocar sozinho (ex.: cadastre os próximos já com início e fim)." },
  { tipo: "aviso", titulo: "📢 Avisos", dica: "Só imagem (arte pronta) = ocupa a tela toda. Com título/texto = texto à esquerda e imagem à direita. Cada linha do texto vira um parágrafo." },
  { tipo: "rh", titulo: "🎂 Recados do RH", dica: "Ex.: título “Aniversariantes de Novembro” e no texto UMA PESSOA POR LINHA (“05/11 – Maria · Vendas”). 3+ linhas viram cartões." },
  { tipo: "vaga", titulo: "💼 Vagas em aberto", dica: "Título = cargo. Texto = uma informação por linha (setor, requisitos, como se candidatar). Aparecem juntas num slide (até 6).", semImagem: true },
];
const vazio = (tipo) => ({ tipo, titulo: "", texto: "", imagem_url: "", ativo: true, data_inicio: "", data_fim: "", ordem: "", duracao: "" });
const isTrue = (v) => v === true || String(v).toLowerCase() === "true";

async function subirImagem(file) {
  const fd = new FormData();
  fd.append("imagem", file);
  const r = await api.post("/api/tv/admin/upload", fd, { timeout: 90000 });
  return r.data.url;
}

export default function PainelTVAdmin() {
  const [cfg, setCfg] = useState(null);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = () => api.get("/api/tv/admin")
    .then((r) => { setCfg(r.data.config); setItens(r.data.itens || []); setErro(""); })
    .catch((e) => setErro(e?.response?.data?.error || "Erro ao carregar."));
  useEffect(() => { carregar(); }, []);

  if (erro && !cfg) return <div style={{ color: "#E5534B" }}>{erro}</div>;
  if (!cfg) return <div style={{ color: "rgba(255,255,255,0.5)" }}>Carregando…</div>;

  const link = `${window.location.origin}/tv?k=${cfg.chave}`;

  async function salvarCfg(parcial) {
    setSalvandoCfg(true);
    try { const r = await api.put("/api/tv/admin/config", { ...cfg, ...parcial }); setCfg(r.data.config); }
    catch (e) { alert(e?.response?.data?.error || "Erro ao salvar."); }
    finally { setSalvandoCfg(false); }
  }
  async function novaChave() {
    if (!confirm("Gerar um link novo? O link atual para de funcionar e a TV precisa abrir o novo.")) return;
    const r = await api.post("/api/tv/admin/chave");
    setCfg((c) => ({ ...c, chave: r.data.chave }));
  }
  async function trocarLogo(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { const url = await subirImagem(f); await salvarCfg({ logo_url: url }); }
    catch (err) { alert(err?.response?.data?.error || "Erro no upload."); }
  }

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "1.3rem" }}>📺 Painel TV</h2>
        <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.55)", fontSize: "0.85rem" }}>
          Slides da Smart TV da empresa. Alterações aparecem na TV em até 3 minutos, sem mexer nela.
        </p>
      </div>

      {/* Link da TV */}
      <div style={S.card}>
        <b>🔗 Link da TV</b>
        <p style={S.dica}>Abra esse endereço no navegador da TV <b>uma vez</b> (depois ela lembra; pode ser só <code>/tv</code>). Aperte OK no controle para entrar em tela cheia.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ ...S.input, flex: 1, minWidth: 260, overflowX: "auto", whiteSpace: "nowrap" }}>{link}</code>
          <button style={S.btn} onClick={() => { navigator.clipboard?.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}>{copiado ? "✓ Copiado" : "Copiar"}</button>
          <a href={link} target="_blank" rel="noreferrer" style={{ ...S.btnSec, textDecoration: "none" }}>Abrir prévia ↗</a>
          <button style={S.btnSec} onClick={novaChave}>Gerar link novo</button>
        </div>
      </div>

      {/* Identidade + slides */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        <div style={S.card}>
          <b>🏷️ Logo e nome</b>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <div style={{ width: 120, height: 70, background: "#0c1410", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
              {cfg.logo_url ? <img src={cfg.logo_url} alt="" style={{ maxWidth: 110, maxHeight: 60, objectFit: "contain" }} /> : <span style={{ color: VERDE, fontWeight: 800 }}>{cfg.nome}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={S.btnSec}>Enviar logo (PNG fundo transparente)<input type="file" accept="image/*" hidden onChange={trocarLogo} /></label>
              {cfg.logo_url && <button style={S.btnSec} onClick={() => salvarCfg({ logo_url: "" })}>Remover logo</button>}
            </div>
          </div>
          <label style={{ ...S.lbl, marginTop: 10 }}>Nome (saudação “Bom dia, time …!”)
            <input style={S.input} value={cfg.nome} onChange={(e) => setCfg({ ...cfg, nome: e.target.value })} onBlur={() => salvarCfg({})} />
          </label>
        </div>

        <div style={S.card}>
          <b>🎞️ Slides e tempo (segundos)</b>
          <div style={{ marginTop: 8 }}>
            {Object.keys(SLIDE_LABEL).map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <input type="checkbox" checked={!!cfg.ligados[k]} onChange={(e) => setCfg({ ...cfg, ligados: { ...cfg.ligados, [k]: e.target.checked } })} />
                <span style={{ flex: 1, fontSize: "0.88rem", opacity: cfg.ligados[k] ? 1 : 0.45 }}>{SLIDE_LABEL[k]}</span>
                <input type="number" min={3} max={600} style={{ ...S.input, width: 70, textAlign: "right" }} value={cfg.tempos[k]} onChange={(e) => setCfg({ ...cfg, tempos: { ...cfg.tempos, [k]: e.target.value } })} />
              </div>
            ))}
          </div>
          <button style={{ ...S.btn, marginTop: 8 }} disabled={salvandoCfg} onClick={() => salvarCfg({})}>{salvandoCfg ? "Salvando…" : "Salvar slides"}</button>
        </div>
      </div>

      {SECOES.map((sec) => (
        <Secao key={sec.tipo} sec={sec} itens={itens.filter((i) => i.tipo === sec.tipo)} onMudou={carregar} />
      ))}
    </div>
  );
}

function Secao({ sec, itens, onMudou }) {
  const [form, setForm] = useState(null); // null = fechado; {…, id?}
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const lista = [...itens].sort((a, b) => (parseInt(a.ordem) || 99) - (parseInt(b.ordem) || 99));

  async function salvar() {
    setSalvando(true);
    try {
      if (form.id) await api.put(`/api/tv/admin/item/${form.id}`, form);
      else await api.post("/api/tv/admin/item", form);
      setForm(null); onMudou();
    } catch (e) { alert(e?.response?.data?.error || "Erro ao salvar."); }
    finally { setSalvando(false); }
  }
  async function remover(it) {
    if (!confirm(`Remover “${it.titulo || "item"}”?`)) return;
    await api.delete(`/api/tv/admin/item/${it.id}`).catch(() => alert("Erro ao remover."));
    onMudou();
  }
  async function alternar(it) {
    await api.put(`/api/tv/admin/item/${it.id}`, { ativo: !isTrue(it.ativo) }).catch(() => alert("Erro."));
    onMudou();
  }
  async function imagem(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setSubindo(true);
    try { const url = await subirImagem(f); setForm((x) => ({ ...x, imagem_url: url })); }
    catch (err) { alert(err?.response?.data?.error || "Erro no upload."); }
    finally { setSubindo(false); }
  }
  const periodo = (it) => (it.data_inicio || it.data_fim)
    ? `${it.data_inicio ? it.data_inicio.split("-").reverse().join("/") : "…"} → ${it.data_fim ? it.data_fim.split("-").reverse().join("/") : "…"}` : "";

  return (
    <div style={S.card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <b>{sec.titulo}</b>
        <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>{lista.length} item(ns)</span>
        <button style={{ ...S.btn, marginLeft: "auto" }} onClick={() => setForm(vazio(sec.tipo))}>+ Adicionar</button>
      </div>
      <p style={S.dica}>{sec.dica}</p>

      {lista.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)", opacity: isTrue(it.ativo) ? 1 : 0.45 }}>
          <span style={{ width: 26, color: VERDE, fontWeight: 700, fontSize: "0.85rem" }}>{it.ordem}</span>
          {it.imagem_url && <img src={it.imagem_url} alt="" style={{ width: 44, height: 30, objectFit: "cover", borderRadius: 4 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.titulo || <i style={{ opacity: 0.5 }}>(só imagem)</i>}</div>
            <div style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {[periodo(it), it.duracao ? `${it.duracao}s` : "", String(it.texto || "").replace(/\s*\n\s*/g, " · ")].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button style={S.mini} onClick={() => alternar(it)}>{isTrue(it.ativo) ? "Pausar" : "Ativar"}</button>
          <button style={S.mini} onClick={() => setForm({ ...it, ativo: isTrue(it.ativo) })}>Editar</button>
          <button style={{ ...S.mini, color: "#E5534B" }} onClick={() => remover(it)}>✕</button>
        </div>
      ))}

      {form && (
        <div style={{ marginTop: 10, padding: 12, background: "rgba(0,0,0,0.25)", borderRadius: 8, display: "grid", gap: 8 }}>
          <label style={S.lbl}>Título<input style={S.input} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></label>
          <label style={S.lbl}>Texto (cada linha = um parágrafo/cartão)
            <textarea rows={5} style={{ ...S.input, resize: "vertical", fontFamily: "inherit" }} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
          </label>
          {!sec.semImagem && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {form.imagem_url && <img src={form.imagem_url} alt="" style={{ height: 60, borderRadius: 6 }} />}
              <label style={S.btnSec}>{subindo ? "Enviando…" : form.imagem_url ? "Trocar imagem" : "Enviar imagem"}<input type="file" accept="image/*" hidden onChange={imagem} /></label>
              {form.imagem_url && <button style={S.btnSec} onClick={() => setForm({ ...form, imagem_url: "" })}>Tirar imagem</button>}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={S.lbl}>Ordem<input type="number" style={{ ...S.input, width: 80 }} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} /></label>
            {!sec.semDatas && <>
              <label style={S.lbl}>Mostrar a partir de<input type="date" style={S.input} value={form.data_inicio || ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></label>
              <label style={S.lbl}>Até<input type="date" style={S.input} value={form.data_fim || ""} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></label>
              <label style={S.lbl}>Tempo (s, vazio = padrão)<input type="number" style={{ ...S.input, width: 110 }} value={form.duracao || ""} onChange={(e) => setForm({ ...form, duracao: e.target.value })} /></label>
            </>}
            <label style={{ ...S.lbl, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18 }}>
              <input type="checkbox" checked={!!form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn} disabled={salvando || subindo} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
            <button style={S.btnSec} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16 },
  dica: { margin: "6px 0 10px", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", lineHeight: 1.45 },
  lbl: { display: "flex", flexDirection: "column", gap: 4, fontSize: "0.78rem", color: "rgba(255,255,255,0.6)" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#fff", padding: "7px 9px", fontSize: "0.88rem" },
  btn: { background: VERDE, color: "#0c1410", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" },
  btnSec: { background: "rgba(255,255,255,0.07)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", display: "inline-block" },
  mini: { background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: "0.76rem", fontFamily: "inherit" },
};
