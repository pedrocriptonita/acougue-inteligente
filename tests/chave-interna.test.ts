import { describe, expect, it } from "vitest";

import {
  HEADER_CHAVE_INTERNA,
  verificarChaveInterna,
} from "@/server/services/n8n";

// INTERNAL_API_KEY é definida no vitest.config.ts (test.env).
const CHAVE = "test-internal-key-1234567890";

describe("verificarChaveInterna", () => {
  it("aceita a chave correta", () => {
    const headers = new Headers({ [HEADER_CHAVE_INTERNA]: CHAVE });
    expect(verificarChaveInterna(headers)).toBe(true);
  });

  it("aceita a chave correta como string", () => {
    expect(verificarChaveInterna(CHAVE)).toBe(true);
  });

  it("rejeita chave errada (mesmo tamanho)", () => {
    const headers = new Headers({
      [HEADER_CHAVE_INTERNA]: "test-internal-key-XXXXXXXXXX",
    });
    expect(verificarChaveInterna(headers)).toBe(false);
  });

  it("rejeita ausência de header ou valor nulo", () => {
    expect(verificarChaveInterna(new Headers())).toBe(false);
    expect(verificarChaveInterna(null)).toBe(false);
  });
});
