import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Callback do OAuth (Google) via Supabase Auth.
 *
 * O Supabase redireciona para cá com um `code` na query string após o login.
 * Trocamos esse code por uma sessão (gravada nos cookies) e então decidimos o
 * destino:
 *   - usuário já vinculado a uma Loja → painel (`/dashboard`)
 *   - usuário novo (sem Loja)        → onboarding (`/setup`)
 *
 * Falhas (code ausente/ inválido) caem em `/auth/auth-code-error`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` permite voltar à rota que o usuário tentava acessar antes do login.
  const next = searchParams.get("next") ?? searchParams.get("redirectTo");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  // Decide o destino com base no provisionamento da aplicação.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destino = "/setup";
  if (user) {
    const usuario = await prisma.usuario.findFirst({
      where: { authUserId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (usuario) destino = next && next.startsWith("/") ? next : "/dashboard";
  }

  return NextResponse.redirect(`${origin}${destino}`);
}
