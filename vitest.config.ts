import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // INTERNAL_API_KEY precisa existir antes de env.ts ser carregado (testa o n8n).
    env: { INTERNAL_API_KEY: "test-internal-key-1234567890" },
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` lança erro fora de um bundle RSC; neutraliza nos testes.
      "server-only": path.resolve(__dirname, "tests/_empty.ts"),
    },
  },
});
