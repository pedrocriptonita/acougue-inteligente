"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/server/services/auth";

/** Edição dos dados da loja (Configurações). Apenas ADMIN. */

export type LojaState = { ok?: boolean; erro?: string };

const schema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome do açougue (mín. 2 caracteres).")
    .max(120, "Nome muito longo."),
});

export async function atualizarLoja(
  _prev: LojaState,
  formData: FormData
): Promise<LojaState> {
  const usuario = await requireUsuario();
  if (usuario.perfil !== "ADMIN") {
    return { erro: "Apenas administradores podem alterar a loja." };
  }

  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.loja.update({
    where: { id: usuario.lojaId },
    data: { nome: parsed.data.nome },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
