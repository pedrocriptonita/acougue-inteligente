import { PageHeader } from "@/components/page-header";
import { requireUsuario } from "@/server/services/auth";
import { listarPedidosDaLoja } from "@/server/services/pedido";

import { PedidoCard, type PedidoDTO } from "./pedido-card";
import { RealtimePedidos } from "./realtime-pedidos";
import { ReimprimirPendentes } from "./reimprimir-pendentes";

export const metadata = { title: "Pedidos" };

// Sempre renderiza com dados frescos (o painel é operacional, não cacheável).
export const dynamic = "force-dynamic";

const COLUNAS = [
  { status: "AGUARDANDO_PREPARO" as const, titulo: "Em preparo", cor: "#78d6d5" },
  { status: "PRONTO" as const, titulo: "Pronto p/ retirada", cor: "#40e56c" },
  { status: "CONCLUIDO" as const, titulo: "Concluídos", cor: "#b89a9a" },
];

export default async function DashboardPage() {
  const usuario = await requireUsuario();
  const pedidos = await listarPedidosDaLoja(usuario.lojaId);

  // Mapeia para um DTO serializável (Decimal → number, Date → ISO).
  const dtos: PedidoDTO[] = pedidos.map((p) => ({
    id: p.id,
    numero: p.numero,
    nomeCliente: p.nomeCliente,
    telefoneCliente: p.telefoneCliente,
    retirada: p.retirada,
    status: p.status,
    impresso: p.impresso,
    criadoEm: p.createdAt.toISOString(),
    itens: p.itens.map((i) => ({
      id: i.id,
      produto: i.produto,
      quantidade: Number(i.quantidade),
      unidade: i.unidade,
      precoUnitario: i.precoUnitario == null ? null : Number(i.precoUnitario),
    })),
  }));

  const porStatus = (status: PedidoDTO["status"]) =>
    dtos.filter((d) => d.status === status);

  const totalAtivos =
    porStatus("AGUARDANDO_PREPARO").length + porStatus("PRONTO").length;

  const pendentesImpressao = dtos.filter(
    (d) => !d.impresso && d.status !== "CANCELADO"
  ).length;

  return (
    <div className="space-y-6">
      <RealtimePedidos lojaId={usuario.lojaId} />

      <PageHeader
        titulo="Pedidos"
        descricao={
          totalAtivos === 0
            ? "Nenhum pedido em aberto."
            : `${totalAtivos} pedido(s) em aberto · atualiza em tempo real`
        }
      >
        <ReimprimirPendentes pendentes={pendentesImpressao} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUNAS.map((coluna) => {
          const lista = porStatus(coluna.status);
          return (
            <section key={coluna.status} className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: coluna.cor }}
                  />
                  <h2 className="text-sm font-semibold text-foreground">
                    {coluna.titulo}
                  </h2>
                </div>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {lista.length}
                </span>
              </div>

              {lista.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Vazio
                </p>
              ) : (
                lista.map((pedido) => (
                  <PedidoCard key={pedido.id} pedido={pedido} />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
