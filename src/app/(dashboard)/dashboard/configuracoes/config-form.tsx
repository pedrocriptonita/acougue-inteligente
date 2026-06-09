"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarLoja, type LojaState } from "@/server/actions/loja";

const inicial: LojaState = {};

export function ConfigForm({
  nomeInicial,
  somenteLeitura,
}: {
  nomeInicial: string;
  somenteLeitura: boolean;
}) {
  const [state, action, pending] = useActionState(atualizarLoja, inicial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome do açougue</Label>
        <Input
          id="nome"
          name="nome"
          defaultValue={nomeInicial}
          disabled={somenteLeitura || pending}
          required
        />
      </div>

      {state.erro && <p className="text-sm text-destructive">{state.erro}</p>}
      {state.ok && <p className="text-sm text-accent">Alterações salvas.</p>}

      {!somenteLeitura && (
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      )}
    </form>
  );
}
