-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Benefit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userCardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "value" REAL,
    "valueUnit" TEXT NOT NULL DEFAULT 'dollars',
    "resetPeriod" TEXT NOT NULL,
    "resetAnchor" TEXT NOT NULL DEFAULT 'calendar',
    "category" TEXT NOT NULL,
    "isTrackable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Benefit_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Benefit" ("category", "createdAt", "description", "id", "isTrackable", "name", "resetAnchor", "resetPeriod", "type", "userCardId", "value") SELECT "category", "createdAt", "description", "id", "isTrackable", "name", "resetAnchor", "resetPeriod", "type", "userCardId", "value" FROM "Benefit";
DROP TABLE "Benefit";
ALTER TABLE "new_Benefit" RENAME TO "Benefit";
CREATE INDEX "Benefit_userCardId_idx" ON "Benefit"("userCardId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
