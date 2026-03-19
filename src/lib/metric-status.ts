// Plain-language status for blood metric values
// Helps non-medical users understand "Is this bad?"

export interface MetricStatus {
  label: string;
  severity: "normal" | "borderline" | "abnormal" | "critical";
  color: string;
}

export function getMetricStatus(
  value: number,
  refMin: number,
  refMax: number,
  language: string = "en"
): MetricStatus {
  const range = refMax - refMin;

  // Within normal range
  if (value >= refMin && value <= refMax) {
    return {
      label: language === "tr" ? "Normal aralikta" : "Within normal range",
      severity: "normal",
      color: "text-severity-low",
    };
  }

  // Below range
  if (value < refMin) {
    const deviation = (refMin - value) / range;
    if (deviation > 0.5) {
      return {
        label: language === "tr" ? "Belirgin dusuk" : "Significantly low",
        severity: "critical",
        color: "text-severity-high",
      };
    }
    if (deviation > 0.15) {
      return {
        label: language === "tr" ? "Normalin altinda" : "Below normal",
        severity: "abnormal",
        color: "text-severity-high",
      };
    }
    return {
      label: language === "tr" ? "Hafif dusuk" : "Slightly low",
      severity: "borderline",
      color: "text-severity-medium",
    };
  }

  // Above range
  const deviation = (value - refMax) / range;
  if (deviation > 0.5) {
    return {
      label: language === "tr" ? "Belirgin yuksek" : "Significantly high",
      severity: "critical",
      color: "text-severity-high",
    };
  }
  if (deviation > 0.15) {
    return {
      label: language === "tr" ? "Normalin uzerinde" : "Above normal",
      severity: "abnormal",
      color: "text-severity-high",
    };
  }
  return {
    label: language === "tr" ? "Hafif yuksek" : "Slightly high",
    severity: "borderline",
    color: "text-severity-medium",
  };
}
