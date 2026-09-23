// Lia — mascote da HOP. Surge deslizando 1x por dia na Home, com um balão de fala
// comentando o Shelf (5 mais urgentes) e as categorias abaixo da tendência.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const VERDE = "#7DBA3D";
const fmtN = (v) => Number(v || 0).toLocaleString("pt-BR");
const hojeStr = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const KEY = () => `lia_seen_${hojeStr()}`;
const jaViu = () => { try { return localStorage.getItem(KEY()) === "1"; } catch { return false; } };
const marcarVisto = () => { try { localStorage.setItem(KEY(), "1"); } catch { /* ignore */ } };

export default function PopupLia() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [aberto, setAberto] = useState(false);
  // Admin: aparece SEMPRE que entra na Home (fácil ver as alterações). Demais: 1x/dia.
  const sempre = usuario?.perfil === "admin";

  useEffect(() => {
    if (!sempre && jaViu()) return;
    let vivo = true;
    api.get("/api/lia")
      .then((r) => {
        if (!vivo) return;
        const d = r.data || {};
        const temShelf = (d.shelf || []).length > 0;
        const temCat = (d.categorias || []).length > 0;
        if (temShelf || temCat) { setDados(d); setTimeout(() => vivo && setAberto(true), 700); }
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [sempre]);

  const fechar = () => { marcarVisto(); setAberto(false); };
  const irShelf = () => { marcarVisto(); navigate("/produtos"); };

  if (!dados) return null;

  const shelf = dados.shelf || [];
  const cats = dados.categorias || [];
  const maisUrgente = shelf[0];

  return (
    <div className={`lia-root ${aberto ? "lia-on" : ""}`} role="dialog" aria-label="Lia">
      <div className="lia-bolha">
        <button className="lia-x" onClick={fechar} aria-label="Fechar">×</button>
        <div className="lia-oi">Oi! Aqui é a <b>Lia</b> 👋</div>

        {shelf.length > 0 && (
          <div className="lia-item">
            🍺 <b>Shelf:</b> {fmtN(dados.shelf_total)} {dados.shelf_total === 1 ? "item" : "itens"} pra girar
            {maisUrgente && <> — o mais urgente (<b>{maisUrgente.descricao || maisUrgente.cod}</b>) vence em <b>{maisUrgente.dias_vencer}d</b></>}. Bora dar saída! 😉
          </div>
        )}

        {cats.length > 0 && (
          <div className="lia-item">
            📉 <b>Atenção:</b> {cats.map((c, i) => (
              <span key={c.categoria}>{i > 0 ? " e " : ""}<b>{c.categoria}</b> em {c.pctTend}% da tendência</span>
            ))}. Precisa de um gás pra bater a meta! 💪
          </div>
        )}

        <div className="lia-btns">
          {shelf.length > 0 && <button className="lia-btn lia-btn-v" onClick={irShelf}>Ver Shelf</button>}
          <button className="lia-btn" onClick={fechar}>Valeu, Lia! 👍</button>
        </div>
      </div>

      <img className="lia-img" src="/lia.png" alt="Lia" />

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.lia-root {
  position: fixed; right: 16px; bottom: 0; z-index: 6000;
  display: flex; align-items: flex-end; gap: 0;
  transform: translateY(115%); opacity: 0;
  transition: transform .6s cubic-bezier(.18,.9,.32,1.2), opacity .5s ease;
  pointer-events: none;
}
.lia-root.lia-on { transform: translateY(0); opacity: 1; pointer-events: auto; }
.lia-img {
  width: clamp(120px, 22vw, 190px); height: auto; display: block;
  filter: drop-shadow(0 8px 20px rgba(0,0,0,.45));
  transform-origin: bottom center;
  animation: lia-balanca 3.2s ease-in-out infinite;
}
.lia-root.lia-on .lia-img { animation: lia-entra .7s ease .0s 1, lia-balanca 3.2s ease-in-out 1.2s infinite; }
/* scaleX(-1) espelha a Lia p/ ela apontar pro balão (à esquerda). Vai embutido em
   cada keyframe porque a animação sobrescreveria um transform estático. */
@keyframes lia-entra { 0%{transform:scaleX(-1) translateY(30px) rotate(-4deg);} 60%{transform:scaleX(-1) translateY(-6px) rotate(3deg);} 100%{transform:scaleX(-1) translateY(0) rotate(0);} }
@keyframes lia-balanca { 0%,100%{transform:scaleX(-1) rotate(-2.5deg);} 50%{transform:scaleX(-1) rotate(2.5deg);} }

.lia-bolha {
  position: relative; align-self: center; margin-bottom: 40px;
  max-width: 300px; background: #12211a; color: #eaf3e2;
  border: 1px solid rgba(125,186,61,.4); border-radius: 16px 16px 4px 16px;
  padding: 14px 16px 12px; font-family: 'Poppins','Segoe UI',system-ui,sans-serif;
  font-size: .82rem; line-height: 1.45; box-shadow: 0 10px 30px rgba(0,0,0,.5);
}
.lia-bolha::after { /* rabinho apontando pra Lia */
  content: ""; position: absolute; right: -9px; bottom: 22px;
  border: 9px solid transparent; border-left-color: #12211a; border-right: 0;
}
.lia-oi { color: ${VERDE}; font-weight: 700; margin-bottom: 8px; font-size: .9rem; }
.lia-item { margin: 7px 0; }
.lia-item b { color: #fff; }
.lia-x {
  position: absolute; top: 6px; right: 8px; background: transparent; border: none;
  color: rgba(255,255,255,.5); font-size: 1.2rem; cursor: pointer; line-height: 1; padding: 2px 4px;
}
.lia-x:hover { color: #fff; }
.lia-btns { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.lia-btn {
  background: rgba(255,255,255,.08); color: #eaf3e2; border: 1px solid rgba(255,255,255,.15);
  border-radius: 9px; padding: 7px 13px; font-size: .76rem; font-weight: 600;
  cursor: pointer; font-family: inherit;
}
.lia-btn-v { background: linear-gradient(135deg,#7DBA3D,#2E7D32); color: #0c1410; border: none; }

@media (max-width: 560px) {
  /* Mobile: coluna — balão em cima (largo), Lia embaixo à direita apontando pra cima. */
  .lia-root { left: 10px; right: 10px; bottom: 10px; flex-direction: column; align-items: stretch; gap: 0; }
  .lia-bolha { max-width: none; width: auto; align-self: stretch; font-size: .8rem; margin: 0; border-radius: 16px 16px 16px 4px; }
  .lia-bolha::after { right: 44px; left: auto; bottom: -9px; top: auto;
    border: 9px solid transparent; border-top-color: #12211a; border-bottom: 0; }
  .lia-img { width: 116px; align-self: flex-end; margin: -4px 4px 0 0; }
}
@media (prefers-reduced-motion: reduce) {
  .lia-img, .lia-root.lia-on .lia-img { animation: none; }
  .lia-root { transition: opacity .4s ease; transform: none; }
}
`;
