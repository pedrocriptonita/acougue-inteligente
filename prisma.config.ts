import path from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Configuração do Prisma CLI.
 *
 * O Prisma CLI carrega `.env` automaticamente, mas NÃO `.env.local` (esse é
 * lido apenas pelo Next.js). Para manter um único arquivo de segredos, este
 * config carrega explicitamente o `.env.local` antes de o CLI ler o schema —
 * assim `DATABASE_URL`/`DIRECT_URL` ficam disponíveis para `migrate`/`studio`.
 *
 * Obs.: quando este arquivo existe, o Prisma deixa de carregar `.env` sozinho;
 * por isso o carregamento de ambiente passa a ser feito aqui.
 */
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
// Também carrega um `.env` tradicional, se existir (não sobrescreve o que já veio do .env.local).
loadEnv();

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
});
