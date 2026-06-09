import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { enviarTexto, normalizarTelefone } from "@/server/services/evolution";
import { processarMensagem } from "@/server/services/conversa";
import { dispararWebhook, verificarChaveInterna } from "@/server/services/n8n";
import { ExternalApiError } from "@/server/services/http";

/**
 * Recebe uma mensagem de WhatsApp encaminhada pelo N8N (que por sua vez recebe
 * o webhook da Evolution API) e a processa: IA → coleta/confirmação → pedido →
 * comanda. O app é o "cérebro"; o N8N só repassa a mensagem para cá.
 *
 * Autenticação: header `x-internal-api-key` == INTERNAL_API_KEY.
 *
 * O app envia a resposta ao cliente diretamente via Evolution (não deixe o N8N
 * reenviar — o campo `resposta` no retorno é apenas para diagnóstico).
 */

// Prisma + serviços externos exigem runtime Node.js (não edge).
export const runtime = "nodejs";

const payloadSchema = z.object({
  /** WhatsApp da loja que recebeu a mensagem (resolve o tenant). */
  numeroLoja: z.string().min(1),
  /** Telefone do cliente que enviou. */
  telefoneCliente: z.string().min(1),
  /** Texto da mensagem. */
  texto: z.string().min(1),
  /** ID da mensagem no WhatsApp (idempotência). */
  mensagemId: z.string().min(1),
  /** Nome do cliente (pushName do WhatsApp), opcional. */
  nomeCliente: z.string().optional(),
});

export async function POST(request: Request) {
  if (!verificarChaveInterna(request.headers)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "payload inválido", detalhes: parsed.error.issues },
      { status: 400 }
    );
  }
  const { numeroLoja, telefoneCliente, texto, mensagemId, nomeCliente } =
    parsed.data;

  // Resolve a loja (tenant) pelo número de WhatsApp conectado.
  const loja = await prisma.loja.findFirst({
    where: {
      telefoneWhatsapp: normalizarTelefone(numeroLoja),
      ativo: true,
      deletedAt: null,
    },
    select: { id: true, nome: true },
  });
  if (!loja) {
    return NextResponse.json(
      { erro: "loja não encontrada para este número" },
      { status: 404 }
    );
  }

  let resultado;
  try {
    resultado = await processarMensagem({
      loja,
      telefone: telefoneCliente,
      texto,
      mensagemId,
      nomeCliente,
    });
  } catch (e) {
    // Falha na IA/banco: não derruba o webhook silenciosamente.
    const msg = e instanceof ExternalApiError ? e.message : "erro interno";
    console.error("[/api/n8n/mensagem] falha ao processar:", e);
    return NextResponse.json({ erro: msg }, { status: 502 });
  }

  // Envia a resposta ao cliente (best effort — não falha o webhook se a
  // Evolution estiver indisponível; o painel ainda reflete o estado).
  if (resultado.resposta && !resultado.duplicada) {
    try {
      await enviarTexto(telefoneCliente, resultado.resposta);
    } catch (e) {
      console.error("[/api/n8n/mensagem] falha ao enviar resposta:", e);
    }
  }

  // Notifica o N8N de eventos relevantes (automações downstream). Best effort.
  if (!resultado.duplicada) {
    if (resultado.pedidoCriado) {
      void dispararWebhook("pedido.criado", {
        lojaId: loja.id,
        pedidoId: resultado.pedidoCriado.id,
        numero: resultado.pedidoCriado.numero,
        impresso: resultado.pedidoCriado.impresso,
      }).catch(() => {});
    }
    if (resultado.encaminhadoHumano) {
      void dispararWebhook("conversa.fallback_humano", {
        lojaId: loja.id,
        telefone: telefoneCliente,
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    status: resultado.status,
    duplicada: resultado.duplicada,
    pedido: resultado.pedidoCriado ?? null,
    resposta: resultado.resposta, // apenas diagnóstico
  });
}
