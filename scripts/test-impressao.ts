/**
 * Teste manual da impressão de comanda (Fase 3, serviço PrintNode).
 *
 * 1. SEMPRE imprime no terminal a PRÉVIA da comanda formatada (`formatarComanda`)
 *    — útil pra conferir o layout mesmo sem impressora/chave.
 * 2. Se `PRINTNODE_API_KEY` e `PRINTNODE_PRINTER_ID` estiverem configurados,
 *    envia o job de verdade pro PrintNode e mostra o jobId retornado.
 *
 * Uso:
 *   npm run test:impressao
 *
 * Requer (para imprimir de fato): agente PrintNode rodando no PC da impressora,
 * PRINTNODE_API_KEY e PRINTNODE_PRINTER_ID preenchidos no .env.local.
 */
import path from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

type Unidade = "KG" | "G" | "PECA";

const comandaExemplo = {
  numero: 142,
  nomeLoja: "Açougue do Zé",
  nomeCliente: "Carlos Silva",
  telefoneCliente: "5511988887777",
  retirada: "18:00",
  itens: [
    { produto: "Picanha", quantidade: 1.5, unidade: "KG" as Unidade },
    { produto: "Linguiça artesanal", quantidade: 2, unidade: "KG" as Unidade },
    { produto: "Frango inteiro", quantidade: 2, unidade: "PECA" as Unidade },
  ],
  criadoEm: new Date(),
};

function configurado(valor: string | undefined, placeholder: string): boolean {
  return Boolean(valor && valor !== placeholder);
}

async function main() {
  const { formatarComanda, imprimirComanda } = await import(
    "../src/server/services/printnode"
  );

  // 1. Prévia (sempre) — layout em texto puro.
  const texto = formatarComanda(comandaExemplo);
  console.log("\n📄 Prévia da comanda (layout em texto puro):\n");
  console.log("┌" + "─".repeat(44) + "┐");
  for (const linha of texto.split("\n")) {
    console.log("│ " + linha.padEnd(42) + " │");
  }
  console.log("└" + "─".repeat(44) + "┘");
  console.log(
    "ℹ️  Na impressão real (ESC/POS): nome da loja grande+negrito, " +
      "nº do pedido em destaque, 'Retirada' em negrito e CORTE PARCIAL no fim.\n"
  );

  // 2. Impressão real (se configurado)
  const temChave = configurado(process.env.PRINTNODE_API_KEY, "sua-chave-printnode");
  const temPrinter = configurado(process.env.PRINTNODE_PRINTER_ID, "123456");

  if (!temChave || !temPrinter) {
    console.log(
      "⚠️  PrintNode não configurado (PRINTNODE_API_KEY / PRINTNODE_PRINTER_ID).\n" +
        "    Só a prévia acima foi gerada. Preencha o .env.local para imprimir de verdade.\n"
    );
    return;
  }

  console.log("🖨️  Enviando job para o PrintNode...");
  try {
    const jobId = await imprimirComanda(comandaExemplo);
    console.log(
      `✅ Job enviado! id=${jobId}. A comanda deve sair na impressora do balcão.\n`
    );
  } catch (e) {
    console.error(`❌ Falha ao imprimir: ${e instanceof Error ? e.message : e}`);
    if (e && typeof e === "object" && "details" in e) {
      console.error("   detalhes:", (e as { details: unknown }).details);
    }
    console.log("");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
