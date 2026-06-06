import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthContext } from "@/server/services/auth";

import { GoogleSignInButton } from "./google-sign-in-button";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  // Já autenticado? Encaminha conforme o provisionamento.
  const ctx = await getAuthContext();
  if (ctx?.usuario) redirect("/dashboard");
  if (ctx) redirect("/setup");

  const { redirectTo } = await searchParams;

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="font-display text-2xl font-semibold">A</span>
        </div>
        <CardTitle>Açougue Inteligente</CardTitle>
        <CardDescription>
          Entre para gerenciar os pedidos do seu açougue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleSignInButton redirectTo={redirectTo} />
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Ao entrar, você concorda em usar a plataforma para a gestão de pedidos
          do seu estabelecimento.
        </p>
      </CardContent>
    </Card>
  );
}
