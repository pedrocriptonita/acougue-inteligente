import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock do Prisma só com o que a idempotência usa.
const prismaMock = vi.hoisted(() => ({
  conversa: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { processarMensagem } from "@/server/services/conversa";

beforeEach(() => vi.clearAllMocks());

describe("processarMensagem — idempotência", () => {
  it("ignora mensagem já processada (mesmo mensagemId) e não grava nada", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      ultimaMensagemId: "msg-1",
      statusConversa: "COLETANDO",
      rascunho: null,
      tentativas: 0,
    });

    const resultado = await processarMensagem({
      loja: { id: "loja-1", nome: "Açougue do Zé" },
      telefone: "5511999998888",
      texto: "meio quilo de picanha",
      mensagemId: "msg-1", // mesma da última processada
    });

    expect(resultado.duplicada).toBe(true);
    expect(resultado.resposta).toBe("");
    // Não deve reprocessar/regravar a conversa.
    expect(prismaMock.conversa.upsert).not.toHaveBeenCalled();
  });
});
