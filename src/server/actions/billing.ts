"use server";

import { redirect } from "next/navigation";
import { PlanoAssinatura } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/server/services/auth";
import {
  criarCheckoutSession,
  criarClienteStripe,
  criarPortalSession,
} from "@/server/services/stripe";

/**
 * Server Actions de billing. Apenas ADMIN inicia/gerencia a assinatura.
 * O webhook (`/api/stripe/webhook`) é quem grava o estado final — estas ações
 * só criam as sessões do Stripe e redirecionam o usuário.
 */

export type BillingState = { erro?: string };

/** Garante que a loja tem um Customer no Stripe; cria e persiste se faltar. */
async function garantirCustomer(loja: {
  id: string;
  nome: string;
  stripeCustomerId: string | null;
}): Promise<string> {
  if (loja.stripeCustomerId) return loja.stripeCustomerId;

  const usuario = await requireUsuario();
  const customerId = await criarClienteStripe({
    lojaId: loja.id,
    nome: loja.nome,
    email: usuario.email,
  });
  await prisma.loja.update({
    where: { id: loja.id },
    data: { stripeCustomerId: customerId },
  });
  return customerId;
}

/** Inicia o checkout de um plano (MENSAL/ANUAL) e redireciona ao Stripe. */
export async function iniciarCheckout(
  _prev: BillingState,
  formData: FormData
): Promise<BillingState> {
  const usuario = await requireUsuario();
  if (usuario.perfil !== "ADMIN") {
    return { erro: "Apenas administradores podem gerenciar a assinatura." };
  }

  const plano = formData.get("plano");
  if (plano !== PlanoAssinatura.MENSAL && plano !== PlanoAssinatura.ANUAL) {
    return { erro: "Plano inválido." };
  }

  let url: string;
  try {
    const customerId = await garantirCustomer(usuario.loja);
    url = await criarCheckoutSession({
      customerId,
      plano,
      lojaId: usuario.lojaId,
    });
  } catch (e) {
    console.error("[billing] falha ao iniciar checkout:", e);
    return { erro: "Não foi possível iniciar o checkout. Tente novamente." };
  }

  redirect(url);
}

/** Abre o portal do cliente Stripe (gerenciar/cancelar). */
export async function abrirPortal(
  _prev: BillingState,
  _formData: FormData
): Promise<BillingState> {
  const usuario = await requireUsuario();
  if (usuario.perfil !== "ADMIN") {
    return { erro: "Apenas administradores podem gerenciar a assinatura." };
  }
  if (!usuario.loja.stripeCustomerId) {
    return { erro: "Nenhuma assinatura encontrada para gerenciar." };
  }

  let url: string;
  try {
    url = await criarPortalSession(usuario.loja.stripeCustomerId);
  } catch (e) {
    console.error("[billing] falha ao abrir portal:", e);
    return { erro: "Não foi possível abrir o portal. Tente novamente." };
  }

  redirect(url);
}
