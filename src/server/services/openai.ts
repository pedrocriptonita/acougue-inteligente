import "server-only";

import { z } from "zod";

import { getRequiredEnv } from "@/lib/env";

import { ExternalApiError, fetchJson } from "./http";

/**
 * Serviço de IA: interpreta a mensagem em texto livre do cliente (WhatsApp) e
 * extrai um pedido estruturado, usando o modelo `gpt-4o-mini` da OpenAI com
 * Structured Outputs (a resposta é garantidamente um JSON no formato esperado).
 *
 * Esta camada NÃO mantém o estado da conversa nem grava no banco — apenas
 * transforma "texto + rascunho atual" em "rascunho atualizado + resposta
 * sugerida". A máquina de estados da conversa é montada na Fase 4.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODELO = "gpt-4o-mini";

/** Unidades de medida aceitas (espelha o enum `UnidadeMedida` do Prisma). */
export const UNIDADES = ["KG", "G", "PECA"] as const;
export type Unidade = (typeof UNIDADES)[number];

/** Item de carne extraído da mensagem. */
export const itemPedidoSchema = z.object({
  produto: z.string().min(1),
  quantidade: z.number().positive(),
  unidade: z.enum(UNIDADES),
});
export type ItemPedidoExtraido = z.infer<typeof itemPedidoSchema>;

/** Resultado da interpretação de uma mensagem. */
export const pedidoInterpretadoSchema = z.object({
  /** Itens identificados na conversa até agora. */
  itens: z.array(itemPedidoSchema),
  /** Horário de retirada ("18:00", "ao ficar pronto") ou null se ainda não dito. */
  retirada: z.string().nullable(),
  /** A IA entende que o pedido está completo e pronto para confirmação? */
  pedidoCompleto: z.boolean(),
  /**
   * True quando o cliente está confirmando um pedido já resumido (responde
   * "sim", "pode", "confirma" etc.). Só é relevante quando a conversa estava
   * aguardando confirmação. Veja `ContextoConversa.aguardandoConfirmacao`.
   */
  confirmouPedido: z.boolean(),
  /** Sinaliza que a conversa deve ir para um atendente humano (fallback). */
  precisaAtendimentoHumano: z.boolean(),
  /** Resposta sugerida ao cliente, em pt-BR. */
  mensagemAoCliente: z.string(),
});
export type PedidoInterpretado = z.infer<typeof pedidoInterpretadoSchema>;

/**
 * JSON Schema enviado à OpenAI (modo `strict`). Precisa casar com o Zod acima:
 * todos os campos são `required` e `additionalProperties: false`.
 */
const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          produto: { type: "string" },
          quantidade: { type: "number" },
          unidade: { type: "string", enum: UNIDADES },
        },
        required: ["produto", "quantidade", "unidade"],
      },
    },
    retirada: { type: ["string", "null"] },
    pedidoCompleto: { type: "boolean" },
    confirmouPedido: { type: "boolean" },
    precisaAtendimentoHumano: { type: "boolean" },
    mensagemAoCliente: { type: "string" },
  },
  required: [
    "itens",
    "retirada",
    "pedidoCompleto",
    "confirmouPedido",
    "precisaAtendimentoHumano",
    "mensagemAoCliente",
  ],
} as const;

const SYSTEM_PROMPT = `Você é o atendente virtual de um açougue no WhatsApp. Sua função é entender pedidos de carne escritos em linguagem natural (português do Brasil) e transformá-los em dados estruturados.

Regras:
- Extraia cada item com produto, quantidade e unidade. Unidades válidas: KG (quilos), G (gramas), PECA (peças/unidades inteiras, ex.: "2 frangos", "uma picanha inteira").
- Converta expressões comuns: "meio quilo" = 0.5 KG; "1 quilo e meio" = 1.5 KG; "500 gramas" = 500 G; "duas bandejas" trate como PECA.
- "retirada": horário que o cliente quer retirar (ex.: "18:00") ou a string "ao ficar pronto" se ele não definir hora. Use null se ainda não houver informação.
- "pedidoCompleto": true somente quando houver ao menos 1 item E uma definição de retirada, e o cliente não estiver pedindo mais coisas.
- "confirmouPedido": true APENAS quando o sistema indicar que está aguardando confirmação E a mensagem do cliente for uma confirmação afirmativa (ex.: "sim", "pode", "confirma", "isso mesmo", "fechado"). Caso contrário, false. Se o cliente pedir alteração em vez de confirmar, atualize os itens e mantenha false.
- "precisaAtendimentoHumano": true se o cliente pedir para falar com uma pessoa, reclamar, ou se a mensagem for incompreensível/fora do escopo de pedidos.
- "mensagemAoCliente": resposta curta, cordial e objetiva em pt-BR. Se faltar algo (itens ou horário), pergunte. Se o pedido estiver completo, resuma os itens e o horário e peça a confirmação ("Posso confirmar?").
- NUNCA invente itens ou quantidades que o cliente não disse. Na dúvida sobre a quantidade, pergunte.`;

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
};

/** Mensagem anterior da conversa, para dar contexto ao modelo. */
export type ContextoConversa = {
  rascunhoAtual?: PedidoInterpretado | null;
  /** A conversa está aguardando o cliente confirmar um pedido já resumido? */
  aguardandoConfirmacao?: boolean;
  /** Histórico opcional (ex.: últimas trocas), do mais antigo ao mais recente. */
  historico?: { autor: "cliente" | "loja"; texto: string }[];
};

/**
 * Interpreta uma mensagem do cliente, opcionalmente considerando o rascunho e o
 * histórico da conversa. Lança `ExternalApiError` em falha de API/rede.
 */
export async function interpretarPedido(
  mensagem: string,
  contexto: ContextoConversa = {}
): Promise<PedidoInterpretado> {
  const apiKey = getRequiredEnv("OPENAI_API_KEY");

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (contexto.rascunhoAtual) {
    messages.push({
      role: "system",
      content: `Rascunho do pedido até agora (JSON): ${JSON.stringify(
        contexto.rascunhoAtual
      )}. Atualize-o com a nova mensagem do cliente, sem descartar o que já estava correto.`,
    });
  }

  if (contexto.aguardandoConfirmacao) {
    messages.push({
      role: "system",
      content:
        "A conversa está AGUARDANDO CONFIRMAÇÃO: o pedido acima já foi resumido ao cliente. Avalie se esta mensagem é uma confirmação afirmativa e preencha 'confirmouPedido' conforme as regras.",
    });
  }

  for (const turno of contexto.historico ?? []) {
    messages.push({
      role: turno.autor === "cliente" ? "user" : "assistant",
      content: turno.texto,
    });
  }

  messages.push({ role: "user", content: mensagem });

  const data = await fetchJson<ChatCompletionResponse>(OPENAI_URL, {
    service: "OpenAI",
    method: "POST",
    timeoutMs: 30_000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELO,
      temperature: 0.2,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "pedido_interpretado",
          strict: true,
          schema: responseJsonSchema,
        },
      },
    }),
  });

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new ExternalApiError("OpenAI", null, "Resposta vazia do modelo.", data);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ExternalApiError(
      "OpenAI",
      null,
      "O modelo não retornou um JSON válido.",
      content
    );
  }

  const result = pedidoInterpretadoSchema.safeParse(parsed);
  if (!result.success) {
    throw new ExternalApiError(
      "OpenAI",
      null,
      "JSON do modelo fora do schema esperado.",
      result.error.issues
    );
  }

  return result.data;
}
