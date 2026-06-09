import { Prisma, StatusPedido } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Métricas da loja para a Visão Geral do painel.
 *
 * Faturamento = Σ (preco_unitario × quantidade) dos itens de pedidos
 * CONCLUÍDOS que tenham preço definido. Itens sem preço não entram na soma
 * (não há catálogo no MVP; preço é definido manualmente no card do pedido).
 */

export type Metricas = {
  faturamentoTotal: number;
  faturamentoHoje: number;
  ticketMedio: number;
  pedidosConcluidos: number;
  pedidosEmAberto: number;
  pedidosHoje: number;
  pedidosCancelados: number;
  totalClientes: number;
  topProdutos: { produto: string; quantidade: number }[];
};

/** Soma o faturamento de pedidos concluídos (opcionalmente desde uma data). */
async function faturamentoConcluido(lojaId: string, desde?: Date): Promise<number> {
  const filtroData = desde
    ? Prisma.sql`AND p.concluido_em >= ${desde}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ total: Prisma.Decimal | null }[]>`
    SELECT COALESCE(SUM(ip.preco_unitario * ip.quantidade), 0) AS total
    FROM itens_pedido ip
    JOIN pedidos p ON p.id = ip.pedido_id
    WHERE p.loja_id = ${lojaId}::uuid
      AND p.status = 'CONCLUIDO'
      AND p.deleted_at IS NULL
      AND ip.preco_unitario IS NOT NULL
      ${filtroData}
  `;
  return Number(rows[0]?.total ?? 0);
}

export async function obterMetricas(lojaId: string): Promise<Metricas> {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const [
    pedidosConcluidos,
    pedidosEmAberto,
    pedidosHoje,
    pedidosCancelados,
    totalClientes,
    faturamentoTotal,
    faturamentoHoje,
    top,
  ] = await Promise.all([
    prisma.pedido.count({
      where: { lojaId, deletedAt: null, status: StatusPedido.CONCLUIDO },
    }),
    prisma.pedido.count({
      where: {
        lojaId,
        deletedAt: null,
        status: { in: [StatusPedido.AGUARDANDO_PREPARO, StatusPedido.PRONTO] },
      },
    }),
    prisma.pedido.count({
      where: { lojaId, deletedAt: null, createdAt: { gte: inicioHoje } },
    }),
    prisma.pedido.count({
      where: { lojaId, deletedAt: null, status: StatusPedido.CANCELADO },
    }),
    prisma.cliente.count({ where: { lojaId, deletedAt: null } }),
    faturamentoConcluido(lojaId),
    faturamentoConcluido(lojaId, inicioHoje),
    prisma.itemPedido.groupBy({
      by: ["produto"],
      where: {
        pedido: { lojaId, deletedAt: null, status: { not: StatusPedido.CANCELADO } },
      },
      _sum: { quantidade: true },
      orderBy: { _sum: { quantidade: "desc" } },
      take: 5,
    }),
  ]);

  return {
    faturamentoTotal,
    faturamentoHoje,
    ticketMedio: pedidosConcluidos > 0 ? faturamentoTotal / pedidosConcluidos : 0,
    pedidosConcluidos,
    pedidosEmAberto,
    pedidosHoje,
    pedidosCancelados,
    totalClientes,
    topProdutos: top.map((t) => ({
      produto: t.produto,
      quantidade: Number(t._sum.quantidade ?? 0),
    })),
  };
}

export type VendaDia = { dia: string; total: number };

export type RelatorioPeriodo = {
  dias: number;
  faturamento: number;
  pedidosConcluidos: number;
  ticketMedio: number;
  vendasPorDia: VendaDia[];
};

// Fuso fixo do Brasil (sem horário de verão desde 2019) → SP 00:00 = 03:00 UTC.
const TZ = "America/Sao_Paulo";
const fmtDiaSP = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const DIA_MS = 86_400_000;

/**
 * Relatório dos últimos N dias (faturamento, pedidos concluídos e a série
 * diária para o gráfico). Considera apenas pedidos CONCLUÍDOS com preço.
 */
export async function obterRelatorioPeriodo(
  lojaId: string,
  dias: 7 | 30
): Promise<RelatorioPeriodo> {
  const agora = Date.now();

  // Chaves de dia (YYYY-MM-DD em SP), do mais antigo ao mais recente.
  const chaves: string[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    chaves.push(fmtDiaSP.format(new Date(agora - i * DIA_MS)));
  }
  // Meia-noite (SP) do dia mais antigo, como instante UTC (UTC-3).
  const desde = new Date(`${chaves[0]}T03:00:00.000Z`);

  const [faturamento, pedidosConcluidos, linhas] = await Promise.all([
    faturamentoConcluido(lojaId, desde),
    prisma.pedido.count({
      where: {
        lojaId,
        deletedAt: null,
        status: StatusPedido.CONCLUIDO,
        concluidoEm: { gte: desde },
      },
    }),
    prisma.$queryRaw<{ dia: string; total: Prisma.Decimal | null }[]>`
      SELECT to_char(
               date_trunc('day', p.concluido_em AT TIME ZONE 'America/Sao_Paulo'),
               'YYYY-MM-DD'
             ) AS dia,
             COALESCE(SUM(ip.preco_unitario * ip.quantidade), 0) AS total
      FROM pedidos p
      JOIN itens_pedido ip ON ip.pedido_id = p.id
      WHERE p.loja_id = ${lojaId}::uuid
        AND p.status = 'CONCLUIDO'
        AND p.deleted_at IS NULL
        AND ip.preco_unitario IS NOT NULL
        AND p.concluido_em >= ${desde}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  // Preenche todos os dias do intervalo (inclusive os sem venda = 0).
  const porDia = new Map(linhas.map((l) => [l.dia, Number(l.total ?? 0)]));
  const vendasPorDia: VendaDia[] = chaves.map((chave) => ({
    dia: chave,
    total: porDia.get(chave) ?? 0,
  }));

  return {
    dias,
    faturamento,
    pedidosConcluidos,
    ticketMedio: pedidosConcluidos > 0 ? faturamento / pedidosConcluidos : 0,
    vendasPorDia,
  };
}
