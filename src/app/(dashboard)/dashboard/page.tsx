import { requireUsuario } from "@/server/services/auth";

export const metadata = { title: "Painel" };

export default async function DashboardPage() {
  const usuario = await requireUsuario();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Bem-vindo, {usuario.nome.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Sua loja está configurada. O painel de pedidos chega na Fase 5.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Loja</p>
          <p className="mt-1 font-medium">{usuario.loja.nome}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">WhatsApp</p>
          <p className="mt-1 font-medium">{usuario.loja.telefoneWhatsapp}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Plano</p>
          <p className="mt-1 font-medium capitalize">
            {usuario.loja.plano.toLowerCase()}
          </p>
        </div>
      </div>
    </div>
  );
}
