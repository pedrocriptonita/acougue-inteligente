import { requireUsuario } from "@/server/services/auth";

import { signOut } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Layout do painel protegido. Garante (server-side) que há um Usuario com Loja
 * vinculada — caso contrário, `requireUsuario` redireciona (/login ou /setup).
 *
 * O painel em si (dashboard de pedidos, realtime) é construído na Fase 5;
 * aqui ficam o cabeçalho e o controle de sessão comuns.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usuario = await requireUsuario();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="font-display text-base font-semibold">A</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{usuario.loja.nome}</p>
              <p className="text-xs text-muted-foreground">
                {usuario.nome} · {usuario.perfil === "ADMIN" ? "Admin" : "Funcionário"}
              </p>
            </div>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
