import { prisma } from "@/lib/prisma";

export const DEFAULT_SETTINGS = {
  aiModel: "gpt-5",
  reportLanguage: "en",
  reportDetailLevel: "detailed",
  customSystemPrompt: null,
  autoClassify: true,
  displayName: null,
  theme: "light",
} as const;

export async function getOrCreateSettings(userId: string) {
  const existing = await prisma.userSettings.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  return prisma.userSettings.create({
    data: { userId },
  });
}
