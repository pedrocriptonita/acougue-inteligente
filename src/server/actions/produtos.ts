"use server";

import { revalidatePath } from "next/cache";
import { Prisma, UnidadeMedida } from "@prisma/client";
import { z } from "zod";

import { requireUsuario } from "@/server/services/auth";
import {
  atualizarProduto,
  criarProduto,
  removerProduto,
} from "@/server/services/produto";

/**
 * Server Actions do catálogo de produtos. Mutações exigem ADMIN e são sempre
 * escopadas à loja do usuário logado.
 */

export type ProdutoResultado = { ok: true } | { ok: false; erro: string };

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do produto.").max(80),
  preco: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z
      .number({ message: "Preço inválido." })
      .positive("O preço deve ser maior que zero.")
  ),
  unidade: z.nativeEnum(UnidadeMedida),
  sinonimos: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
});

async function exigirAdmin() {
  const usuario = await requireUsuario();
  if (usuario.perfil !== "ADMIN") return null;
  return usuario;
}

export async function salvarProduto(
  _prev: ProdutoResultado | null,
  formData: FormData
): Promise<ProdutoResultado> {
  const usuario = await exigirAdmin();
  if (!usuario) {
    return { ok: false, erro: "Apenas administradores podem editar o catálogo." };
  }

  const parsed = schema.safeParse({
    nome: formData.get("nome"),
    preco: formData.get("preco"),
    unidade: formData.get("unidade"),
    sinonimos: formData.get("sinonimos"),
  });
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Se vier um id, edita; senão, cria.
  const id = formData.get("id");
  try {
    if (typeof id === "string" && id.length > 0) {
      const ok = await atualizarProduto(id, usuario.lojaId, parsed.data);
      if (!ok) return { ok: false, erro: "Produto não encontrado." };
    } else {
      await criarProduto(usuario.lojaId, parsed.data);
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, erro: "Já existe um produto com esse nome." };
    }
    throw e;
  }

  revalidatePath("/dashboard/produtos");
  return { ok: true };
}

export async function alternarAtivoProduto(
  produtoId: string,
  ativo: boolean
): Promise<ProdutoResultado> {
  const usuario = await exigirAdmin();
  if (!usuario) return { ok: false, erro: "Apenas administradores." };

  const ok = await atualizarProduto(produtoId, usuario.lojaId, { ativo });
  if (!ok) return { ok: false, erro: "Produto não encontrado." };
  revalidatePath("/dashboard/produtos");
  return { ok: true };
}

export async function excluirProduto(
  produtoId: string
): Promise<ProdutoResultado> {
  const usuario = await exigirAdmin();
  if (!usuario) return { ok: false, erro: "Apenas administradores." };

  const ok = await removerProduto(produtoId, usuario.lojaId);
  if (!ok) return { ok: false, erro: "Produto não encontrado." };
  revalidatePath("/dashboard/produtos");
  return { ok: true };
}
