import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthContext } from "@/server/services/auth";

import { SetupForm } from "./setup-form";

export const metadata = { title: "Configurar sua loja" };

export default async function SetupPage() {
  const ctx = await getAuthContext();
  // Precisa estar logado; e quem já tem loja não passa pelo onboarding de novo.
  if (!ctx) redirect("/login");
  if (ctx.usuario) redirect("/dashboard");

  const nome =
    (ctx.authUser.user_metadata?.full_name as string | undefined) ??
    ctx.authUser.email ??
    "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vamos configurar sua loja</CardTitle>
        <CardDescription>
          {nome ? `Olá, ${nome.split(" ")[0]}! ` : ""}
          Falta só um passo: cadastre o seu açougue para começar a receber
          pedidos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SetupForm />
      </CardContent>
    </Card>
  );
}
