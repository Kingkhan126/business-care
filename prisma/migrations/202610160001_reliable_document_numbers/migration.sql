CREATE TABLE "DocumentSequence" (
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "value" BIGINT NOT NULL,
    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("organizationId", "kind", "prefix")
);
