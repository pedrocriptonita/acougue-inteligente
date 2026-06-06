"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Encerra a sessão do usuário e o envia de volta ao login.
 * Chamada a partir de um `<form action={signOut}>` no painel.
 */
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
