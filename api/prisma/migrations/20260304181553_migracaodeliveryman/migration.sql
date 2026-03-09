-- DropForeignKey (protegido para bancos com drift)
ALTER TABLE "RecipeItem" DROP CONSTRAINT IF EXISTS "RecipeItem_inventoryItemId_fkey";

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "cmvTotal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "grossMarginPercent" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "grossMarginValue" DOUBLE PRECISION;

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "cmvTotal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "cmvUnit" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "marginPercent" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "marginValue" DOUBLE PRECISION;

ALTER TABLE "ProductPizzaFlavor" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "RecipeItem" ADD COLUMN IF NOT EXISTS "ingredientProductId" TEXT;
ALTER TABLE "RecipeItem" ALTER COLUMN "inventoryItemId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "RecipeItem_productId_idx" ON "RecipeItem"("productId");

CREATE INDEX IF NOT EXISTS "RecipeItem_inventoryItemId_idx" ON "RecipeItem"("inventoryItemId");

CREATE INDEX IF NOT EXISTS "RecipeItem_ingredientProductId_idx" ON "RecipeItem"("ingredientProductId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RecipeItem_inventoryItemId_fkey'
  ) THEN
    ALTER TABLE "RecipeItem"
      ADD CONSTRAINT "RecipeItem_inventoryItemId_fkey"
      FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RecipeItem_ingredientProductId_fkey'
  ) THEN
    ALTER TABLE "RecipeItem"
      ADD CONSTRAINT "RecipeItem_ingredientProductId_fkey"
      FOREIGN KEY ("ingredientProductId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
