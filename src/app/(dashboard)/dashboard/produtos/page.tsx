import { PageHeader } from "@/components/page-header";
import { requireUsuario } from "@/server/services/auth";
import { listarProdutosDaLoja } from "@/server/services/produto";

import { ProdutosManager, type ProdutoDTO } from "./produtos-manager";

export const metadata = { title: "Produtos" };
export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  const usuario = await requireUsuario();
  const produtos = await listarProdutosDaLoja(usuario.lojaId);

  const dtos: ProdutoDTO[] = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    preco: Number(p.preco),
    unidade: p.unidade,
    sinonimos: p.sinonimos,
    ativo: p.ativo,
  }));

  return (
    <div>
      <PageHeader
        titulo="Produtos"
        descricao="Catálogo da loja — base para o preço dos pedidos e o atendimento da IA."
      />
      <ProdutosManager produtos={dtos} ehAdmin={usuario.perfil === "ADMIN"} />
    </div>
  );
}
