-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "completedTours" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "isDemoMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
