-- CreateTable
CREATE TABLE "judge_pairs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "judge1Name" TEXT NOT NULL,
    "judge2Name" TEXT NOT NULL,
    "courtName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "judge_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paragraph_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paragraph_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "judge_pairs_userId_idx" ON "judge_pairs"("userId");

-- CreateIndex
CREATE INDEX "paragraph_templates_userId_idx" ON "paragraph_templates"("userId");

-- CreateIndex
CREATE INDEX "cloud_files_userId_idx" ON "cloud_files"("userId");

-- AddForeignKey
ALTER TABLE "judge_pairs" ADD CONSTRAINT "judge_pairs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paragraph_templates" ADD CONSTRAINT "paragraph_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_files" ADD CONSTRAINT "cloud_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
