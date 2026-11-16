-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SIRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siCode" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "businessProfileId" TEXT,
    "businessName" TEXT,
    "alternativeName" TEXT,
    "circle" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "locality" TEXT,
    "landmark" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "latitude" TEXT,
    "longitude" TEXT,
    "googlePlusPage" TEXT,
    "vmnSi" TEXT,
    "weeklyOff" TEXT,
    "businessHours" TEXT,
    "website" TEXT,
    "placeId" TEXT,
    "locationGroup" TEXT,
    "gmbListingStatus" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "liveSince" DATETIME,
    "salesLandingNumbers" TEXT,
    "serviceLandingNumbers" TEXT,
    "linkedSpotlightCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpotlightRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientCode" TEXT NOT NULL,
    "name" TEXT,
    "alternateName" TEXT,
    "internalCode" TEXT,
    "region" TEXT,
    "state" TEXT,
    "city" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "locality" TEXT,
    "addressLine1" TEXT,
    "latitude" TEXT,
    "longitude" TEXT,
    "vmn" TEXT,
    "domain" TEXT,
    "adAccountCid" TEXT,
    "facebookPageId" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "liveSince" DATETIME,
    "spotlightLandingNumbers" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MediaSpend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordType" TEXT NOT NULL,
    "recordCode" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "allocated" REAL NOT NULL DEFAULT 0,
    "utilized" REAL NOT NULL DEFAULT 0,
    "pendingInWallet" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlatformFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordType" TEXT NOT NULL,
    "recordCode" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseAmount" REAL NOT NULL DEFAULT 8060,
    "gstRate" REAL NOT NULL DEFAULT 18,
    "gstAmount" REAL NOT NULL DEFAULT 1450.8,
    "totalAmount" REAL NOT NULL DEFAULT 9510.8,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetType" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "scopeMonth" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SIRecord_siCode_key" ON "SIRecord"("siCode");

-- CreateIndex
CREATE INDEX "SIRecord_clientCode_idx" ON "SIRecord"("clientCode");

-- CreateIndex
CREATE INDEX "SIRecord_state_idx" ON "SIRecord"("state");

-- CreateIndex
CREATE INDEX "SIRecord_circle_idx" ON "SIRecord"("circle");

-- CreateIndex
CREATE INDEX "SIRecord_city_idx" ON "SIRecord"("city");

-- CreateIndex
CREATE INDEX "SIRecord_isLive_idx" ON "SIRecord"("isLive");

-- CreateIndex
CREATE UNIQUE INDEX "SpotlightRecord_clientCode_key" ON "SpotlightRecord"("clientCode");

-- CreateIndex
CREATE INDEX "SpotlightRecord_state_idx" ON "SpotlightRecord"("state");

-- CreateIndex
CREATE INDEX "SpotlightRecord_region_idx" ON "SpotlightRecord"("region");

-- CreateIndex
CREATE INDEX "SpotlightRecord_city_idx" ON "SpotlightRecord"("city");

-- CreateIndex
CREATE INDEX "SpotlightRecord_isLive_idx" ON "SpotlightRecord"("isLive");

-- CreateIndex
CREATE INDEX "MediaSpend_recordType_recordCode_idx" ON "MediaSpend"("recordType", "recordCode");

-- CreateIndex
CREATE INDEX "MediaSpend_month_idx" ON "MediaSpend"("month");

-- CreateIndex
CREATE UNIQUE INDEX "MediaSpend_recordType_recordCode_month_key" ON "MediaSpend"("recordType", "recordCode", "month");

-- CreateIndex
CREATE INDEX "PlatformFee_recordType_recordCode_idx" ON "PlatformFee"("recordType", "recordCode");

-- CreateIndex
CREATE INDEX "PlatformFee_month_idx" ON "PlatformFee"("month");

-- CreateIndex
CREATE INDEX "PlatformFee_isPaid_idx" ON "PlatformFee"("isPaid");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFee_recordType_recordCode_month_key" ON "PlatformFee"("recordType", "recordCode", "month");

-- CreateIndex
CREATE INDEX "Rule_targetType_idx" ON "Rule"("targetType");

-- CreateIndex
CREATE INDEX "Rule_isEnabled_idx" ON "Rule"("isEnabled");
