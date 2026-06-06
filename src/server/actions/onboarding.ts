"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/server/services/auth";

/**
 * Onboarding do tenant: cria a Loja e vincula o usuário logado como ADMIN.
 *
 * É a única operação que grava um Usuario "do zero" (quando ainda não há
 * vínculo com nenhuma Loja). Roda via Prisma com a conexão direta do banco,
 * que contorna o RLS — necessário porque, neste momento, `auth_loja_id()`
 * ainda retornaria nulo. Ver `prisma/sql/rls.sql`.
 */

export type OnboardingState = {
  erro?: string;
  campos?: { nomeLoja?: string; telefoneWhatsapp?: string };
};

const schema = z.object({
  nomeLoja: z
    .string()
    .trim()
    .min(2, "Informe o nome do açougue (mín. 2 caracteres).")
    .max(120, "Nome muito longo."),
  telefoneWhatsapp: z
    .string()
    .trim()
    .min(1, "Informe o WhatsApp da loja.")
    // Mantém apenas dígitos para padronizar a chave única na plataforma.
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10 && v.length <= 15, {
      message: "WhatsApp inválido. Use DDD + número (ex.: 11999998888).",
    }),
});

export async function criarLoja(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const authUser = await getAuthUser();
  if (!authUser) redirect("/login");

  // Se já houver vínculo, não recria — apenas segue para o painel.
  const existente = await prisma.usuario.findFirst({
    where: { authUserId: authUser.id, deletedAt: null },
    select: { id: true },
  });
  if (existente) redirect("/dashboard");

  const parsed = schema.safeParse({
    nomeLoja: formData.get("nomeLoja"),
    telefoneWhatsapp: formData.get("telefoneWhatsapp"),
  });

  const campos = {
    nomeLoja: String(formData.get("nomeLoja") ?? ""),
    telefoneWhatsapp: String(formData.get("telefoneWhatsapp") ?? ""),
  };

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", campos };
  }

  const email = authUser.email;
  if (!email) {
    return { erro: "Sua conta Google não tem e-mail acessível.", campos };
  }

  const nomeUsuario =
    (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
    (authUser.user_metadata?.name as string | undefined)?.trim() ||
    email.split("@")[0] ||
    email;

  try {
    await prisma.$transaction(async (tx) => {
      const loja = await tx.loja.create({
        data: {
          nome: parsed.data.nomeLoja,
          telefoneWhatsapp: parsed.data.telefoneWhatsapp,
        },
      });

      await tx.usuario.create({
        data: {
          authUserId: authUser.id,
          lojaId: loja.id,
          nome: nomeUsuario,
          email,
          perfil: "ADMIN", // primeiro usuário é o dono da loja
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const alvo = (e.meta?.target as string[] | undefined)?.join(", ") ?? "";
      if (alvo.includes("telefone_whatsapp")) {
        return {
          erro: "Este WhatsApp já está vinculado a outra loja.",
          campos,
        };
      }
      if (alvo.includes("email") || alvo.includes("auth_user_id")) {
        // Conta já provisionada em outra requisição concorrente.
        redirect("/dashboard");
      }
      return { erro: "Já existe um registro com esses dados.", campos };
    }
    throw e;
  }

  redirect("/dashboard");
}
