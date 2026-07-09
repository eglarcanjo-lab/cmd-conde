import * as XLSX from "xlsx-js-style";

function baixar(linhas, aba, prefixoArquivo) {
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba);
  XLSX.writeFile(wb, `${prefixoArquivo}_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// Só os dados tabulares — sem fotos (Excel não é o formato pra isso, ver exportarPDF).
export function exportarExcelRefrigeradores(itens) {
  const linhas = itens.map((r) => ({
    Item: r.item || "",
    Modelo: r.modelo || "",
    Serial: r.serial || "",
    "R.G.": r.rg || "",
    Categoria: r.categoria || "",
    Status: r.status || "",
    "Controle Interno": r.numero_controle_interno || "",
    PDV: r.nome_fantasia || "",
    "Cód. PDV": r.cod_pdv || "",
    "Data de Chegada": r.data_chegada || "",
  }));
  baixar(linhas, "Refrigeradores", "refrigeradores");
}

export function exportarExcelMaterialLeve(itens) {
  const linhas = itens.map((m) => ({
    Tipo: m.tipo || "",
    Quantidade: m.quantidade ?? "",
    PDV: m.nome_fantasia || "",
    "Cód. PDV": m.cod_pdv || "",
    Data: m.data_registro || "",
  }));
  baixar(linhas, "Material Leve", "material_leve");
}
