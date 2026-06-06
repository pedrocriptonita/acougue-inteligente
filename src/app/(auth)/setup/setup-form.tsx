"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarLoja, type OnboardingState } from "@/server/actions/onboarding";

const estadoInicial: OnboardingState = {};

export function SetupForm() {
  const [state, formAction, pending] = useActionState(criarLoja, estadoInicial);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nomeLoja">Nome do açougue</Label>
        <Input
          id="nomeLoja"
          name="nomeLoja"
          placeholder="Ex.: Açougue do Zé"
          defaultValue={state.campos?.nomeLoja}
          autoComplete="organization"
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefoneWhatsapp">WhatsApp da loja</Label>
        <Input
          id="telefoneWhatsapp"
          name="telefoneWhatsapp"
          type="tel"
          inputMode="tel"
          placeholder="(11) 99999-8888"
          defaultValue={state.campos?.telefoneWhatsapp}
          autoComplete="tel"
          required
        />
        <p className="text-xs text-muted-foreground">
          Número que receberá os pedidos dos clientes. DDD + número.
        </p>
      </div>

      {state.erro && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Criando…" : "Criar minha loja"}
      </Button>
    </form>
  );
}
