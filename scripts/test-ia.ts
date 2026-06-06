/**
 * Script de teste manual da interpretação da IA (Fase 3, serviço OpenAI).
 *
 * Roda alguns cenários reais de mensagens de açougue contra o `gpt-4o-mini` e
 * imprime o pedido estruturado que o modelo extraiu. NÃO faz parte do app —
 * é só uma ferramenta de validação local.
 *
 * Uso:
 *   npm run test:ia                 # roda os cenários de exemplo
 *   npm run test:ia "meio quilo de picanha pra hoje 18h"   # mensagem própria
 *
 * Requer OPENAI_API_KEY preenchida no .env.local.
 */
import path from "node:path";

import { config as loadEnv } from "dotenv";

// Carrega o .env.local ANTES de importar o serviço (que lê env no import).
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

// Import dinâmico para garantir que o env já foi carregado.
async function main() {
  const { interpretarPedido } = await import("../src/server/services/openai");

  const argv = process.argv.slice(2).join(" ").trim();
  const mensagens = argv
    ? [argv]
    : [
        "oi, queria meio quilo de picanha e 2 frangos inteiros",
        "bom dia! 1kg e meio de costela e 500g de linguiça, pego às 18h",
        "quero carne",
        "vou querer 3 bifes de alcatra, pode separar pra mim retirar quando ficar pronto",
        "quero falar com alguém por favor, deu problema no meu último pedido",
      ];

  console.log(`\n🥩 Testando interpretação da IA (${mensagens.length} cenário(s))\n`);

  for (const [i, msg] of mensagens.entries()) {
    console.log("─".repeat(60));
    console.log(`Cenário ${i + 1}`);
    console.log(`Cliente: "${msg}"`);
    const inicio = Date.now();
    try {
      const r = await interpretarPedido(msg);
      const ms = Date.now() - inicio;
      console.log(`\n  Itens (${r.itens.length}):`);
      for (const item of r.itens) {
        console.log(`    • ${item.quantidade} ${item.unidade} — ${item.produto}`);
      }
      console.log(`  Retirada: ${r.retirada ?? "(não informada)"}`);
      console.log(`  Pedido completo? ${r.pedidoCompleto ? "sim" : "não"}`);
      console.log(
        `  Atendimento humano? ${r.precisaAtendimentoHumano ? "SIM ⚠️" : "não"}`
      );
      console.log(`  Resposta sugerida ao cliente:\n    "${r.mensagemAoCliente}"`);
      console.log(`  (${ms}ms)\n`);
    } catch (e) {
      console.error(`  ❌ Erro: ${e instanceof Error ? e.message : String(e)}`);
      if (e && typeof e === "object" && "details" in e) {
        console.error("  detalhes:", (e as { details: unknown }).details);
      }
      console.log("");
    }
  }
  console.log("─".repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
