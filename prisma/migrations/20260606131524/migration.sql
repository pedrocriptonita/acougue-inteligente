-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "PlanoAssinatura" AS ENUM ('TRIAL', 'MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('AGUARDANDO_PREPARO', 'PRONTO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('KG', 'G', 'PECA');

-- CreateEnum
CREATE TYPE "StatusConversa" AS ENUM ('COLETANDO', 'AGUARDANDO_CONFIRMACAO', 'HUMANO', 'CONCLUIDA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "lojas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone_whatsapp" TEXT NOT NULL,
    "plano" "PlanoAssinatura" NOT NULL DEFAULT 'TRIAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lojas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "loja_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'FUNCIONARIO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "loja_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL,
    "loja_id" UUID NOT NULL,
    "cliente_id" UUID,
    "numero" INTEGER NOT NULL,
    "nome_cliente" TEXT NOT NULL,
    "telefone_cliente" TEXT NOT NULL,
    "retirada" TEXT NOT NULL,
    "status" "StatusPedido" NOT NULL DEFAULT 'AGUARDANDO_PREPARO',
    "impresso" BOOLEAN NOT NULL DEFAULT false,
    "impresso_em" TIMESTAMP(3),
    "pronto_em" TIMESTAMP(3),
    "concluido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "produto" TEXT NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "unidade" "UnidadeMedida" NOT NULL DEFAULT 'KG',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" UUID NOT NULL,
    "loja_id" UUID NOT NULL,
    "telefone" TEXT NOT NULL,
    "rascunho" JSONB,
    "status_conversa" "StatusConversa" NOT NULL DEFAULT 'COLETANDO',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultima_mensagem_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lojas_telefone_whatsapp_key" ON "lojas"("telefone_whatsapp");

-- CreateIndex
CREATE INDEX "lojas_deleted_at_idx" ON "lojas"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_auth_user_id_key" ON "usuarios"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_loja_id_idx" ON "usuarios"("loja_id");

-- CreateIndex
CREATE INDEX "usuarios_deleted_at_idx" ON "usuarios"("deleted_at");

-- CreateIndex
CREATE INDEX "clientes_loja_id_idx" ON "clientes"("loja_id");

-- CreateIndex
CREATE INDEX "clientes_deleted_at_idx" ON "clientes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_loja_id_telefone_key" ON "clientes"("loja_id", "telefone");

-- CreateIndex
CREATE INDEX "pedidos_loja_id_status_idx" ON "pedidos"("loja_id", "status");

-- CreateIndex
CREATE INDEX "pedidos_cliente_id_idx" ON "pedidos"("cliente_id");

-- CreateIndex
CREATE INDEX "pedidos_deleted_at_idx" ON "pedidos"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_loja_id_numero_key" ON "pedidos"("loja_id", "numero");

-- CreateIndex
CREATE INDEX "itens_pedido_pedido_id_idx" ON "itens_pedido"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversas_ultima_mensagem_id_key" ON "conversas"("ultima_mensagem_id");

-- CreateIndex
CREATE INDEX "conversas_loja_id_status_conversa_idx" ON "conversas"("loja_id", "status_conversa");

-- CreateIndex
CREATE UNIQUE INDEX "conversas_loja_id_telefone_key" ON "conversas"("loja_id", "telefone");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_loja_id_fkey" FOREIGN KEY ("loja_id") REFERENCES "lojas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_loja_id_fkey" FOREIGN KEY ("loja_id") REFERENCES "lojas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_loja_id_fkey" FOREIGN KEY ("loja_id") REFERENCES "lojas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_loja_id_fkey" FOREIGN KEY ("loja_id") REFERENCES "lojas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
