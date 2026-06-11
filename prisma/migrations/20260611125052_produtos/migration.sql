-- CreateTable
CREATE TABLE "produtos" (
    "id" UUID NOT NULL,
    "loja_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "unidade" "UnidadeMedida" NOT NULL DEFAULT 'KG',
    "sinonimos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "produtos_loja_id_idx" ON "produtos"("loja_id");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_loja_id_nome_key" ON "produtos"("loja_id", "nome");

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_loja_id_fkey" FOREIGN KEY ("loja_id") REFERENCES "lojas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
