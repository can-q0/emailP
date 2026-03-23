import { z, prettifyError } from "zod";
import { NextRequest, NextResponse } from "next/server";

// --- Schemas ---

export const gmailSyncSchema = z.object({
  query: z.string().min(1),
  patientName: z.string().optional(),
  maxResults: z.number().int().min(1).max(10000).optional(),
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
  reportType: z.enum(["all emails", "detailed report", "comparison", "plain PDF"]).optional(),
  format: z.enum(["summary", "detailed", "graphical"]).optional(),
  comparisonDateA: z.string().datetime().optional(),
  comparisonDateB: z.string().datetime().optional(),
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
  sort: z.enum(["name-asc", "name-desc", "emails", "updated"]).optional(),
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
  emailNotifications: z.boolean().optional(),
  displayName: z.string().max(100).nullable().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

export const batchReportSchema = z.object({
  patientIds: z.array(z.string().min(1)).min(1).max(20),
  reportType: z.enum(["all emails", "detailed report", "comparison"]).optional(),
  format: z.enum(["summary", "detailed", "graphical"]).optional(),
});

export const progressiveSearchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  year: z.coerce.number().int().min(2000).max(2040).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  labCode: z.string().optional(),
  gender: z.enum(["Male", "Female"]).optional(),
  birthYear: z.coerce.number().int().min(1920).max(2025).optional(),
  metricName: z.string().optional(),
  operator: z.enum(["lt", "gt", "lte", "gte", "eq"]).optional(),
  metricValue: z.coerce.number().optional(),
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
