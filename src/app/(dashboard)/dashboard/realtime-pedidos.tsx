"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Assina mudanças na tabela `pedidos` da loja via Supabase Realtime e, a cada
 * evento (insert/update/delete), revalida a rota — então um pedido criado pelo
 * WhatsApp aparece (e um removido some) no painel sem o usuário recarregar.
 *
 * Requisitos no Supabase (ver `prisma/sql/rls.sql`):
 *  - `pedidos` na publicação `supabase_realtime`;
 *  - `alter table pedidos replica identity full` (senão DELETE/UPDATE não casam o filtro);
 *  - RLS isola os eventos por loja — por isso autenticamos o socket com o JWT.
 *
 * Nome de canal único por montagem + flag `cancelado`: evita o erro de
 * "add postgres_changes after subscribe()" no double-mount do React Strict Mode.
 */
export function RealtimePedidos({ lojaId }: { lojaId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: RealtimeChannel | undefined;
    let cancelado = false;

    (async () => {
      // RLS exige o JWT do usuário no socket do Realtime.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelado) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelado) return;

      const nome = `pedidos:${lojaId}:${Math.random().toString(36).slice(2)}`;
      channel = supabase
        .channel(nome)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pedidos",
            filter: `loja_id=eq.${lojaId}`,
          },
          () => router.refresh()
        )
        .subscribe((status) => {
          if (process.env.NODE_ENV === "development") {
            // Ajuda a diagnosticar: deve logar "SUBSCRIBED".
            console.log("[realtime pedidos]", status);
          }
        });
    })();

    return () => {
      cancelado = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [lojaId, router]);

  return null;
}
