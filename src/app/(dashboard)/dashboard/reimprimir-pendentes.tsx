"use client";

import { useState, useTransition } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { reimprimirPendentes } from "@/server/actions/pedidos";

/**
 * Botão "Reimprimir pendentes": reenvia ao PrintNode todas as comandas com
 * impresso=false (ex.: recuperação após uma falha de envio). Mostra o resultado.
 */
export function ReimprimirPendentes({ pendentes }: { pendentes: number }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (pendentes === 0) return null;

  function executar() {
    setMsg(null);
    startTransition(async () => {
      const r = await reimprimirPendentes();
      if (!r.ok) setMsg(r.erro);
      else
        setMsg(
          `${r.impressos} reenviada(s)${r.falhas > 0 ? `, ${r.falhas} falha(s)` : ""}.`
        );
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={executar}>
        <Printer className="size-4" />
        {pending ? "Reenviando…" : `Reimprimir pendentes (${pendentes})`}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
