import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import {
  construirEvento,
  extrairDadosAssinatura,
  stripe,
} from "@/server/services/stripe";

/**
 * Webhook do Stripe — fonte da verdade do estado das assinaturas.
 *
 * Autenticação: assinatura `stripe-signature` (não usa a chave interna). Lê o
 * corpo CRU (`request.text()`) — obrigatório para validar a assinatura.
 *
 * Eventos tratados:
 *  - checkout.session.completed        → vincula a subscription à loja
 *  - customer.subscription.updated     → atualiza plano/status/expiração
 *  - customer.subscription.deleted     → marca como cancelada (volta a TRIAL)
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ erro: "sem assinatura" }, { status: 400 });
  }

  const rawBody = await request.text();

  let evento: Stripe.Event;
  try {
    evento = construirEvento(rawBody, signature);
  } catch (e) {
    console.error("[stripe] assinatura inválida:", e);
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 400 });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const session = evento.data.object;
        const lojaId = session.metadata?.lojaId;
        if (lojaId && session.subscription) {
          const sub = await stripe().subscriptions.retrieve(
            session.subscription as string
          );
          await aplicarAssinatura(lojaId, sub);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = evento.data.object;
        const lojaId = await resolverLojaId(sub);
        if (lojaId) await aplicarAssinatura(lojaId, sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = evento.data.object;
        const lojaId = await resolverLojaId(sub);
        if (lojaId) {
          // Assinatura encerrada: volta a loja para TRIAL e zera o vínculo.
          await prisma.loja.update({
            where: { id: lojaId },
            data: {
              plano: "TRIAL",
              assinaturaStatus: sub.status,
              stripeSubscriptionId: null,
              assinaturaExpiraEm: null,
            },
          });
        }
        break;
      }

      default:
        // Demais eventos são ignorados (200 para o Stripe não reenviar).
        break;
    }
  } catch (e) {
    console.error(`[stripe] falha ao processar ${evento.type}:`, e);
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }

  return NextResponse.json({ recebido: true });
}

/** Persiste os dados da assinatura na loja. */
async function aplicarAssinatura(lojaId: string, sub: Stripe.Subscription) {
  const dados = extrairDadosAssinatura(sub);
  await prisma.loja.update({
    where: { id: lojaId },
    data: {
      stripeCustomerId: dados.customerId,
      stripeSubscriptionId: dados.subscriptionId,
      assinaturaStatus: dados.status,
      assinaturaExpiraEm: dados.expiraEm,
      // Só promove o plano quando a assinatura está vigente.
      ...(dados.plano && (dados.status === "active" || dados.status === "trialing")
        ? { plano: dados.plano }
        : {}),
    },
  });
}

/** Acha a loja a partir da subscription (metadata ou stripeCustomerId). */
async function resolverLojaId(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.lojaId) return sub.metadata.lojaId;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const loja = await prisma.loja.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return loja?.id ?? null;
}
