// Operações do CORA que contam como VOLUME (igual ao BI da Ambev): 1 = venda, 2 = bonificação
// (BONIF DES BALZ/COMBO). Troca (5), vasilhame (9), reposição (39), perda (101/108) etc. não.
// cora_dia gravado antes da coluna `op` (import anterior) não tem a operação → continua valendo.
const OPS_VOLUME = new Set(["1", "2"]);
const opVolume = (r) => {
  const op = String(r.op ?? "").trim().replace(/^0+/, "");
  return !op || OPS_VOLUME.has(op);
};

module.exports = { OPS_VOLUME, opVolume };
