import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock do Prisma: $transaction executa o callback com um `tx` falso.
const tx = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  pedido: { aggregate: vi.fn(), create: vi.fn() },
  cliente: { upsert: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (cb: (t: typeof tx) => unknown) => cb(tx) },
}));

import { criarPedido } from "@/server/services/pedido";

beforeEach(() => {
  vi.clearAllMocks();
  tx.$executeRaw.mockResolvedValue(undefined);
  tx.cliente.upsert.mockResolvedValue({ id: "cliente-1" });
});

describe("criarPedido — número sequencial por loja", () => {
  it("usa max(numero)+1 e adquire o advisory lock", async () => {
    tx.pedido.aggregate.mockResolvedValue({ _max: { numero: 41 } });
    tx.pedido.create.mockResolvedValue({ id: "p1", numero: 42, itens: [] });

    const pedido = await criarPedido({
      lojaId: "loja-1",
      nomeCliente: "Carlos",
      telefoneCliente: "5511999998888",
      retirada: "18:00",
      itens: [{ produto: "Picanha", quantidade: 1.5, unidade: "KG" }],
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // pg_advisory_xact_lock
    expect(tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numero: 42, lojaId: "loja-1" }),
      })
    );
    expect(pedido.numero).toBe(42);
  });

  it("começa em #1 quando a loja não tem pedidos", async () => {
    tx.pedido.aggregate.mockResolvedValue({ _max: { numero: null } });
    tx.pedido.create.mockResolvedValue({ id: "p2", numero: 1, itens: [] });

    await criarPedido({
      lojaId: "loja-1",
      nomeCliente: "Ana",
      telefoneCliente: "5511900000000",
      retirada: "ao ficar pronto",
      itens: [],
    });

    expect(tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ numero: 1 }) })
    );
  });
});
