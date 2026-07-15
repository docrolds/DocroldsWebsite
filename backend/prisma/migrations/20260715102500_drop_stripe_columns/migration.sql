-- DropIndex
DROP INDEX IF EXISTS "Customer_stripeCustomerId_key";

-- DropIndex
DROP INDEX IF EXISTS "Order_stripeSessionId_key";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "stripeCustomerId";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "stripeSessionId",
DROP COLUMN "stripePaymentId";
