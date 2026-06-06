"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Botão de login com Google via Supabase Auth (OAuth).
 * Redireciona para a rota de callback, repassando o `redirectTo` (a rota que o
 * usuário tentava acessar) para retomar a navegação após o login.
 */
export function GoogleSignInButton({ redirectTo }: { redirectTo?: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrarComGoogle() {
    setCarregando(true);
    setErro(null);

    const supabase = createSupabaseBrowserClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (redirectTo) callbackUrl.searchParams.set("next", redirectTo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      setErro("Não foi possível iniciar o login. Tente novamente.");
      setCarregando(false);
    }
    // Em caso de sucesso, o navegador é redirecionado ao Google.
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={entrarComGoogle}
        disabled={carregando}
        variant="outline"
        size="lg"
        className="w-full"
      >
        <GoogleIcon />
        {carregando ? "Redirecionando…" : "Entrar com Google"}
      </Button>
      {erro && <p className="text-center text-sm text-destructive">{erro}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
