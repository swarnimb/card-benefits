-- CreateTable
CREATE TABLE "AppState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankName" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "annualFee" REAL NOT NULL,
    "imageColor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Benefit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trackingType" TEXT NOT NULL,
    "category" TEXT,
    "rate" REAL,
    "rateType" TEXT,
    "capAmount" REAL,
    "capPeriod" TEXT,
    "resetMonth" INTEGER,
    "externalUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Benefit_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "pointBalance" REAL,
    "pointBalanceUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userCardId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "merchant" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "bankCategory" TEXT,
    "assignedCategory" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userCardId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "dateRangeStart" DATETIME NOT NULL,
    "dateRangeEnd" DATETIME NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AppState_key_key" ON "AppState"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Card_bankName_cardName_key" ON "Card"("bankName", "cardName");

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_cardId_key" ON "UserCard"("cardId");

-- CreateIndex
CREATE INDEX "Transaction_userCardId_date_idx" ON "Transaction"("userCardId", "date");

-- CreateIndex
CREATE INDEX "Transaction_userCardId_assignedCategory_idx" ON "Transaction"("userCardId", "assignedCategory");
