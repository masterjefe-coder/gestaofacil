ALTER TABLE "Company"
ADD COLUMN "evolutionInstanceName" TEXT;

CREATE UNIQUE INDEX "Company_evolutionInstanceName_key"
ON "Company"("evolutionInstanceName");
