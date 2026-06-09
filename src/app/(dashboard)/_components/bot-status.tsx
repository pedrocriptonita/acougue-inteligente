"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Estado = "carregando" | "online" | "offline";

/**
 * Badge "WhatsApp Bot: Online/Offline" da topbar. Consulta `/api/bot/status`
 * ao montar e a cada 30s. Não bloqueia a renderização da página.
 */
export function BotStatus() {
  const [estado, setEstado] = useState<Estado>("carregando");

  useEffect(() => {
    let ativo = true;

    async function checar() {
      try {
        const res = await fetch("/api/bot/status", { cache: "no-store" });
        const data = (await res.json()) as { online?: boolean };
        if (ativo) setEstado(data.online ? "online" : "offline");
      } catch {
        if (ativo) setEstado("offline");
      }
    }

    checar();
    const id = setInterval(checar, 30_000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, []);

  const online = estado === "online";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5",
        online
          ? "border-accent/30 bg-accent/10"
          : "border-border bg-secondary/40"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          online ? "animate-pulse bg-accent" : "bg-muted-foreground"
        )}
      />
      <span
        className={cn(
          "text-xs font-medium tracking-wide",
          online ? "text-accent" : "text-muted-foreground"
        )}
      >
        {estado === "carregando"
          ? "Bot: verificando…"
          : online
            ? "WhatsApp Bot: Online"
            : "WhatsApp Bot: Offline"}
      </span>
    </div>
  );
}
