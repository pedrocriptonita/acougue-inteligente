"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  abrirPortal,
  iniciarCheckout,
  type BillingState,
} from "@/server/actions/billing";

const inicial: BillingState = {};

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "success" | "destructive" | "muted" | "accent" }
> = {
  active: { label: "Ativa", variant: "success" },
  trialing: { label: "Em teste", variant: "accent" },
  past_due: { label: "Pagamento pendente", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "muted" },
};

export type PlanoCardProps = {
  plano: "TRIAL" | "MENSAL" | "ANUAL";
  status: string | null;
  expiraEm: string | null;
  temCliente: boolean;
  ehAdmin: boolean;
};

export function PlanoCard({
  plano,
  status,
  expiraEm,
  temCliente,
  ehAdmin,
}: PlanoCardProps) {
  const [checkoutState, checkoutAction, checkoutPending] = useActionState(
    iniciarCheckout,
    inicial
  );
  const [portalState, portalAction, portalPending] = useActionState(
    abrirPortal,
    inicial
  );

  const badge = status ? STATUS_BADGE[status] : undefined;
  const erro = checkoutState.erro ?? portalState.erro;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Plano
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
        </CardTitle>
        <CardDescription>
          {plano === "TRIAL"
            ? "Você está no período de teste. Assine para manter o serviço ativo."
            : `Assinatura ${plano === "MENSAL" ? "mensal" : "anual"}.`}
          {expiraEm &&
            ` Próxima renovação/expiração em ${new Date(expiraEm).toLocaleDateString("pt-BR")}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {!ehAdmin ? (
          <p className="text-sm text-muted-foreground">
            Apenas administradores podem gerenciar a assinatura.
          </p>
        ) : temCliente ? (
          // Já tem cadastro no Stripe → gerenciar pelo portal.
          <form action={portalAction}>
            <Button type="submit" variant="outline" disabled={portalPending}>
              {portalPending ? "Abrindo…" : "Gerenciar assinatura"}
            </Button>
          </form>
        ) : (
          // Sem assinatura → oferecer os planos.
          <form action={checkoutAction} className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="plano"
              value="MENSAL"
              disabled={checkoutPending}
            >
              Assinar mensal
            </Button>
            <Button
              type="submit"
              name="plano"
              value="ANUAL"
              variant="outline"
              disabled={checkoutPending}
            >
              Assinar anual
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
