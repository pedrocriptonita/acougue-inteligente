import { requireUsuario } from "@/server/services/auth";

import { BotStatus } from "./_components/bot-status";
import { MobileNav } from "./_components/mobile-nav";
import { Sidebar } from "./_components/sidebar";

/**
 * Shell do painel protegido. Garante (server-side) um Usuario com Loja
 * vinculada — senão `requireUsuario` redireciona (/login ou /setup).
 *
 * Estrutura: sidebar fixa no desktop + navegação horizontal no mobile, com
 * topbar contendo o status do bot de WhatsApp.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usuario = await requireUsuario();
  const primeiroNome = usuario.nome.split(" ")[0];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        lojaNome={usuario.loja.nome}
        usuarioNome={usuario.nome}
        perfil={usuario.perfil}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          {/* marca mini (mobile) — no desktop a sidebar já mostra a loja */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="font-display text-sm font-semibold">A</span>
            </div>
            <span className="max-w-[40vw] truncate font-display text-sm font-semibold">
              {usuario.loja.nome}
            </span>
          </div>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3 sm:gap-4">
            <BotStatus />
            <span className="hidden text-sm text-muted-foreground sm:block">
              Olá, {primeiroNome}
            </span>
          </div>
        </header>

        <MobileNav />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
