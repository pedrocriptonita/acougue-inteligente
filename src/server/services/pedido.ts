import { type Pedido, type Prisma, StatusPedido } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { ItemPedidoExtraido } from "./openai";

/**
 * Criação de pedidos. Concentra duas regras delicadas:
 *  1. Número sequencial POR LOJA (#1, #2, ...) gerado de forma atômica.
 *  2. Snapshot dos dados do cliente no pedido + vínculo opcional ao cadastro.
 */

export type NovoPedido = {
  lojaId: string;
  nomeCliente: string;
  telefoneCliente: string;
  /** Horário de retirada ("18:00" ou "ao ficar pronto"). */
  retirada: string;
  itens: ItemPedidoExtraido[];
};

export type PedidoComItens = Pedido & {
  itens: {
    id: string;
    produto: string;
    quantidade: Prisma.Decimal;
    unidade: string;
  }[];
};

/**
 * Cria um pedido completo (cliente + número sequencial + itens) numa transação.
 *
 * O número é serializado por loja com um advisory lock transacional do Postgres
 * (`pg_advisory_xact_lock`): duas mensagens simultâneas da mesma loja não geram
 * o mesmo número nem disputam o índice único `(loja_id, numero)`. O lock é
 * liberado automaticamente no fim da transação.
 */
export async function criarPedido(input: NovoPedido): Promise<PedidoComItens> {
  return prisma.$transaction(async (tx) => {
    // Serializa a geração de número apenas entre pedidos DA MESMA loja.
    // hashtext(loja_id) -> int4 ; o segundo argumento (0) é o "namespace" do lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.lojaId}), 0)`;

    const agregado = await tx.pedido.aggregate({
      where: { lojaId: input.lojaId },
      _max: { numero: true },
    });
    const numero = (agregado._max.numero ?? 0) + 1;

    // Reconhece/cria o cliente recorrente (telefone único por loja).
    const cliente = await tx.cliente.upsert({
      where: {
        lojaId_telefone: {
          lojaId: input.lojaId,
          telefone: input.telefoneCliente,
        },
      },
      create: {
        lojaId: input.lojaId,
        nome: input.nomeCliente,
        telefone: input.telefoneCliente,
      },
      update: { nome: input.nomeCliente, deletedAt: null },
      select: { id: true },
    });

    const pedido = await tx.pedido.create({
      data: {
        lojaId: input.lojaId,
        clienteId: cliente.id,
        numero,
        nomeCliente: input.nomeCliente,
        telefoneCliente: input.telefoneCliente,
        retirada: input.retirada,
        itens: {
          create: input.itens.map((item) => ({
            produto: item.produto,
            quantidade: item.quantidade,
            unidade: item.unidade,
          })),
        },
      },
      include: {
        itens: {
          select: { id: true, produto: true, quantidade: true, unidade: true },
        },
      },
    });

    return pedido;
  });
}

/**
 * Marca o pedido como impresso (chamado após o PrintNode confirmar o job).
 * O painel é a fonte da verdade do status de impressão.
 */
export async function marcarImpresso(pedidoId: string): Promise<void> {
  await prisma.pedido.update({
    where: { id: pedidoId },
    data: { impresso: true, impressoEm: new Date() },
  });
}

/**
 * Lista os pedidos de uma loja para o painel (mais recentes primeiro).
 * Exclui os removidos (soft delete). Os concluídos/cancelados são incluídos —
 * o painel decide como agrupá-los.
 */
export async function listarPedidosDaLoja(lojaId: string, limite = 200) {
  return prisma.pedido.findMany({
    where: { lojaId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limite,
    include: {
      itens: {
        select: {
          id: true,
          produto: true,
          quantidade: true,
          unidade: true,
          precoUnitario: true,
        },
      },
    },
  });
}

/**
 * Define os preços unitários dos itens de um pedido (escopado por loja).
 * Retorna false se o pedido não pertencer à loja.
 */
export async function definirPrecosItens(
  pedidoId: string,
  lojaId: string,
  precos: { itemId: string; precoUnitario: number }[]
): Promise<boolean> {
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, lojaId, deletedAt: null },
    select: { itens: { select: { id: true } } },
  });
  if (!pedido) return false;

  const idsValidos = new Set(pedido.itens.map((i) => i.id));

  await prisma.$transaction(
    precos
      .filter((p) => idsValidos.has(p.itemId) && p.precoUnitario >= 0)
      .map((p) =>
        prisma.itemPedido.update({
          where: { id: p.itemId },
          data: { precoUnitario: p.precoUnitario },
        })
      )
  );
  return true;
}

/**
 * Lista os pedidos da loja que ainda NÃO foram impressos (fila de impressão),
 * com os dados necessários para gerar a comanda. Exclui cancelados/removidos.
 */
export async function listarPendentesImpressao(lojaId: string) {
  return prisma.pedido.findMany({
    where: {
      lojaId,
      deletedAt: null,
      impresso: false,
      status: { not: StatusPedido.CANCELADO },
    },
    orderBy: { createdAt: "asc" },
    include: {
      itens: { select: { produto: true, quantidade: true, unidade: true } },
      loja: { select: { nome: true } },
    },
  });
}

/**
 * Busca um pedido (escopado por loja) com os dados necessários para reimprimir
 * a comanda. Retorna `null` se não existir ou não pertencer à loja.
 */
export async function buscarPedidoDaLoja(pedidoId: string, lojaId: string) {
  return prisma.pedido.findFirst({
    where: { id: pedidoId, lojaId, deletedAt: null },
    include: {
      itens: { select: { produto: true, quantidade: true, unidade: true } },
      loja: { select: { nome: true } },
    },
  });
}
