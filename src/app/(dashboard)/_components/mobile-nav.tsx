"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { linkAtivo, navLinks } from "./nav-config";

/**
 * Navegação para telas pequenas: barra horizontal rolável sob o cabeçalho.
 * (No desktop, a `Sidebar` assume.)
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
      {navLinks.map((link) => {
        const ativo = linkAtivo(pathname, link);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              ativo
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60"
            )}
          >
            <Icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
