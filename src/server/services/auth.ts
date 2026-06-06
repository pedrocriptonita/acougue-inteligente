import { redirect } from "next/navigation";
import type { Loja, Usuario } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Camada de autenticação server-side.
 *
 * Modelo de dois níveis:
 *  1. `User` do Supabase Auth (identidade, via Google) — quem está logado.
 *  2. `Usuario` da aplicação, vinculado a uma `Loja` (tenant) — o que ele pode
 *     acessar. Um usuário recém-logado pode existir no Auth sem ainda ter uma
 *     Loja (precisa passar pelo onboarding em `/setup`).
 *
 * O isolamento multi-tenant da aplicação é garantido aqui: toda consulta
 * server-side deve ser escopada pelo `loja.id` retornado por estes helpers
 * (o RLS no Postgres é a segunda camada de defesa — ver `prisma/sql/rls.sql`).
 */

export type AuthContext = {
  authUser: User;
  usuario: (Usuario & { loja: Loja }) | null;
};

/** Retorna o usuário autenticado do Supabase, ou `null` se não houver sessão. */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Carrega o contexto completo: usuário do Auth + Usuario/Loja da aplicação.
 * Retorna `null` quando não há sessão válida.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const usuario = await prisma.usuario.findFirst({
    where: { authUserId: authUser.id, deletedAt: null },
    include: { loja: true },
  });

  return { authUser, usuario };
}

/**
 * Exige uma sessão autenticada. Sem sessão → redireciona para `/login`.
 * Use em páginas/ações que precisam de um usuário do Auth mas ainda não
 * necessariamente de uma Loja (ex.: a própria tela de onboarding).
 */
export async function requireAuthUser(): Promise<User> {
  const authUser = await getAuthUser();
  if (!authUser) redirect("/login");
  return authUser;
}

/**
 * Exige um usuário totalmente provisionado (com Loja vinculada).
 *  - Sem sessão → `/login`.
 *  - Sessão sem Loja → `/setup` (onboarding).
 * É o helper padrão para as rotas do painel protegido.
 */
export async function requireUsuario(): Promise<Usuario & { loja: Loja }> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.usuario) redirect("/setup");
  return ctx.usuario;
}
