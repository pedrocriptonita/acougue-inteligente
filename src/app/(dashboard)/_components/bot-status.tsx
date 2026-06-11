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
    let timer: ReturnType<typeof setTimeout>;

    async function checar() {
      let online = false;
      try {
        // Timeout no fetch para não esperar 30s+ quando o servidor/rede trava.
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8_000);
        const res = await fetch("/api/bot/status", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const data = (await res.json()) as { online?: boolean };
        online = Boolean(data.online);
      } catch {
        online = false;
      }

      if (!ativo) return;
      setEstado(online ? "online" : "offline");
      // Backoff: quando online checa a cada 30s; offline espaça para 60s
      // (evita martelar o servidor durante uma queda de conexão).
      timer = setTimeout(checar, online ? 30_000 : 60_000);
    }

    checar();
    return () => {
      ativo = false;
      clearTimeout(timer);
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
