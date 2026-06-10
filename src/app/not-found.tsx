import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="space-y-2">
        <p className="font-display text-5xl font-light text-primary">404</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Página não encontrada
        </h1>
        <p className="max-w-md text-muted-foreground">
          O endereço que você tentou acessar não existe ou foi movido.
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants()}>
        Ir para o painel
      </Link>
    </main>
  );
}
