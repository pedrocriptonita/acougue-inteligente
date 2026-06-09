import { prisma } from "@/lib/prisma";

/**
 * Lista os clientes de uma loja com a contagem de pedidos (não removidos),
 * dos mais recentes para os mais antigos.
 */
export async function listarClientesDaLoja(lojaId: string, limite = 200) {
  return prisma.cliente.findMany({
    where: { lojaId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limite,
    include: {
      _count: { select: { pedidos: { where: { deletedAt: null } } } },
    },
  });
}
