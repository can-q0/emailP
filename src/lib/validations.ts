import { z, prettifyError } from "zod";
import { NextRequest, NextResponse } from "next/server";

// --- Schemas ---

export const gmailSyncSchema = z.object({
  query: z.string().min(1),
  patientName: z.string().optional(),
});

export const gmailSearchSchema = z.object({
  q: z.string().min(1),
});

export const disambiguateSchema = z.object({
  patientName: z.string().min(1),
  emailIds: z.array(z.string()).optional(),
  governmentId: z.string().optional(),
  create: z.boolean().optional(),
});

export const generateReportSchema = z.object({
  patientId: z.string().min(1),
  emailIds: z.array(z.string()).min(1),
  title: z.string().optional(),
  reportType: z.enum(["all emails", "detailed report", "comparison"]).optional(),
  format: z.enum(["summary", "detailed", "graphical"]).optional(),
});

export const reportIdSchema = z.object({
  id: z.string().min(1),
});

export const reportSendSchema = z.object({
  reportId: z.string().min(1),
  recipientEmail: z.email(),
});

export const patientSearchSchema = z.object({
  q: z.string().optional(),
});

export const patientUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  governmentId: z.string().optional(),
});

export const patientMergeSchema = z.object({
  sourcePatientId: z.string().min(1),
  targetPatientId: z.string().min(1),
});

export const userSettingsUpdateSchema = z.object({
  aiModel: z.enum(["gpt-5", "gpt-4o", "gpt-4o-mini"]).optional(),
  reportLanguage: z.enum(["en", "tr"]).optional(),
  reportDetailLevel: z.enum(["summary", "detailed", "graphical"]).optional(),
  customSystemPrompt: z.string().max(2000).nullable().optional(),
  autoClassify: z.boolean().optional(),
  displayName: z.string().max(100).nullable().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

// --- Helpers ---

export async function parseBody<T extends z.ZodType>(
  req: NextRequest,
  schema: T
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse }
> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Validation failed", details: prettifyError(result.error) },
          { status: 400 }
        ),
      };
    }
    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
}

export function parseSearchParams<T extends z.ZodType>(
  req: NextRequest,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Validation failed", details: prettifyError(result.error) },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}
