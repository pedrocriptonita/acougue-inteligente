import { describe, expect, it } from "vitest";

import { formatarComanda, montarComandaEscPos } from "@/server/services/printnode";

const dados = {
  numero: 142,
  nomeLoja: "Açougue do Zé",
  nomeCliente: "Carlos Silva",
  telefoneCliente: "5511988887777",
  retirada: "18:00",
  itens: [
    { produto: "Picanha", quantidade: 1.5, unidade: "KG" as const },
    { produto: "Frango inteiro", quantidade: 2, unidade: "PECA" as const },
  ],
  criadoEm: new Date("2026-06-10T15:00:00Z"),
};

describe("formatarComanda (texto puro)", () => {
  const t = formatarComanda(dados);

  it("inclui número, itens e retirada", () => {
    expect(t).toContain("PEDIDO #142");
    expect(t).toContain("Picanha");
    expect(t).toContain("18:00");
  });

  it("mostra unidade PECA como 'un'", () => {
    expect(t).toContain("2 un");
  });

  it("não contém bytes de controle (é texto puro)", () => {
    expect(t).not.toContain("\x1B");
    expect(t).not.toContain("\x1D");
  });
});

describe("montarComandaEscPos", () => {
  it("inicia com reset, usa negrito e corte PARCIAL por padrão", () => {
    const e = montarComandaEscPos(dados);
    expect(e.startsWith("\x1B@")).toBe(true); // ESC @ (init)
    expect(e).toContain("\x1BE\x01"); // negrito on
    expect(e).toContain("\x1DV\x01"); // corte parcial
  });

  it("corte total usa GS V 0", () => {
    expect(montarComandaEscPos(dados, "total")).toContain("\x1DV\x00");
  });

  it("corte 'nenhum' não envia comando de corte", () => {
    expect(montarComandaEscPos(dados, "nenhum")).not.toContain("\x1DV");
  });
});
