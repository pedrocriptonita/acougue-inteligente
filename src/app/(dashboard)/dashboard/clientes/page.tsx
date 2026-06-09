import { PageHeader } from "@/components/page-header";
import { requireUsuario } from "@/server/services/auth";
import { listarClientesDaLoja } from "@/server/services/cliente";

export const metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const usuario = await requireUsuario();
  const clientes = await listarClientesDaLoja(usuario.lojaId);

  return (
    <div>
      <PageHeader
        titulo="Clientes"
        descricao={
          clientes.length === 0
            ? "Os clientes aparecem aqui conforme fazem pedidos."
            : `${clientes.length} cliente(s) cadastrado(s)`
        }
      />

      {clientes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum cliente ainda.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                <th className="px-4 py-2.5 text-left font-medium">Telefone</th>
                <th className="px-4 py-2.5 text-right font-medium">Pedidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clientes.map((c) => (
                <tr key={c.id} className="bg-card hover:bg-secondary/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {c.nome}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {c.telefone}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {c._count.pedidos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
