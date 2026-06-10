import { describe, expect, it } from "vitest";

import { normalizarTelefone } from "@/server/services/evolution";

describe("normalizarTelefone", () => {
  it("adiciona DDI 55 a celular com DDD (11 dígitos)", () => {
    expect(normalizarTelefone("11999998888")).toBe("5511999998888");
  });

  it("adiciona DDI 55 a fixo com DDD (10 dígitos)", () => {
    expect(normalizarTelefone("1133334444")).toBe("551133334444");
  });

  it("mantém número que já tem o 55", () => {
    expect(normalizarTelefone("5511999998888")).toBe("5511999998888");
  });

  it("remove máscara/caracteres não numéricos", () => {
    expect(normalizarTelefone("(11) 99999-8888")).toBe("5511999998888");
  });
});
