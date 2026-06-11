import {
  BarChart3,
  Beef,
  type LucideIcon,
  MessageSquare,
  Package,
  Settings,
  Users,
} from "lucide-react";

/** Itens de navegação do painel. Compartilhado por Sidebar e MobileNav. */
export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Se true, fica ativo só com match exato (evita o "/dashboard" pegar tudo). */
  exact?: boolean;
};

export const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Pedidos", icon: Package, exact: true },
  { href: "/dashboard/relatorio", label: "Relatório", icon: BarChart3 },
  { href: "/dashboard/produtos", label: "Produtos", icon: Beef },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/conversas", label: "Conversas", icon: MessageSquare },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
];

/** Um link está ativo se a rota casa exatamente ou começa com o href. */
export function linkAtivo(pathname: string, link: NavLink): boolean {
  return link.exact ? pathname === link.href : pathname.startsWith(link.href);
}
