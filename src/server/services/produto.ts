import "server-only";

import { type Prisma, type UnidadeMedida } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Catálogo de produtos da loja. Alimenta (futuramente) o contexto da IA e o
 * preço estimado dos pedidos. Todas as operações são escopadas por `lojaId`.
 */

export type DadosProduto = {
  nome: string;
  preco: number;
  unidade: UnidadeMedida;
  sinonimos?: string[];
  ativo?: boolean;
};

/** Lista o catálogo da loja (ativos primeiro, depois por nome). */
export async function listarProdutosDaLoja(lojaId: string) {
  return prisma.produto.findMany({
    where: { lojaId },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
}

/** Apenas os produtos ativos — usado para alimentar a IA e o match de preço. */
export async function listarProdutosAtivos(lojaId: string) {
  return prisma.produto.findMany({
    where: { lojaId, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, preco: true, unidade: true, sinonimos: true },
  });
}

export async function criarProduto(lojaId: string, dados: DadosProduto) {
  return prisma.produto.create({
    data: {
      lojaId,
      nome: dados.nome,
      preco: dados.preco,
      unidade: dados.unidade,
      sinonimos: dados.sinonimos ?? [],
      ativo: dados.ativo ?? true,
    },
  });
}

/** Atualiza um produto, garantindo que ele pertence à loja. */
export async function atualizarProduto(
  produtoId: string,
  lojaId: string,
  dados: Partial<DadosProduto>
): Promise<boolean> {
  const data: Prisma.ProdutoUpdateManyMutationInput = {};
  if (dados.nome !== undefined) data.nome = dados.nome;
  if (dados.preco !== undefined) data.preco = dados.preco;
  if (dados.unidade !== undefined) data.unidade = dados.unidade;
  if (dados.sinonimos !== undefined) data.sinonimos = dados.sinonimos;
  if (dados.ativo !== undefined) data.ativo = dados.ativo;

  // updateMany com filtro de loja evita editar produto de outra loja.
  const r = await prisma.produto.updateMany({
    where: { id: produtoId, lojaId },
    data,
  });
  return r.count > 0;
}

/** Remove um produto do catálogo (escopado por loja). */
export async function removerProduto(
  produtoId: string,
  lojaId: string
): Promise<boolean> {
  const r = await prisma.produto.deleteMany({
    where: { id: produtoId, lojaId },
  });
  return r.count > 0;
}
