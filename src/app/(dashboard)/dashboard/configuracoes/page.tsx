import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { billingHabilitado } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { requireUsuario } from "@/server/services/auth";

import { ConfigForm } from "./config-form";
import { PlanoCard } from "./plano-card";

export const metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const usuario = await requireUsuario();
  const ehAdmin = usuario.perfil === "ADMIN";

  return (
    <div className="max-w-2xl">
      <PageHeader
        titulo="Configurações"
        descricao="Dados da sua loja."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Loja</CardTitle>
            <CardDescription>
              {ehAdmin
                ? "Edite o nome exibido nas comandas e no painel."
                : "Apenas administradores podem editar estes dados."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigForm
              nomeInicial={usuario.loja.nome}
              somenteLeitura={!ehAdmin}
            />
          </CardContent>
        </Card>

        {/* Assinatura: oculta no MVP (loja única). Reative com BILLING_ENABLED. */}
        {billingHabilitado && (
          <PlanoCard
            plano={usuario.loja.plano}
            status={usuario.loja.assinaturaStatus}
            expiraEm={usuario.loja.assinaturaExpiraEm?.toISOString() ?? null}
            temCliente={Boolean(usuario.loja.stripeCustomerId)}
            ehAdmin={ehAdmin}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">WhatsApp</CardTitle>
            <CardDescription>
              Número conectado para receber pedidos. Para trocar, fale com o
              suporte (afeta a integração).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Número</span>
              <span className="font-medium">{usuario.loja.telefoneWhatsapp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seu acesso</span>
              <span className="font-medium">
                {ehAdmin ? "Administrador" : "Funcionário"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
