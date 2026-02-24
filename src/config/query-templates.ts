import { QueryTemplate } from "@/types";

export const defaultQueryTemplate: QueryTemplate = {
  id: "default",
  segments: [
    { type: "text", value: "I want to see " },
    {
      type: "choice",
      id: "reportType",
      options: ["all emails", "detailed report", "comparison"],
      kind: "choice",
    },
    { type: "text", value: " for patient " },
    {
      type: "blank",
      id: "patientName",
      placeholder: "patient name",
      kind: "text",
    },
    { type: "text", value: ", covering the period from " },
    {
      type: "blank",
      id: "dateFrom",
      placeholder: "start date",
      kind: "text",
    },
    { type: "text", value: " to " },
    {
      type: "blank",
      id: "dateTo",
      placeholder: "end date",
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
