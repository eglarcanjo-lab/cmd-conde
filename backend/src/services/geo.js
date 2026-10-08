// Coordenadas coladas pelo RN → { lat, lng } + endereço (geocodificação reversa grátis).
// Aceita: "-7.0234, -37.2711" · "-7,0234 -37,2711" · link do Google Maps (…@lat,lng…,
// …!3dLAT!4dLNG…, ?q=lat,lng) · link curto de compartilhamento (maps.app.goo.gl / goo.gl),
// que é seguido no servidor até a URL completa.
// Endereço: OpenStreetMap Nominatim (gratuito, sem chave; política: ≤ 1 req/s e User-Agent
// identificado). Uso do app é baixo; cache em memória evita repetir a mesma consulta.
const axios = require("axios");

// Faixa do Brasil (pega coordenada trocada/errada: lat × lng invertidos, sinal faltando).
const NO_BRASIL = (lat, lng) => lat >= -34 && lat <= 6 && lng >= -74 && lng <= -32;
const UA = "HOP-Follow-up/1.0 (CMD Conde; uso interno de baixo volume)";

function extrair(texto) {
  const t = String(texto || "").trim();
  const pares = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,                                        // pino exato do place
    /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/,                                          // …/@lat,lng,17z
    /[?&](?:q|ll|query|destination|center)=(-?\d+\.\d+)\s*(?:,|%2C)\s*(-?\d+\.\d+)/i,
    /(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})/,                     // "-7.0234, -37.2711"
    /(-?\d{1,2},\d{3,})\s*[;\s]\s*(-?\d{1,3},\d{3,})/,                        // "-7,0234 -37,2711"
  ];
  for (const re of pares) {
    const m = t.match(re);
    if (m) return { lat: parseFloat(m[1].replace(",", ".")), lng: parseFloat(m[2].replace(",", ".")) };
  }
  return null;
}

// Link curto → segue os redirects (até 5) e devolve a URL final.
async function expandir(url) {
  let atual = url;
  for (let i = 0; i < 5; i++) {
    const r = await axios.get(atual, { maxRedirects: 0, validateStatus: () => true, timeout: 8000, headers: { "User-Agent": UA } });
    const loc = r.headers?.location;
    if (r.status >= 300 && r.status < 400 && loc) { atual = new URL(loc, atual).toString(); continue; }
    // Algumas páginas trazem a URL completa no HTML (meta/og:url) em vez de redirect
    const html = typeof r.data === "string" ? r.data : "";
    const m = html.match(/https:\/\/www\.google\.[^"'\s]+\/maps[^"'\s]+/);
    return m ? m[0].replace(/\\u0026/g, "&") : atual;
  }
  return atual;
}

async function resolverCoordenada(texto) {
  let t = String(texto || "").trim();
  if (!t) throw Object.assign(new Error("Cole a coordenada ou o link do Google Maps."), { http: 400 });
  let c = extrair(t);
  if (!c && /https?:\/\/(maps\.app\.goo\.gl|goo\.gl|g\.co)\//i.test(t)) {
    t = await expandir(t.match(/https?:\/\/\S+/)[0]).catch(() => t);
    c = extrair(decodeURIComponent(t));
  }
  if (!c || Number.isNaN(c.lat) || Number.isNaN(c.lng)) {
    throw Object.assign(new Error("Não reconheci a coordenada. Cole no formato -7.0234, -37.2711 ou o link do Google Maps."), { http: 400 });
  }
  if (!NO_BRASIL(c.lat, c.lng)) {
    throw Object.assign(new Error(`Coordenada fora do Brasil (${c.lat}, ${c.lng}) — confira se latitude e longitude não estão trocadas.`), { http: 400 });
  }
  return { lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6 };
}

const _cache = new Map();
let _ultima = 0;
async function enderecoDe(lat, lng) {
  const k = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (_cache.has(k)) return _cache.get(k);
  const espera = 1100 - (Date.now() - _ultima);           // ≤ 1 req/s (política do Nominatim)
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  _ultima = Date.now();
  try {
    const r = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: { format: "jsonv2", lat, lon: lng, "accept-language": "pt-BR", zoom: 18, addressdetails: 1 },
      headers: { "User-Agent": UA }, timeout: 8000,
    });
    const a = r.data?.address || {};
    const rua = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(", ");
    const partes = [rua, a.suburb || a.neighbourhood || a.quarter, a.city || a.town || a.village || a.municipality, a.state]
      .filter(Boolean);
    const end = partes.length ? partes.join(" · ") : (r.data?.display_name || "");
    if (_cache.size > 2000) _cache.clear();
    _cache.set(k, end);
    return end;
  } catch {
    return "";   // sem endereço não bloqueia — a coordenada e o link do mapa seguem valendo
  }
}

const linkMapa = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

module.exports = { resolverCoordenada, enderecoDe, linkMapa, extrair };
