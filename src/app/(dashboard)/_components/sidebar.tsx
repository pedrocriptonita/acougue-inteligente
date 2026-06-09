"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOut } from "@/server/actions/auth";

import { linkAtivo, navLinks } from "./nav-config";

type SidebarProps = {
  lojaNome: string;
  usuarioNome: string;
  perfil: "ADMIN" | "FUNCIONARIO";
};

/** Sidebar fixa (desktop). A navegação mobile fica em `MobileNav`. */
export function Sidebar({ lojaNome, usuarioNome, perfil }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      {/* marca / loja */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="font-display text-base font-semibold">A</span>
        </div>
        <span className="truncate font-display text-sm font-semibold tracking-tight">
          {lojaNome}
        </span>
      </div>

      {/* navegação */}
      <nav className="flex-1 space-y-1 p-3">
        {navLinks.map((link) => {
          const ativo = linkAtivo(pathname, link);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                ativo
                  ? "bg-primary/15 text-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              {ativo && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon
                className={cn("size-4 shrink-0", ativo && "text-primary")}
              />
              <span className={cn(ativo && "text-foreground")}>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* usuário + sair */}
      <div className="border-t border-border p-3">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium">{usuarioNome}</p>
          <p className="text-xs text-muted-foreground">
            {perfil === "ADMIN" ? "Administrador" : "Funcionário"}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <LogOut className="size-4 shrink-0" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
