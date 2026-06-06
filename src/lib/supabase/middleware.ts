import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Atualiza a sessão do Supabase a cada requisição e protege as rotas privadas.
 * Usado pelo `proxy.ts` (mecanismo de middleware do Next.js).
 *
 * Roda no edge runtime — usa apenas cookies (não o Prisma). A verificação de
 * vínculo com a Loja (tabela `usuarios`) acontece nos layouts server-side.
 *
 * Regras:
 *  - Rotas privadas (`/dashboard`, `/setup`) exigem um usuário autenticado;
 *    sem sessão → redireciona para `/login`.
 *  - Usuário já autenticado em `/login` → redireciona para `/dashboard`.
 */

const ROTAS_PRIVADAS = ["/dashboard", "/setup"];

export async function updateSession(request: NextRequest) {
  // Resposta base: precisamos repassar os cookies atualizados pelo Supabase.
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase ainda não configurado (ex.: `.env.local` em branco): não há sessão
  // a renovar nem rota a proteger. Deixa o site público funcionar normalmente.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: não execute código entre createServerClient e getUser().
  // getUser() revalida o token com o Supabase e renova a sessão nos cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const ehRotaPrivada = ROTAS_PRIVADAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  );

  if (!user && ehRotaPrivada) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Retorne SEMPRE o supabaseResponse para preservar os cookies de sessão.
  return supabaseResponse;
}
