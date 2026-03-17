import { QueryTemplate } from "@/types";

export const defaultQueryTemplate: QueryTemplate = {
  id: "default",
  segments: [
    { type: "text", value: "I want to see " },
    {
      type: "choice",
      id: "reportType",
      options: ["all emails", "detailed report", "comparison", "plain PDF"],
      kind: "choice",
    },
    { type: "text", value: " for patient " },
    {
      type: "blank",
      id: "patientName",
      placeholder: "patient name",
      kind: "text",
    },
    { type: "text", value: ", presented in " },
    {
      type: "choice",
      id: "format",
      options: ["summary", "detailed", "graphical"],
      kind: "choice",
    },
    { type: "text", value: " format." },
  ],
};

export const queryTemplates: QueryTemplate[] = [defaultQueryTemplate];
