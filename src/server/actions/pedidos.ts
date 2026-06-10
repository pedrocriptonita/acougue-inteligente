"use server";

import { revalidatePath } from "next/cache";
import { StatusPedido } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/server/services/auth";
import { notificarPedidoPronto } from "@/server/services/evolution";
import { imprimirComanda } from "@/server/services/printnode";
import {
  buscarPedidoDaLoja,
  definirPrecosItens,
  listarPendentesImpressao,
  marcarImpresso,
} from "@/server/services/pedido";
import type { Unidade } from "@/server/services/openai";

/**
 * Server Actions do painel de gestão. Todas exigem um usuário com loja
 * (`requireUsuario`) e operam SEMPRE escopadas ao `lojaId` desse usuário —
 * é a garantia de isolamento multi-tenant na camada de aplicação.
 */

export type AcaoResultado = { ok: true } | { ok: false; erro: string };

/** Transições de status permitidas no painel. */
const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  AGUARDANDO_PREPARO: [StatusPedido.PRONTO, StatusPedido.CANCELADO],
  PRONTO: [StatusPedido.CONCLUIDO, StatusPedido.CANCELADO],
  CONCLUIDO: [],
  CANCELADO: [],
};

export async function atualizarStatusPedido(
  pedidoId: string,
  novoStatus: StatusPedido
): Promise<AcaoResultado> {
  const usuario = await requireUsuario();

  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, lojaId: usuario.lojaId, deletedAt: null },
    select: {
      id: true,
      status: true,
      numero: true,
      telefoneCliente: true,
      prontoEm: true,
      concluidoEm: true,
    },
  });
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  if (!TRANSICOES[pedido.status].includes(novoStatus)) {
    return {
      ok: false,
      erro: `Transição inválida (${pedido.status} → ${novoStatus}).`,
    };
  }

  await prisma.pedido.update({
    where: { id: pedido.id },
    data: {
      status: novoStatus,
      // Marcos de tempo (só na primeira vez que entram no estado).
      ...(novoStatus === StatusPedido.PRONTO && !pedido.prontoEm
        ? { prontoEm: new Date() }
        : {}),
      ...(novoStatus === StatusPedido.CONCLUIDO && !pedido.concluidoEm
        ? { concluidoEm: new Date() }
        : {}),
    },
  });

  // Ao ficar PRONTO, avisa o cliente no WhatsApp (best effort).
  if (novoStatus === StatusPedido.PRONTO) {
    try {
      await notificarPedidoPronto(pedido.telefoneCliente, pedido.numero);
    } catch (e) {
      console.error(
        `[pedidos] falha ao notificar pedido #${pedido.numero} pronto:`,
        e
      );
    }
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Define os preços unitários (R$) dos itens de um pedido. */
export async function definirPrecosPedido(
  pedidoId: string,
  precos: { itemId: string; precoUnitario: number }[]
): Promise<AcaoResultado> {
  const usuario = await requireUsuario();

  const ok = await definirPrecosItens(pedidoId, usuario.lojaId, precos);
  if (!ok) return { ok: false, erro: "Pedido não encontrado." };

  revalidatePath("/dashboard");
  return { ok: true };
}

export type FlushResultado =
  | { ok: true; impressos: number; falhas: number }
  | { ok: false; erro: string };

/**
 * Reenvia para impressão TODOS os pedidos pendentes (impresso=false) da loja.
 * Útil para recuperar comandas cujo envio ao PrintNode falhou. Pode ser chamado
 * manualmente (botão) ou por um agendador (Vercel Cron) no futuro.
 */
export async function reimprimirPendentes(): Promise<FlushResultado> {
  const usuario = await requireUsuario();
  const pendentes = await listarPendentesImpressao(usuario.lojaId);

  let impressos = 0;
  let falhas = 0;

  for (const pedido of pendentes) {
    try {
      await imprimirComanda({
        numero: pedido.numero,
        nomeLoja: pedido.loja.nome,
        nomeCliente: pedido.nomeCliente,
        telefoneCliente: pedido.telefoneCliente,
        retirada: pedido.retirada,
        itens: pedido.itens.map((i) => ({
          produto: i.produto,
          quantidade: Number(i.quantidade),
          unidade: i.unidade as Unidade,
        })),
        criadoEm: pedido.createdAt,
      });
      await marcarImpresso(pedido.id);
      impressos++;
    } catch (e) {
      falhas++;
      console.error(`[pedidos] falha ao reimprimir pendente #${pedido.numero}:`, e);
    }
  }

  if (impressos > 0) revalidatePath("/dashboard");
  return { ok: true, impressos, falhas };
}

/** Reimprime a comanda de um pedido (ex.: impressão falhou na criação). */
export async function reimprimirComanda(
  pedidoId: string
): Promise<AcaoResultado> {
  const usuario = await requireUsuario();

  const pedido = await buscarPedidoDaLoja(pedidoId, usuario.lojaId);
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  try {
    await imprimirComanda({
      numero: pedido.numero,
      nomeLoja: pedido.loja.nome,
      nomeCliente: pedido.nomeCliente,
      telefoneCliente: pedido.telefoneCliente,
      retirada: pedido.retirada,
      itens: pedido.itens.map((i) => ({
        produto: i.produto,
        quantidade: Number(i.quantidade),
        unidade: i.unidade as Unidade,
      })),
      criadoEm: pedido.createdAt,
    });
    await marcarImpresso(pedido.id);
  } catch (e) {
    console.error(`[pedidos] falha ao reimprimir #${pedido.numero}:`, e);
    return { ok: false, erro: "Falha ao enviar para a impressora." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
