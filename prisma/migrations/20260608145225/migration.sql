/*
  Warnings:

  - A unique constraint covering the columns `[stripe_customer_id]` on the table `lojas` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_subscription_id]` on the table `lojas` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "lojas" ADD COLUMN     "assinatura_expira_em" TIMESTAMP(3),
ADD COLUMN     "assinatura_status" TEXT,
ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lojas_stripe_customer_id_key" ON "lojas"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "lojas_stripe_subscription_id_key" ON "lojas"("stripe_subscription_id");
