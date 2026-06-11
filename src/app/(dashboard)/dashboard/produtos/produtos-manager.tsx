"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  alternarAtivoProduto,
  excluirProduto,
  salvarProduto,
  type ProdutoResultado,
} from "@/server/actions/produtos";

export type ProdutoDTO = {
  id: string;
  nome: string;
  preco: number;
  unidade: string;
  sinonimos: string[];
  ativo: boolean;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function unidadeLabel(u: string) {
  return u === "PECA" ? "peça" : u === "G" ? "grama" : "kg";
}

export function ProdutosManager({
  produtos,
  ehAdmin,
}: {
  produtos: ProdutoDTO[];
  ehAdmin: boolean;
}) {
  const [editando, setEditando] = useState<ProdutoDTO | null>(null);

  return (
    <div className="space-y-6">
      {ehAdmin && (
        <ProdutoForm
          // remonta o form ao alternar entre novo/editar (reseta os defaults)
          key={editando?.id ?? "novo"}
          produto={editando}
          onConcluido={() => setEditando(null)}
          onCancelar={() => setEditando(null)}
        />
      )}

      {produtos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum produto cadastrado ainda.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Produto</th>
                <th className="px-4 py-2.5 text-right font-medium">Preço</th>
                <th className="px-4 py-2.5 text-left font-medium">Unidade</th>
                {ehAdmin && <th className="px-4 py-2.5 text-right font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {produtos.map((p) => (
                <ProdutoRow
                  key={p.id}
                  produto={p}
                  ehAdmin={ehAdmin}
                  onEditar={() => setEditando(p)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProdutoForm({
  produto,
  onConcluido,
  onCancelar,
}: {
  produto: ProdutoDTO | null;
  onConcluido: () => void;
  onCancelar: () => void;
}) {
  const [state, action, pending] = useActionState<ProdutoResultado | null, FormData>(
    salvarProduto,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  const editando = Boolean(produto);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onConcluido();
    }
  }, [state, onConcluido]);

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          {editando ? "Editar produto" : "Novo produto"}
        </h2>
        {editando && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>

      {produto && <input type="hidden" name="id" value={produto.id} />}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            name="nome"
            defaultValue={produto?.nome}
            placeholder="Ex.: Picanha"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preco">Preço (R$)</Label>
          <Input
            id="preco"
            name="preco"
            inputMode="decimal"
            defaultValue={produto?.preco}
            placeholder="89,90"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unidade">Unidade</Label>
          <select
            id="unidade"
            name="unidade"
            defaultValue={produto?.unidade ?? "KG"}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="KG">por kg</option>
            <option value="PECA">por peça</option>
            <option value="G">por grama</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="sinonimos">Sinônimos (opcional, separados por vírgula)</Label>
          <Input
            id="sinonimos"
            name="sinonimos"
            defaultValue={produto?.sinonimos.join(", ")}
            placeholder="picanha maturada, picanha premium"
          />
        </div>
      </div>

      {state && !state.ok && (
        <p className="mt-3 text-sm text-destructive">{state.erro}</p>
      )}

      <div className="mt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : editando ? "Salvar alterações" : "Adicionar produto"}
        </Button>
      </div>
    </form>
  );
}

function ProdutoRow({
  produto,
  ehAdmin,
  onEditar,
}: {
  produto: ProdutoDTO;
  ehAdmin: boolean;
  onEditar: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function acao(fn: () => Promise<ProdutoResultado>) {
    startTransition(async () => {
      await fn();
    });
  }

  return (
    <tr className={produto.ativo ? "bg-card" : "bg-card/50 opacity-60"}>
      <td className="px-4 py-2.5">
        <span className="font-medium text-foreground">{produto.nome}</span>
        {!produto.ativo && (
          <Badge variant="muted" className="ml-2">
            inativo
          </Badge>
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{brl.format(produto.preco)}</td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {unidadeLabel(produto.unidade)}
      </td>
      {ehAdmin && (
        <td className="px-4 py-2.5">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={pending} onClick={onEditar}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => acao(() => alternarAtivoProduto(produto.id, !produto.ativo))}
            >
              {produto.ativo ? "Desativar" : "Ativar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => acao(() => excluirProduto(produto.id))}
            >
              Excluir
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}
