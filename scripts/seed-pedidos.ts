/**
 * Seed de pedidos de teste — para exercitar o painel (Kanban: Em preparo →
 * Pronto → Concluído) SEM depender de WhatsApp/IA/Evolution.
 *
 * Cria pedidos de exemplo na primeira loja ativa, usando o mesmo caminho real
 * (`criarPedido`): número sequencial por loja, upsert de cliente e itens.
 *
 * Uso:
 *   npm run seed:pedidos           # cria os pedidos de exemplo
 *   npm run seed:pedidos -- --limpar   # remove os pedidos de teste
 *
 * Requer DATABASE_URL no .env.local e a migration aplicada (npm run prisma:migrate).
 */
import path from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

// Telefones de teste compartilham este prefixo (facilita limpar depois).
const MARKER = "5511900000";

type Unidade = "KG" | "G" | "PECA";

const amostras: {
  nome: string;
  tel: string;
  retirada: string;
  itens: { produto: string; quantidade: number; unidade: Unidade }[];
  precos: (number | null)[];
}[] = [
  {
    nome: "Carlos Silva",
    tel: `${MARKER}01`,
    retirada: "18:00",
    itens: [
      { produto: "Picanha", quantidade: 1.5, unidade: "KG" },
      { produto: "Linguiça artesanal", quantidade: 2, unidade: "KG" },
    ],
    precos: [89.9, 24.9],
  },
  {
    nome: "Mariana Costa",
    tel: `${MARKER}02`,
    retirada: "ao ficar pronto",
    itens: [{ produto: "Kit churrasco família", quantidade: 5, unidade: "KG" }],
    precos: [null], // sem preço → testar o editor "Definir preços" no card
  },
  {
    nome: "Roberto Alves",
    tel: `${MARKER}03`,
    retirada: "12:30",
    itens: [
      { produto: "Ancho", quantidade: 2, unidade: "KG" },
      { produto: "Sal de parrilla", quantidade: 1, unidade: "PECA" },
    ],
    precos: [79.0, 12.0],
  },
  {
    nome: "Ana Luiza",
    tel: `${MARKER}04`,
    retirada: "19:00",
    itens: [
      { produto: "Filé mignon", quantidade: 1, unidade: "KG" },
      { produto: "Bacon artesanal", quantidade: 0.5, unidade: "KG" },
    ],
    precos: [99.9, 49.9],
  },
];

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { criarPedido, definirPrecosItens } = await import(
    "../src/server/services/pedido"
  );

  const limpar = process.argv.includes("--limpar");

  const loja = await prisma.loja.findFirst({
    where: { ativo: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, nome: true },
  });

  if (!loja) {
    console.error(
      "❌ Nenhuma loja encontrada. Faça login e crie a loja (/setup) primeiro."
    );
    process.exit(1);
  }

  console.log(`🏪 Loja: ${loja.nome}\n`);

  if (limpar) {
    const del = await prisma.pedido.deleteMany({
      where: { lojaId: loja.id, telefoneCliente: { startsWith: MARKER } },
    });
    await prisma.cliente.deleteMany({
      where: { lojaId: loja.id, telefone: { startsWith: MARKER } },
    });
    console.log(`🧹 Removidos ${del.count} pedido(s) de teste.`);
    return;
  }

  for (const a of amostras) {
    const pedido = await criarPedido({
      lojaId: loja.id,
      nomeCliente: a.nome,
      telefoneCliente: a.tel,
      retirada: a.retirada,
      itens: a.itens,
    });

    const precos = pedido.itens
      .map((it, idx) => ({ itemId: it.id, precoUnitario: a.precos[idx] }))
      .filter((p): p is { itemId: string; precoUnitario: number } =>
        typeof p.precoUnitario === "number"
      );
    if (precos.length) await definirPrecosItens(pedido.id, loja.id, precos);

    console.log(`✅ #${pedido.numero}  ${a.nome}  (${a.itens.length} item(s))`);
  }

  console.log(
    "\n🎉 Pronto! Abra http://localhost:3000/dashboard — os pedidos estão em 'Em preparo'."
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
