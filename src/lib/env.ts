import { z } from "zod";

/**
 * Validação das variáveis de ambiente na inicialização.
 * Falha cedo (e com mensagem clara) se algo obrigatório estiver faltando.
 *
 * As integrações externas (OpenAI, Evolution, PrintNode, N8N) ficam OPCIONAIS
 * aqui para não quebrar o build/dev de quem ainda não configurou as chaves.
 * A obrigatoriedade real é cobrada em tempo de execução, dentro de cada serviço,
 * via `getRequiredEnv()` — assim só falha quando a integração é de fato usada.
 */
const envSchema = z.object({
  // Supabase (Fase 2)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Banco / Prisma (Fase 2)
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  // OpenAI (Fase 3)
  OPENAI_API_KEY: z.string().min(1).optional(),

  // Evolution API / WhatsApp (Fase 3)
  EVOLUTION_API_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().min(1).optional(),
  EVOLUTION_INSTANCE_NAME: z.string().min(1).optional(),

  // PrintNode (Fase 3)
  PRINTNODE_API_KEY: z.string().min(1).optional(),
  PRINTNODE_PRINTER_ID: z.string().min(1).optional(),

  // N8N (Fase 4) — usadas pelo cliente/handlers, declaradas aqui
  N8N_WEBHOOK_URL: z.string().url().optional(),
  INTERNAL_API_KEY: z.string().min(1).optional(),

  // Stripe / Billing (Fase 7)
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_MENSAL: z.string().min(1).optional(),
  STRIPE_PRICE_ANUAL: z.string().min(1).optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);

/**
 * Lê uma variável de ambiente obrigatória em tempo de execução.
 * Use dentro dos serviços externos (server-side) para falhar com uma mensagem
 * clara quando uma integração for acionada sem estar configurada.
 */
export function getRequiredEnv(name: keyof typeof env): string {
  const value = env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${name}. ` +
        `Configure-a no .env.local (veja .env.example).`
    );
  }
  return value;
}
