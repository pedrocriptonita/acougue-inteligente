import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy do Next.js (mecanismo antes chamado de `middleware`, renomeado em
 * Next.js 16.2+). Renova a sessão do Supabase a cada requisição e protege as
 * rotas privadas. Ver `src/lib/supabase/middleware.ts`.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Roda em tudo, exceto assets estáticos e a rota de health check.
   * O matcher abaixo exclui:
   *  - _next/static, _next/image (build/otimização)
   *  - favicon e arquivos de imagem comuns
   *  - /api/health (monitoramento sem necessidade de sessão)
   *  - /api/n8n/* (máquina-a-máquina, autenticado por chave interna)
   *  - /api/stripe/* (webhook autenticado pela assinatura do Stripe)
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|api/n8n|api/stripe|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
