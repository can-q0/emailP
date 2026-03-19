-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "emlData" BYTEA,
ADD COLUMN     "pdfData" BYTEA;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "pdfData" BYTEA;
