// Admin › Solicitações — hoje só Migração / Inativação de PDVs.
// (O tipo "Incidente / ocorrência" foi removido em v3.85.4 — ver ARMAZENAMENTO_FOTOS.md.)
import Migracoes from "./Migracoes";

export default function Solicitacoes() {
  return <Migracoes />;
}
