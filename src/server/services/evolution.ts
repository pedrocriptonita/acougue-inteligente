import "server-only";

import { getRequiredEnv } from "@/lib/env";

import { fetchJson } from "./http";

/**
 * Cliente da Evolution API (WhatsApp não oficial, rodando na VPS).
 * Responsável por ENVIAR mensagens ao cliente (a recepção das mensagens é feita
 * via webhook → N8N na Fase 4).
 *
 * ⚠️ A Evolution API é não oficial: há risco de banimento do número. Tratada
 * como solução de validação/piloto (ver README).
 *
 * Referência de endpoints (Evolution API v2):
 *   POST {base}/message/sendText/{instance}   header: apikey
 */

/** Resolve a config da instância a cada chamada (evita ler env no import). */
function config() {
  return {
    baseUrl: getRequiredEnv("EVOLUTION_API_URL").replace(/\/$/, ""),
    apiKey: getRequiredEnv("EVOLUTION_API_KEY"),
    instance: getRequiredEnv("EVOLUTION_INSTANCE_NAME"),
  };
}

/**
 * Normaliza um telefone para o formato esperado pela Evolution: apenas dígitos,
 * com DDI. Assume Brasil (55) quando o número vem só com DDD + número.
 */
export function normalizarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.startsWith("55")) return digitos;
  // 10 (fixo) ou 11 (celular) dígitos → falta o DDI do Brasil.
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

type SendTextResponse = {
  key?: { id?: string };
  status?: string;
};

/**
 * Envia uma mensagem de texto para um número de WhatsApp.
 * Retorna o ID da mensagem (quando disponível) para rastreio/idempotência.
 */
export async function enviarTexto(
  telefone: string,
  texto: string
): Promise<{ mensagemId: string | null }> {
  const { baseUrl, apiKey, instance } = config();

  const data = await fetchJson<SendTextResponse>(
    `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`,
    {
      service: "Evolution",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: normalizarTelefone(telefone),
        text: texto,
      }),
    }
  );

  return { mensagemId: data.key?.id ?? null };
}

/** Mensagem padrão de "pedido pronto para retirada". */
export async function notificarPedidoPronto(
  telefone: string,
  numeroPedido: number
): Promise<{ mensagemId: string | null }> {
  return enviarTexto(
    telefone,
    `Seu pedido #${numeroPedido} está pronto para retirada! 🥩`
  );
}

type InstanceStateResponse = { instance?: { state?: string } };

/**
 * Consulta o estado de conexão da instância ("open" = conectada ao WhatsApp).
 * Útil para o health check (Fase 8) e para diagnóstico de configuração.
 */
export async function estadoConexao(): Promise<string> {
  const { baseUrl, apiKey, instance } = config();
  const data = await fetchJson<InstanceStateResponse>(
    `${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`,
    {
      service: "Evolution",
      method: "GET",
      headers: { apikey: apiKey },
      timeoutMs: 8_000,
    }
  );
  return data.instance?.state ?? "desconhecido";
}
