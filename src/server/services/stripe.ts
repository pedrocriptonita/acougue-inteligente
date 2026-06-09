import Stripe from "stripe";
import { PlanoAssinatura } from "@prisma/client";

import { env, getRequiredEnv } from "@/lib/env";

/**
 * Cliente e helpers do Stripe (assinaturas SaaS por loja).
 *
 * Modelo: cada Loja é um Customer no Stripe com uma Subscription. O webhook
 * (`/api/stripe/webhook`) é a fonte da verdade do estado da assinatura — o
 * checkout só inicia o fluxo; quem grava `plano`/`assinaturaStatus` é o webhook.
 */

let _stripe: Stripe | null = null;

/** Singleton lazy — só exige a chave quando o billing é de fato usado. */
export function stripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
  }
  return _stripe;
}

/** Planos pagos → price id do Stripe. */
export function planoParaPriceId(plano: PlanoAssinatura): string {
  switch (plano) {
    case PlanoAssinatura.MENSAL:
      return getRequiredEnv("STRIPE_PRICE_MENSAL");
    case PlanoAssinatura.ANUAL:
      return getRequiredEnv("STRIPE_PRICE_ANUAL");
    default:
      throw new Error(`Plano sem preço configurável: ${plano}`);
  }
}

/** price id do Stripe → plano (ou null se não reconhecido). */
export function planoDoPriceId(priceId: string | undefined): PlanoAssinatura | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_MENSAL) return PlanoAssinatura.MENSAL;
  if (priceId === env.STRIPE_PRICE_ANUAL) return PlanoAssinatura.ANUAL;
  return null;
}

/** Cria um Customer no Stripe para a loja. */
export async function criarClienteStripe(input: {
  lojaId: string;
  nome: string;
  email: string;
}): Promise<string> {
  const cliente = await stripe().customers.create({
    name: input.nome,
    email: input.email,
    metadata: { lojaId: input.lojaId },
  });
  return cliente.id;
}

/** Cria a sessão de checkout (assinatura) e devolve a URL de redirecionamento. */
export async function criarCheckoutSession(input: {
  customerId: string;
  plano: PlanoAssinatura;
  lojaId: string;
}): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId,
    line_items: [{ price: planoParaPriceId(input.plano), quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/configuracoes?checkout=sucesso`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/configuracoes?checkout=cancelado`,
    metadata: { lojaId: input.lojaId },
    subscription_data: { metadata: { lojaId: input.lojaId } },
  });
  if (!session.url) throw new Error("Stripe não retornou a URL do checkout.");
  return session.url;
}

/** Cria a sessão do portal do cliente (gerenciar/cancelar assinatura). */
export async function criarPortalSession(customerId: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/configuracoes`,
  });
  return session.url;
}

/** Verifica a assinatura do webhook e devolve o evento tipado. */
export function construirEvento(rawBody: string, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(
    rawBody,
    signature,
    getRequiredEnv("STRIPE_WEBHOOK_SECRET")
  );
}

export type DadosAssinatura = {
  customerId: string;
  subscriptionId: string;
  status: string;
  plano: PlanoAssinatura | null;
  expiraEm: Date | null;
};

/** Extrai os dados que persistimos na Loja a partir de uma Subscription. */
export function extrairDadosAssinatura(
  sub: Stripe.Subscription
): DadosAssinatura {
  const item = sub.items.data[0];
  // `current_period_end` migrou para o item nas versões recentes da API;
  // lê do item com fallback para o nível da subscription.
  const periodEnd =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;

  return {
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscriptionId: sub.id,
    status: sub.status,
    plano: planoDoPriceId(item?.price.id),
    expiraEm: periodEnd ? new Date(periodEnd * 1000) : null,
  };
}
