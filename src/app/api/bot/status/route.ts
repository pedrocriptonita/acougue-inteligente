import { NextResponse } from "next/server";

import { getAuthContext } from "@/server/services/auth";
import { estadoConexao } from "@/server/services/evolution";

/**
 * Estado de conexão do bot de WhatsApp (Evolution), para o badge da topbar.
 * Requer sessão (não é público). Resiliente: se a Evolution não estiver
 * configurada/acessível, devolve `offline` em vez de erro.
 */
export const runtime = "nodejs";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx?.usuario) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  try {
    const estado = await estadoConexao();
    // "open" = conectada ao WhatsApp.
    return NextResponse.json({ online: estado === "open", estado });
  } catch {
    return NextResponse.json({ online: false, estado: "offline" });
  }
}
