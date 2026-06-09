import { MessageSquareWarning } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { requireUsuario } from "@/server/services/auth";
import { listarConversasDaLoja } from "@/server/services/conversa";

export const metadata = { title: "Conversas" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  HUMANO: "Atendimento humano",
  COLETANDO: "Coletando",
  AGUARDANDO_CONFIRMACAO: "Aguardando confirmação",
};

function quando(data: Date) {
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ConversasPage() {
  const usuario = await requireUsuario();
  // Traz todas as ativas; as que precisam de humano vêm primeiro pela ordenação.
  const conversas = await listarConversasDaLoja(usuario.lojaId, {
    apenasHumano: false,
  });
  const emHumano = conversas.filter((c) => c.statusConversa === "HUMANO");

  return (
    <div>
      <PageHeader
        titulo="Conversas"
        descricao={
          emHumano.length > 0
            ? `${emHumano.length} conversa(s) aguardando atendimento humano`
            : "Sessões de pedido ativas no WhatsApp"
        }
      />

      {emHumano.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-foreground">
            Há clientes esperando atendimento humano. Responda diretamente pelo
            WhatsApp da loja.
          </p>
        </div>
      )}

      {conversas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma conversa ativa.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Telefone</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Atualizada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {conversas.map((c) => (
                <tr key={c.id} className="bg-card hover:bg-secondary/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {c.telefone}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={
                        c.statusConversa === "HUMANO" ? "destructive" : "muted"
                      }
                    >
                      {STATUS_LABEL[c.statusConversa] ?? c.statusConversa}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {quando(c.atualizadoEm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
