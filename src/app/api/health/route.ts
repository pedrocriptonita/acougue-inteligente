import { NextResponse } from "next/server";

/**
 * Health check do serviço.
 * Na Fase 8 será expandido para checar Supabase, N8N e Evolution API.
 * Por enquanto confirma que a aplicação Next.js está no ar.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "acougue-inteligente",
    timestamp: new Date().toISOString(),
  });
}
