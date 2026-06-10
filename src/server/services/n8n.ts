import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env, getRequiredEnv } from "@/lib/env";

import { fetchJson } from "./http";

/**
 * Integração com o N8N (orquestrador na VPS).
 *
 * Dois sentidos de comunicação:
 *  1. App → N8N: dispara webhooks de eventos (ex.: pedido criado/pronto) para o
 *     N8N continuar o fluxo (notificar cliente, etc.).
 *  2. N8N → App: o N8N chama as rotas internas `/api/n8n/*` (Fase 4). Essas
 *     rotas se autenticam pela `INTERNAL_API_KEY` compartilhada — a verificação
 *     está em `verificarChaveInterna()`.
 *
 * O header usado em ambos os sentidos é `x-internal-api-key`.
 */

export const HEADER_CHAVE_INTERNA = "x-internal-api-key";

/** Eventos que o app emite para o N8N. */
export type EventoN8N =
  | "pedido.criado"
  | "pedido.pronto"
  | "pedido.cancelado"
  | "conversa.fallback_humano";

/**
 * Dispara um webhook para o N8N. Falhas são propagadas como `ExternalApiError`;
 * quem chama decide se o evento é crítico (aguardar) ou "fire and forget".
 */
export async function dispararWebhook(
  evento: EventoN8N,
  payload: Record<string, unknown>
): Promise<void> {
  const webhookUrl = getRequiredEnv("N8N_WEBHOOK_URL").replace(/\/$/, "");
  const apiKey = getRequiredEnv("INTERNAL_API_KEY");

  await fetchJson(`${webhookUrl}/${evento}`, {
    service: "N8N",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [HEADER_CHAVE_INTERNA]: apiKey,
    },
    body: JSON.stringify({ evento, ...payload }),
  });
}

/**
 * Compara duas chaves em tempo constante (evita timing attack).
 * Strings de tamanhos diferentes retornam false sem vazar o comprimento.
 */
function chavesIguais(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Valida o header de uma requisição recebida do N8N (rotas `/api/n8n/*`).
 * Retorna `true` somente se a `INTERNAL_API_KEY` estiver configurada e bater.
 *
 * Aceita o objeto `Headers` (Route Handlers do Next.js) ou um valor de header.
 */
export function verificarChaveInterna(
  headersOuValor: Headers | string | null
): boolean {
  const esperada = env.INTERNAL_API_KEY;
  if (!esperada) return false; // sem chave configurada → nega por padrão

  const recebida =
    typeof headersOuValor === "string" || headersOuValor === null
      ? headersOuValor
      : headersOuValor.get(HEADER_CHAVE_INTERNA);

  if (!recebida) return false;
  return chavesIguais(recebida, esperada);
}
