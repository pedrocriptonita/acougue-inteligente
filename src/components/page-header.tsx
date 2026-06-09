import type { ReactNode } from "react";

/** Cabeçalho padrão das páginas do painel: título, descrição e ações à direita. */
export function PageHeader({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        )}
      </div>
      {children}
    </div>
  );
}
