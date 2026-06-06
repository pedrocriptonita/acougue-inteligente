import { getRequiredEnv } from "@/lib/env";

import { ExternalApiError, fetchJson } from "./http";
import type { Unidade } from "./openai";

/**
 * Cliente do PrintNode: envia a comanda do pedido para a impressora térmica do
 * balcão. O PrintNode roda um agente local conectado à impressora; aqui só
 * disparamos o "print job" via API REST.
 *
 * Referência: https://www.printnode.com/en/docs/api/curl#printjob-creating
 *   POST https://api.printnode.com/printjobs   (Basic auth: apiKey como usuário)
 */

const PRINTNODE_URL = "https://api.printnode.com/printjobs";
const LARGURA = 42; // colunas típicas de impressora térmica 80mm

/** Dados mínimos para montar a comanda (desacoplado do Prisma). */
export type DadosComanda = {
  numero: number;
  nomeLoja: string;
  nomeCliente: string;
  telefoneCliente: string;
  retirada: string;
  itens: { produto: string; quantidade: number; unidade: Unidade }[];
  criadoEm?: Date;
};

function linha(char = "-") {
  return char.repeat(LARGURA);
}

function centralizar(texto: string) {
  if (texto.length >= LARGURA) return texto.slice(0, LARGURA);
  const espacos = Math.floor((LARGURA - texto.length) / 2);
  return " ".repeat(espacos) + texto;
}

function formatarQuantidade(qtd: number, unidade: Unidade) {
  const rotulo = unidade === "PECA" ? "un" : unidade.toLowerCase();
  // String(1.5) -> "1.5"; String(2) -> "2" (sem zeros à direita).
  return `${qtd} ${rotulo}`;
}

/** Monta o texto da comanda (uma string pronta para impressão térmica). */
export function formatarComanda(d: DadosComanda): string {
  const data = (d.criadoEm ?? new Date()).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

  const linhas: string[] = [
    centralizar(d.nomeLoja.toUpperCase()),
    linha("="),
    `PEDIDO #${d.numero}`,
    `Cliente: ${d.nomeCliente}`,
    `Fone: ${d.telefoneCliente}`,
    `Retirada: ${d.retirada}`,
    linha(),
  ];

  for (const item of d.itens) {
    const qtd = formatarQuantidade(item.quantidade, item.unidade);
    // produto à esquerda, quantidade à direita
    const espaco = Math.max(1, LARGURA - item.produto.length - qtd.length);
    linhas.push(
      item.produto.length + qtd.length + 1 > LARGURA
        ? `${item.produto}\n  ${qtd}`
        : `${item.produto}${" ".repeat(espaco)}${qtd}`
    );
  }

  linhas.push(linha(), `Emitido em ${data}`, "", "", "");
  return linhas.join("\n");
}

type PrintJobResponse = number; // PrintNode retorna o ID do job (número)

/**
 * Imprime a comanda de um pedido. Retorna o ID do print job do PrintNode.
 * Lança `ExternalApiError` em falha.
 */
export async function imprimirComanda(dados: DadosComanda): Promise<number> {
  const apiKey = getRequiredEnv("PRINTNODE_API_KEY");
  const printerId = Number(getRequiredEnv("PRINTNODE_PRINTER_ID"));
  if (!Number.isFinite(printerId)) {
    throw new ExternalApiError(
      "PrintNode",
      null,
      "PRINTNODE_PRINTER_ID inválido (esperado um número)."
    );
  }

  const conteudo = formatarComanda(dados);
  // Basic auth: apiKey no usuário, senha vazia.
  const auth = Buffer.from(`${apiKey}:`).toString("base64");

  const jobId = await fetchJson<PrintJobResponse>(PRINTNODE_URL, {
    service: "PrintNode",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      printerId,
      title: `Comanda #${dados.numero}`,
      // Texto puro como bytes brutos para a térmica (a maioria imprime ASCII).
      contentType: "raw_base64",
      content: Buffer.from(conteudo, "utf8").toString("base64"),
      source: "acougue-inteligente",
    }),
  });

  return jobId;
}
