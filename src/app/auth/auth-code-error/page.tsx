import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Erro de autenticação" };

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Não foi possível entrar
        </h1>
        <p className="max-w-md text-muted-foreground">
          O link de autenticação expirou ou já foi usado. Tente entrar
          novamente.
        </p>
      </div>
      <Link href="/login" className={buttonVariants()}>
        Voltar ao login
      </Link>
    </div>
  );
}
