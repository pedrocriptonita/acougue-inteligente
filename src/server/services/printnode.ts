import "server-only";

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

/** Tipo de corte de papel ao final da comanda. */
export type TipoCorte = "parcial" | "total" | "nenhum";

/**
 * Comandos ESC/POS (padrão das térmicas). São bytes de controle invisíveis que
 * a impressora executa (negrito, tamanho, alinhamento, corte).
 *
 * ⚠️ O comando de CORTE varia um pouco por fabricante. `GS V 1` (parcial) e
 * `GS V 0` (total) cobrem a maioria; se a Elgin i9 não cortar, ajustar aqui
 * (ex.: `GS V B n`) conforme o manual dela.
 */
const ESC = "\x1B";
const GS = "\x1D";
const CMD = {
  init: `${ESC}@`, // reset
  alignLeft: `${ESC}a\x00`,
  alignCenter: `${ESC}a\x01`,
  boldOn: `${ESC}E\x01`,
  boldOff: `${ESC}E\x00`,
  sizeNormal: `${GS}!\x00`,
  sizeDoubleHeight: `${GS}!\x01`, // altura dupla
  sizeDouble: `${GS}!\x11`, // largura + altura dupla
  cutParcial: `${GS}V\x01`,
  cutTotal: `${GS}V\x00`,
} as const;

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

/** Linha de um item: produto à esquerda, quantidade à direita (quebra se largo). */
function linhaItem(item: DadosComanda["itens"][number]): string {
  const qtd = formatarQuantidade(item.quantidade, item.unidade);
  const espaco = Math.max(1, LARGURA - item.produto.length - qtd.length);
  return item.produto.length + qtd.length + 1 > LARGURA
    ? `${item.produto}\n  ${qtd}`
    : `${item.produto}${" ".repeat(espaco)}${qtd}`;
}

function dataComanda(d: DadosComanda): string {
  return (d.criadoEm ?? new Date()).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Texto PURO da comanda (sem comandos de controle). Usado para PRÉVIA/leitura
 * (ex.: `npm run test:impressao`). A impressão real usa `montarComandaEscPos`.
 */
export function formatarComanda(d: DadosComanda): string {
  const linhas: string[] = [
    centralizar(d.nomeLoja.toUpperCase()),
    linha("="),
    `PEDIDO #${d.numero}`,
    `Cliente: ${d.nomeCliente}`,
    `Fone: ${d.telefoneCliente}`,
    `Retirada: ${d.retirada}`,
    linha(),
    ...d.itens.map(linhaItem),
    linha(),
    `Emitido em ${dataComanda(d)}`,
    "",
    "",
    "",
  ];
  return linhas.join("\n");
}

/**
 * Comanda em ESC/POS (bytes de controle + texto): nome da loja grande e em
 * negrito, nº do pedido em destaque, "Retirada" em negrito, avanço de papel e
 * corte ao final. É o conteúdo enviado de fato à impressora.
 */
export function montarComandaEscPos(
  d: DadosComanda,
  corte: TipoCorte = "parcial"
): string {
  const p: string[] = [CMD.init];

  // Cabeçalho: nome da loja centralizado, grande e em negrito.
  p.push(CMD.alignCenter, CMD.sizeDouble, CMD.boldOn);
  p.push(`${d.nomeLoja.toUpperCase()}\n`);
  p.push(CMD.boldOff, CMD.sizeNormal, CMD.alignLeft);
  p.push(`${linha("=")}\n`);

  // Número do pedido em destaque (negrito + altura dupla).
  p.push(CMD.sizeDoubleHeight, CMD.boldOn, `PEDIDO #${d.numero}\n`, CMD.boldOff, CMD.sizeNormal);

  p.push(`Cliente: ${d.nomeCliente}\n`);
  p.push(`Fone: ${d.telefoneCliente}\n`);
  p.push(CMD.boldOn, `Retirada: ${d.retirada}\n`, CMD.boldOff);
  p.push(`${linha()}\n`);

  for (const item of d.itens) p.push(`${linhaItem(item)}\n`);

  p.push(`${linha()}\n`);
  p.push(`Emitido em ${dataComanda(d)}\n`);
  p.push("\n\n\n"); // avanço de papel antes do corte

  if (corte === "parcial") p.push(CMD.cutParcial);
  else if (corte === "total") p.push(CMD.cutTotal);

  return p.join("");
}

type PrintJobResponse = number; // PrintNode retorna o ID do job (número)

/**
 * Imprime a comanda de um pedido. Retorna o ID do print job do PrintNode.
 * Lança `ExternalApiError` em falha.
 *
 * Por padrão usa ESC/POS com corte PARCIAL (a comanda fica pendurada por um fio,
 * formando fila — o balcão puxa na ordem). Passe `corte: "total"` para separar
 * de vez ou `"nenhum"` para não cortar.
 */
export async function imprimirComanda(
  dados: DadosComanda,
  opcoes: { corte?: TipoCorte } = {}
): Promise<number> {
  const apiKey = getRequiredEnv("PRINTNODE_API_KEY");
  const printerId = Number(getRequiredEnv("PRINTNODE_PRINTER_ID"));
  if (!Number.isFinite(printerId)) {
    throw new ExternalApiError(
      "PrintNode",
      null,
      "PRINTNODE_PRINTER_ID inválido (esperado um número)."
    );
  }

  const conteudo = montarComandaEscPos(dados, opcoes.corte ?? "parcial");
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
      // ESC/POS (texto + bytes de controle) enviado como bytes brutos.
      contentType: "raw_base64",
      content: Buffer.from(conteudo, "utf8").toString("base64"),
      source: "acougue-inteligente",
    }),
  });

  return jobId;
}
