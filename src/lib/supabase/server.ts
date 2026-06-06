import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase para uso server-side (Server Components, Server Actions,
 * Route Handlers). Lê e escreve a sessão via cookies do Next.js.
 *
 * Em Next.js 16, `cookies()` é assíncrono — por isso esta função é async.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` chamado de um Server Component — pode ser ignorado se
            // houver um middleware atualizando a sessão do usuário.
          }
        },
      },
    }
  );
}
