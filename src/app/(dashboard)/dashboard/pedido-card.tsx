"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  atualizarStatusPedido,
  definirPrecosPedido,
  reimprimirComanda,
} from "@/server/actions/pedidos";

export type StatusPedido =
  | "AGUARDANDO_PREPARO"
  | "PRONTO"
  | "CONCLUIDO"
  | "CANCELADO";

export type PedidoItemDTO = {
  id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number | null;
};

export type PedidoDTO = {
  id: string;
  numero: number;
  nomeCliente: string;
  telefoneCliente: string;
  retirada: string;
  status: StatusPedido;
  impresso: boolean;
  criadoEm: string;
  itens: PedidoItemDTO[];
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function unidadeLabel(u: string) {
  return u === "PECA" ? "un" : u.toLowerCase();
}

function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calcularTotal(itens: PedidoItemDTO[]): number | null {
  if (itens.some((i) => i.precoUnitario == null)) return null;
  return itens.reduce((s, i) => s + (i.precoUnitario ?? 0) * i.quantidade, 0);
}

export function PedidoCard({ pedido }: { pedido: PedidoDTO }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editandoPreco, setEditandoPreco] = useState(false);
  const [precos, setPrecos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pedido.itens.map((i) => [i.id, i.precoUnitario?.toString() ?? ""])
    )
  );

  const total = calcularTotal(pedido.itens);

  function executar(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Falha na operação.");
    });
  }

  function salvarPrecos() {
    const lista = pedido.itens.map((i) => ({
      itemId: i.id,
      precoUnitario: Number(precos[i.id]?.replace(",", ".") || 0),
    }));
    setErro(null);
    startTransition(async () => {
      const r = await definirPrecosPedido(pedido.id, lista);
      if (!r.ok) setErro(r.erro ?? "Falha ao salvar preços.");
      else setEditandoPreco(false);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            #{pedido.numero}
          </span>
          <h4 className="mt-0.5 font-display text-lg font-semibold leading-tight">
            {pedido.nomeCliente}
          </h4>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">
            {horaCurta(pedido.criadoEm)}
          </span>
          {!pedido.impresso && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
              não impresso
            </span>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {pedido.itens.map((item) => (
          <li key={item.id} className="flex justify-between gap-2">
            <span className="text-foreground/90">{item.produto}</span>
            <span className="shrink-0 text-muted-foreground">
              {item.quantidade} {unidadeLabel(item.unidade)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        Retirada: <span className="text-foreground">{pedido.retirada}</span>
      </p>

      {/* Editor de preços */}
      {editandoPreco && (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/50 p-3">
          {pedido.itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">
                {item.produto} ({unidadeLabel(item.unidade)})
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={precos[item.id] ?? ""}
                  onChange={(e) =>
                    setPrecos((p) => ({ ...p, [item.id]: e.target.value }))
                  }
                  className="h-8 w-20 rounded-md border border-input bg-card px-2 text-right text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setEditandoPreco(false)}
            >
              Cancelar
            </Button>
            <Button size="sm" disabled={pending} onClick={salvarPrecos}>
              Salvar preços
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        {total != null ? (
          <span className="font-display text-base font-semibold text-primary">
            {brl.format(total)}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditandoPreco((v) => !v)}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Definir preços
          </button>
        )}
        {total != null && !editandoPreco && (
          <button
            type="button"
            onClick={() => setEditandoPreco(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            editar
          </button>
        )}
      </div>

      {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {pedido.status === "AGUARDANDO_PREPARO" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => executar(() => atualizarStatusPedido(pedido.id, "PRONTO"))}
          >
            Marcar pronto
          </Button>
        )}
        {pedido.status === "PRONTO" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              executar(() => atualizarStatusPedido(pedido.id, "CONCLUIDO"))
            }
          >
            Concluir
          </Button>
        )}

        {(pedido.status === "AGUARDANDO_PREPARO" ||
          pedido.status === "PRONTO") && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              executar(() => atualizarStatusPedido(pedido.id, "CANCELADO"))
            }
          >
            Cancelar
          </Button>
        )}

        {pedido.status !== "CANCELADO" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => executar(() => reimprimirComanda(pedido.id))}
          >
            {pedido.impresso ? "Reimprimir" : "Imprimir"}
          </Button>
        )}
      </div>
    </div>
  );
}
