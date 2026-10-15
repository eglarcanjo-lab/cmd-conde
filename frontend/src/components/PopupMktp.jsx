// Popup do incentivo "Desafio Marketplace" (meta coletiva de faturamento MKTP no mês).
// Aparece ao entrar no app SEMPRE QUE O CORA FOR ATUALIZADO (compara o carimbo da última
// importação com o último que o usuário viu). Arte em CSS/SVG — pensada para o celular.
// Dado: GET /api/resumo/incentivo-mktp. Mostrado na Home clássica (celular / RN).
import { useState, useEffect } from "react";
import api from "../services/api";
import { reservarInterrupcao } from "../utils/interrupcao";

const KEY = "mktp_popup_visto"; // guarda o carimbo do CORA já visto
const lerVisto = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
const marcarVisto = (v) => { try { localStorage.setItem(KEY, v); } catch { /* ignore */ } };
const rs = (n) => `R$ ${(Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const mil = (n) => {
  const v = Number(n) || 0;
  return v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : rs(v);
};

function Anel({ pct }) {
  const R = 84, C = 2 * Math.PI * R;
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(Math.min(100, pct)), 150); return () => clearTimeout(t); }, [pct]);
  return (
    <svg viewBox="0 0 200 200" className="mk-anel" aria-hidden="true">
      <defs>
        <linearGradient id="mkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE259" />
          <stop offset="55%" stopColor="#B8F35A" />
          <stop offset="100%" stopColor="#3DDC97" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="16" />
      <circle cx="100" cy="100" r={R} fill="none" stroke="url(#mkGrad)" strokeWidth="16" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - p / 100)} transform="rotate(-90 100 100)"
        style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)" }} />
    </svg>
  );
}

export default function PopupMktp() {
  const [d, setD] = useState(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true, timer;
    api.get("/api/resumo/incentivo-mktp", { timeout: 20000 }).then((r) => {
      const x = r.data;
      if (!vivo || !x?.ativo || !x.atualizado_em || lerVisto() === x.atualizado_em) return;
      setD(x);
      // espera o popup de artes (comunicado do admin) fechar, se estiver aberto
      const tentar = () => {
        if (!vivo) return;
        if (document.querySelector('[data-popup="diario"]')) { timer = setTimeout(tentar, 1000); return; }
        reservarInterrupcao("mktp");
        setAberto(true);
      };
      timer = setTimeout(tentar, 1200);
    }).catch(() => {});
    return () => { vivo = false; clearTimeout(timer); };
  }, []);

  if (!d || !aberto) return null;
  const fechar = () => { marcarVisto(d.atualizado_em); setAberto(false); };
  const bateu = d.realizado >= d.meta;
  const noRitmo = !bateu && d.pct_tendencia != null && d.pct_tendencia >= 100;
  const frase = bateu ? "META BATIDA! Que time! 🏆"
    : d.encerrado ? "Desafio encerrado — obrigado pelo esforço! 🙌"
    : noRitmo ? "No ritmo de bater a meta! Segura esse pique 🔥"
    : "Bora acelerar! Cada pedido de Marketplace conta 🚀";

  return (
    <div className="mk-overlay" onClick={(e) => e.target === e.currentTarget && fechar()} role="dialog" aria-label={`${d.titulo} ${d.campanha}`}>
      <style>{CSS}</style>
      <div className="mk-card">
        <div className="mk-bolhas" aria-hidden="true">
          {["🛒", "💰", "🚀", "⭐", "🛍️", "💸", "🔥", "🎯"].map((e, i) => <span key={i} style={{ left: `${6 + i * 12}%`, animationDelay: `${i * 0.7}s` }}>{e}</span>)}
        </div>
        <button className="mk-x" onClick={fechar} aria-label="Fechar">×</button>

        <div className="mk-selo">INCENTIVO · {String(d.campanha).toUpperCase()}</div>
        <h2 className="mk-tit">{d.titulo}</h2>
        <p className="mk-sub">Faturamento Marketplace da operação</p>

        <div className="mk-anel-wrap">
          <Anel pct={d.pct} />
          <div className="mk-centro">
            <b className="mk-pct">{d.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b>
            <span className="mk-da">da meta</span>
          </div>
        </div>

        <div className="mk-valores">
          <b>{rs(d.realizado)}</b>
          <span>de {rs(d.meta)}</span>
        </div>

        <div className="mk-chips">
          {!bateu && <div className="mk-chip"><span>Faltam</span><b>{mil(d.falta)}</b></div>}
          {!bateu && !d.encerrado && d.dias_restantes > 0 && <div className="mk-chip"><span>Por dia útil</span><b>{mil(d.ritmo_dia)}</b></div>}
          {!d.encerrado && <div className="mk-chip"><span>Dias úteis</span><b>{d.dias_restantes} restantes</b></div>}
          {d.tendencia != null && !d.encerrado && <div className="mk-chip"><span>Tendência</span><b>{mil(d.tendencia)}</b></div>}
        </div>

        {d.meu && (
          <div className="mk-meu">
            <span>Sua contribuição</span>
            <b>{rs(d.meu.real)}</b>
            {d.meu.posicao && <em>{d.meu.posicao <= 3 ? ["🥇", "🥈", "🥉"][d.meu.posicao - 1] : "🏅"} {d.meu.posicao}º de {d.meu.de} RNs</em>}
          </div>
        )}

        <p className="mk-frase">{frase}</p>
        <button className="mk-cta" onClick={fechar}>BORA! 💪</button>
        <p className="mk-rodape">Atualizado com o CORA de {d.atualizado_em}</p>
      </div>
    </div>
  );
}

const CSS = `
.mk-overlay { position: fixed; inset: 0; z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(4,10,7,0.82); backdrop-filter: blur(6px); animation: mkFade .35s ease-out; }
.mk-card { position: relative; width: 100%; max-width: 380px; max-height: calc(100vh - 32px); overflow-y: auto; overflow-x: hidden;
  border-radius: 26px; padding: 26px 22px 18px; text-align: center; color: #fff;
  background: radial-gradient(120% 80% at 50% 0%, #1f6b3a 0%, #0f3d27 45%, #071a12 100%);
  border: 1px solid rgba(184,243,90,0.35); box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 0 6px rgba(184,243,90,0.06) inset;
  animation: mkPop .5s cubic-bezier(.2,1.3,.4,1); font-family: 'Poppins','Segoe UI',system-ui,sans-serif; }
.mk-bolhas { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.mk-bolhas span { position: absolute; bottom: -30px; font-size: 1.3rem; opacity: .0; animation: mkSobe 6s linear infinite; }
.mk-x { position: absolute; top: 10px; right: 12px; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 32px; height: 32px;
  border-radius: 50%; font-size: 1.2rem; cursor: pointer; z-index: 2; }
.mk-selo { display: inline-block; font-size: .68rem; font-weight: 800; letter-spacing: .14em; padding: 5px 12px; border-radius: 99px;
  color: #0b2416; background: linear-gradient(90deg,#FFE259,#B8F35A); position: relative; z-index: 1; }
.mk-tit { margin: 12px 0 2px; font-size: 1.75rem; font-weight: 900; line-height: 1.05; letter-spacing: -.01em; position: relative; z-index: 1;
  background: linear-gradient(90deg,#fff,#FFE259 60%,#B8F35A); -webkit-background-clip: text; background-clip: text; color: transparent; }
.mk-sub { margin: 0; color: rgba(255,255,255,0.7); font-size: .85rem; position: relative; z-index: 1; }
.mk-anel-wrap { position: relative; width: 190px; height: 190px; margin: 16px auto 6px; z-index: 1; }
.mk-anel { width: 100%; height: 100%; filter: drop-shadow(0 0 14px rgba(184,243,90,0.35)); }
.mk-centro { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.mk-pct { font-size: 2.6rem; font-weight: 900; line-height: 1; }
.mk-da { font-size: .78rem; color: rgba(255,255,255,0.65); margin-top: 2px; }
.mk-valores { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; position: relative; z-index: 1; }
.mk-valores b { font-size: 1.45rem; font-weight: 800; color: #B8F35A; }
.mk-valores span { font-size: .85rem; color: rgba(255,255,255,0.65); }
.mk-chips { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; position: relative; z-index: 1; }
.mk-chip { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 8px 6px; display: flex; flex-direction: column; gap: 2px; }
.mk-chip span { font-size: .68rem; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: .06em; }
.mk-chip b { font-size: .95rem; }
.mk-meu { background: linear-gradient(90deg, rgba(255,226,89,0.16), rgba(184,243,90,0.12)); border: 1px solid rgba(255,226,89,0.4);
  border-radius: 16px; padding: 10px; display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; position: relative; z-index: 1; }
.mk-meu span { font-size: .7rem; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: .08em; }
.mk-meu b { font-size: 1.25rem; color: #FFE259; }
.mk-meu em { font-style: normal; font-size: .82rem; font-weight: 700; }
.mk-frase { margin: 6px 0 12px; font-weight: 700; font-size: .95rem; position: relative; z-index: 1; }
.mk-cta { width: 100%; border: none; border-radius: 16px; padding: 14px; font-size: 1.05rem; font-weight: 900; letter-spacing: .04em; cursor: pointer;
  color: #0b2416; background: linear-gradient(90deg,#FFE259,#B8F35A,#3DDC97); background-size: 200% 100%; animation: mkBrilho 3s ease-in-out infinite;
  box-shadow: 0 8px 24px rgba(184,243,90,0.35); position: relative; z-index: 1; font-family: inherit; }
.mk-rodape { margin: 10px 0 0; font-size: .68rem; color: rgba(255,255,255,0.4); position: relative; z-index: 1; }
@keyframes mkFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes mkPop { from { transform: scale(.85) translateY(20px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes mkSobe { 0% { transform: translateY(0) rotate(0); opacity: 0 } 10% { opacity: .55 } 90% { opacity: .35 } 100% { transform: translateY(-560px) rotate(25deg); opacity: 0 } }
@keyframes mkBrilho { 0%,100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }
@media (prefers-reduced-motion: reduce) { .mk-overlay, .mk-card, .mk-cta, .mk-bolhas span { animation: none !important; } }
`;
