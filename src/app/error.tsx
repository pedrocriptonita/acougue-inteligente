"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary global da aplicação. Captura erros de renderização e oferece
 * uma tela amigável + ação de tentar de novo, em vez de uma tela quebrada.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Em produção, plugar aqui um serviço de observabilidade (ex.: Sentry).
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Algo deu errado
        </h1>
        <p className="max-w-md text-muted-foreground">
          Tivemos um problema ao carregar esta página. Tente novamente.
        </p>
      </div>
      <Button onClick={reset}>Tentar de novo</Button>
    </main>
  );
}
