import Link from "next/link";
import {
  Ban,
  ClipboardList,
  Clock,
  DollarSign,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { requireUsuario } from "@/server/services/auth";
import { obterMetricas, obterRelatorioPeriodo } from "@/server/services/metricas";

export const metadata = { title: "Relatório" };
export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const brlCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function MetricCard({
  icon: Icon,
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {rotulo}
        </span>
        <Icon
          className={destaque ? "size-4 text-accent" : "size-4 text-muted-foreground"}
        />
      </div>
      <p
        className={cn(
          "mt-2 font-display text-2xl font-semibold",
          destaque ? "text-accent" : "text-foreground"
        )}
      >
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function rotuloDia(chave: string) {
  // "YYYY-MM-DD" → "dd/mm"
  const [, mes, dia] = chave.split("-");
  return `${dia}/${mes}`;
}

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const usuario = await requireUsuario();
  const { dias: diasParam } = await searchParams;
  const dias: 7 | 30 = diasParam === "7" ? 7 : 30;

  const [m, rel] = await Promise.all([
    obterMetricas(usuario.lojaId),
    obterRelatorioPeriodo(usuario.lojaId, dias),
  ]);

  const maxDia = Math.max(1, ...rel.vendasPorDia.map((v) => v.total));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Relatório"
        descricao={`Resumo financeiro de ${usuario.loja.nome}`}
      >
        {/* Toggle de período */}
        <div className="flex rounded-lg border border-border p-0.5">
          {([7, 30] as const).map((d) => (
            <Link
              key={d}
              href={`/dashboard/relatorio?dias=${d}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                dias === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d} dias
            </Link>
          ))}
        </div>
      </PageHeader>

      {/* Faturamento do período */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={DollarSign}
          rotulo={`Faturamento · ${dias} dias`}
          valor={brl.format(rel.faturamento)}
          detalhe={`${rel.pedidosConcluidos} pedido(s) concluído(s)`}
          destaque
        />
        <MetricCard
          icon={Receipt}
          rotulo={`Ticket médio · ${dias} dias`}
          valor={brl.format(rel.ticketMedio)}
        />
        <MetricCard
          icon={TrendingUp}
          rotulo="Faturamento hoje"
          valor={brl.format(m.faturamentoHoje)}
        />
      </div>

      {/* Gráfico de vendas por dia */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            Vendas por dia
          </h2>
          <span className="text-xs text-muted-foreground">
            últimos {dias} dias
          </span>
        </div>

        <div className="mt-5 flex h-40 items-end gap-1">
          {rel.vendasPorDia.map((v) => {
            const altura = v.total > 0 ? Math.max(4, (v.total / maxDia) * 100) : 1;
            return (
              <div
                key={v.dia}
                className="group flex-1"
                title={`${rotuloDia(v.dia)}: ${brl.format(v.total)}`}
              >
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-colors",
                    v.total > 0
                      ? "bg-primary/70 group-hover:bg-primary"
                      : "bg-secondary"
                  )}
                  style={{ height: `${altura}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{rotuloDia(rel.vendasPorDia[0]?.dia ?? "")}</span>
          <span>
            {rotuloDia(rel.vendasPorDia[rel.vendasPorDia.length - 1]?.dia ?? "")}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Pico no período: {brlCompacto.format(maxDia === 1 ? 0 : maxDia)}
        </p>
      </div>

      {/* Acumulado (desde sempre) + volume */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard
          icon={DollarSign}
          rotulo="Faturamento total"
          valor={brlCompacto.format(m.faturamentoTotal)}
          destaque
        />
        <MetricCard
          icon={ClipboardList}
          rotulo="Concluídos"
          valor={String(m.pedidosConcluidos)}
        />
        <MetricCard
          icon={Clock}
          rotulo="Em aberto"
          valor={String(m.pedidosEmAberto)}
        />
        <MetricCard
          icon={Ban}
          rotulo="Cancelados"
          valor={String(m.pedidosCancelados)}
        />
        <MetricCard
          icon={Users}
          rotulo="Clientes"
          valor={String(m.totalClientes)}
        />
      </div>

      {/* Top produtos */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">
          Produtos mais pedidos
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Por quantidade total (exclui cancelados)
        </p>

        {m.topProdutos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ainda não há pedidos para ranquear.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {m.topProdutos.map((p, i) => {
              const max = m.topProdutos[0]?.quantidade || 1;
              const pct = Math.max(6, Math.round((p.quantidade / max) * 100));
              return (
                <li key={p.produto} className="flex items-center gap-3">
                  <span className="w-4 text-sm font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="truncate text-sm text-foreground">
                        {p.produto}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {p.quantidade}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
