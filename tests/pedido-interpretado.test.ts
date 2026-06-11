import { describe, expect, it } from "vitest";

import { pedidoInterpretadoSchema } from "@/server/services/openai";

const base = {
  itens: [{ produto: "Picanha", quantidade: 1.5, unidade: "KG" }],
  retirada: "18:00",
  pedidoCompleto: true,
  confirmouPedido: false,
  precisaAtendimentoHumano: false,
  mensagemAoCliente: "Posso confirmar?",
};

describe("pedidoInterpretadoSchema", () => {
  it("aceita um payload válido", () => {
    expect(pedidoInterpretadoSchema.safeParse(base).success).toBe(true);
  });

  it("aceita retirada nula", () => {
    expect(
      pedidoInterpretadoSchema.safeParse({ ...base, retirada: null }).success
    ).toBe(true);
  });

  it("rejeita unidade fora do enum", () => {
    const r = pedidoInterpretadoSchema.safeParse({
      ...base,
      itens: [{ produto: "Leite", quantidade: 1, unidade: "LITRO" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejeita quantidade não positiva", () => {
    const r = pedidoInterpretadoSchema.safeParse({
      ...base,
      itens: [{ produto: "Picanha", quantidade: 0, unidade: "KG" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejeita campos obrigatórios faltando", () => {
    const r = pedidoInterpretadoSchema.safeParse({ itens: [] });
    expect(r.success).toBe(false);
  });
});
