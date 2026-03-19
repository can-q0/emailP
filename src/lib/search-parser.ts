import { normalizeMetricName } from "@/lib/blood-metrics";
import { bloodMetricReferences } from "@/config/blood-metrics";
import { trLower } from "@/lib/turkish";
import type { SearchFilters } from "@/types";

// ── Turkish helpers ──────────────────────────────────────

const turkishLower = trLower;

const NAME_RE = /^[a-zA-ZÇçĞğİıÖöŞşÜü]+$/;

// ── Known lab codes ──────────────────────────────────────

const LAB_CODES = new Set([
  "lb",
  "acibadem",
  "acıbadem",
  "memorial",
  "medicana",
  "florence",
  "medipol",
  "anadolu",
  "amerikan",
  "liv",
  "bayindir",
  "bayındır",
]);

// ── Metric name reverse lookup (trName → key) ───────────

const trNameToKey: Record<string, string> = {};
for (const [key, ref] of Object.entries(bloodMetricReferences)) {
  trNameToKey[turkishLower(ref.trName)] = key;
  trNameToKey[turkishLower(ref.name)] = key;
}

// ── Multi-word metric map (for 2-token lookahead) ────────

const MULTI_WORD_METRICS: Record<string, string> = {
  "kan şekeri": "glucose",
  "aclik kan": "glucose",
  "serbest t4": "freeT4",
  "serbest t3": "freeT3",
  "free t4": "freeT4",
  "free t3": "freeT3",
  "total kolesterol": "totalCholesterol",
  "total cholesterol": "totalCholesterol",
  "total protein": "totalProtein",
  "total bilirubin": "totalBilirubin",
  "direkt bilirubin": "directBilirubin",
  "direct bilirubin": "directBilirubin",
  "red blood": "rbc",
  "white blood": "wbc",
  "vitamin d": "vitaminD",
  "d vitamini": "vitaminD",
  "vitamin b12": "vitaminB12",
  "b12 vitamini": "vitaminB12",
  "alkaline phosphatase": "alp",
  "blood urea": "bun",
  "fasting glucose": "glucose",
  "hemoglobin a1c": "hba1c",
  "sedimentation rate": "esr",
  "c-reactive protein": "crp",
  "ldl kolesterol": "ldl",
  "hdl kolesterol": "hdl",
};

// ── Compact (no-space) Turkish metric aliases ────────────

const COMPACT_ALIASES: Record<string, string> = {
  "kanşekeri": "glucose",
  "kansekeri": "glucose",
  "açlıkkanşekeri": "glucose",
  "açlıkşekeri": "glucose",
  "kolesterol": "totalCholesterol",
  "totalkolesterol": "totalCholesterol",
  "ldlkolesterol": "ldl",
  "hdlkolesterol": "hdl",
  "trigliserit": "triglycerides",
  "serbestt4": "freeT4",
  "serbestt3": "freeT3",
  "dvitamini": "vitaminD",
  "b12vitamini": "vitaminB12",
  "direktbilirubin": "directBilirubin",
  "totalbilirubin": "totalBilirubin",
  "totalprotein": "totalProtein",
  "hemoglobina1c": "hba1c",
};

// ── Operators ────────────────────────────────────────────

const OPERATORS = ["<=", ">=", "<", ">", "="] as const;
type Operator = (typeof OPERATORS)[number];

function parseOperatorValue(token: string): { operator: Operator; value: number } | null {
  for (const op of OPERATORS) {
    if (token.startsWith(op)) {
      const num = parseFloat(token.slice(op.length));
      if (!isNaN(num)) return { operator: op, value: num };
    }
  }
  return null;
}

/**
 * Split a combined metric+operator+value token like "kanşekeri>100"
 * Returns { metricName, operator, value } or null.
 */
function splitMetricOperatorValue(token: string): {
  metricName: string; operator: Operator; value: number;
} | null {
  // Try each operator (longest first: <=, >= before <, >)
  for (const op of OPERATORS) {
    const idx = token.indexOf(op);
    if (idx > 0) {
      const namePart = turkishLower(token.slice(0, idx));
      const valuePart = token.slice(idx + op.length);
      const num = parseFloat(valuePart);
      if (isNaN(num)) continue;

      // Resolve metric name
      const resolved =
        COMPACT_ALIASES[namePart] ||
        trNameToKey[namePart] ||
        (bloodMetricReferences[normalizeMetricName(namePart)] ? normalizeMetricName(namePart) : null);

      if (resolved) {
        return { metricName: resolved, operator: op, value: num };
      }
    }
  }
  return null;
}

// ── Main parser ──────────────────────────────────────────

export function parseSearchTokens(input: string): SearchFilters {
  const raw = input.trim();
  if (!raw) return {};

  const tokens = raw.split(/\s+/);
  const filters: SearchFilters = {};

  let pos = 0; // logical position (what we expect next)
  let i = 0; // token index

  while (i < tokens.length) {
    const token = tokens[i];
    const lower = turkishLower(token);

    // Position 0-1: firstName, lastName (alphabetic tokens)
    if (pos <= 1 && NAME_RE.test(token) && token.length > 1) {
      if (pos === 0) {
        filters.firstName = token;
        pos = 1;
      } else {
        filters.lastName = token;
        pos = 2;
      }
      i++;
      continue;
    }

    // Single-char alphabetic at pos 0/1 → still a name (e.g. "A" as initial)
    if (pos <= 1 && NAME_RE.test(token) && token.length === 1) {
      // Single char in early position: could be name initial
      // But "e"/"k" at pos 0 is unlikely a name - skip to check gender later
      if (pos === 0 && (lower === "e" || lower === "k")) {
        // Ambiguous — treat as firstName only if nothing else makes sense
        // Move to metric/gender parsing
        break;
      }
      if (pos === 0) {
        filters.firstName = token;
        pos = 1;
      } else {
        filters.lastName = token;
        pos = 2;
      }
      i++;
      continue;
    }

    // Position 2: year (4-digit, 2000-2040)
    if (pos >= 1 && pos <= 2 && /^\d{4}$/.test(token)) {
      const num = parseInt(token);
      if (num >= 2000 && num <= 2040) {
        filters.year = num;
        pos = 3;
        i++;
        continue;
      }
    }

    // Position 3: month (1-2 digit, 1-12)
    if (pos === 3 && /^\d{1,2}$/.test(token)) {
      const num = parseInt(token);
      if (num >= 1 && num <= 12) {
        filters.month = num;
        pos = 4;
        i++;
        continue;
      }
    }

    // Position 4: lab code
    if (pos >= 3 && pos <= 4 && LAB_CODES.has(lower)) {
      filters.labCode = lower;
      pos = 5;
      i++;
      continue;
    }

    // Position 5: gender ("e" or "k", single char)
    if (pos >= 4 && pos <= 5 && token.length === 1 && (lower === "e" || lower === "k")) {
      filters.gender = lower === "e" ? "Male" : "Female";
      pos = 6;
      i++;
      continue;
    }

    // Position 6: birthYear (4-digit, 1920-2025)
    if (pos >= 5 && pos <= 6 && /^\d{4}$/.test(token)) {
      const num = parseInt(token);
      if (num >= 1920 && num <= 2025) {
        filters.birthYear = num;
        pos = 7;
        i++;
        continue;
      }
    }

    // Remaining tokens: metric query
    // Try to parse metric name + operator + value from remaining tokens
    const remaining = tokens.slice(i);
    filters.metricQuery = parseMetricQuery(remaining);
    break;
  }

  return filters;
}

function parseMetricQuery(
  tokens: string[]
): SearchFilters["metricQuery"] | undefined {
  if (tokens.length === 0) return undefined;

  // First: try splitting a combined token like "kanşekeri>100" or "hemoglobin>=14"
  const combined = splitMetricOperatorValue(tokens[0]);
  if (combined) {
    return {
      metricName: combined.metricName,
      operator: combined.operator,
      value: combined.value,
    };
  }

  let metricName: string | undefined;
  let operator: Operator | undefined;
  let value: number | undefined;
  let consumed = 0;

  // Try 2-token lookahead for multi-word metrics
  if (tokens.length >= 2) {
    const twoWord = turkishLower(tokens[0] + " " + tokens[1]);
    if (MULTI_WORD_METRICS[twoWord]) {
      metricName = MULTI_WORD_METRICS[twoWord];
      consumed = 2;
    }
  }

  // Try 3-token for things like "kan şekeri" already handled, but also "blood urea nitrogen"
  if (!metricName && tokens.length >= 3) {
    const threeWord = turkishLower(tokens[0] + " " + tokens[1] + " " + tokens[2]);
    // Check known multi-words that are subsets
    const twoWord = turkishLower(tokens[0] + " " + tokens[1]);
    if (MULTI_WORD_METRICS[twoWord]) {
      metricName = MULTI_WORD_METRICS[twoWord];
      consumed = 2;
    }
    // Also try if the full 3-word is a known name
    const normalized3 = normalizeMetricName(threeWord);
    if (normalized3 !== threeWord && bloodMetricReferences[normalized3]) {
      metricName = normalized3;
      consumed = 3;
    }
  }

  // Single token metric name (check compact aliases first)
  if (!metricName) {
    const lower = turkishLower(tokens[0]);
    if (COMPACT_ALIASES[lower]) {
      metricName = COMPACT_ALIASES[lower];
      consumed = 1;
    } else if (trNameToKey[lower]) {
      metricName = trNameToKey[lower];
      consumed = 1;
    } else {
      // Try normalizeMetricName
      const normalized = normalizeMetricName(tokens[0]);
      if (normalized !== lower || bloodMetricReferences[normalized]) {
        metricName = normalized;
        consumed = 1;
      } else {
        // Unknown token — still treat as potential metric name attempt
        metricName = lower;
        consumed = 1;
      }
    }
  }

  // Parse operator + value from remaining tokens
  for (let j = consumed; j < tokens.length; j++) {
    const token = tokens[j];

    // Check combined operator+value like "<100"
    const combined = parseOperatorValue(token);
    if (combined) {
      operator = combined.operator;
      value = combined.value;
      break;
    }

    // Standalone operator
    if (!operator && OPERATORS.includes(token as Operator)) {
      operator = token as Operator;
      continue;
    }

    // Standalone value
    if (operator && !value) {
      const num = parseFloat(token);
      if (!isNaN(num)) {
        value = num;
        break;
      }
    }
  }

  if (!metricName) return undefined;

  return {
    metricName,
    ...(operator ? { operator } : {}),
    ...(value !== undefined ? { value } : {}),
  };
}

// ── Token label helpers (for UI pills) ───────────────────

export type TokenLabel =
  | { type: "firstName"; value: string }
  | { type: "lastName"; value: string }
  | { type: "year"; value: number }
  | { type: "month"; value: number }
  | { type: "labCode"; value: string }
  | { type: "gender"; value: string }
  | { type: "birthYear"; value: number }
  | { type: "metric"; value: string }
  | { type: "operator"; value: string }
  | { type: "metricValue"; value: number };

export function getTokenLabels(filters: SearchFilters): TokenLabel[] {
  const labels: TokenLabel[] = [];

  if (filters.firstName) labels.push({ type: "firstName", value: filters.firstName });
  if (filters.lastName) labels.push({ type: "lastName", value: filters.lastName });
  if (filters.year) labels.push({ type: "year", value: filters.year });
  if (filters.month) labels.push({ type: "month", value: filters.month });
  if (filters.labCode) labels.push({ type: "labCode", value: filters.labCode });
  if (filters.gender) labels.push({ type: "gender", value: filters.gender === "Male" ? "E" : "K" });
  if (filters.birthYear) labels.push({ type: "birthYear", value: filters.birthYear });
  if (filters.metricQuery) {
    const displayName = bloodMetricReferences[filters.metricQuery.metricName]?.name || filters.metricQuery.metricName;
    labels.push({ type: "metric", value: displayName });
    if (filters.metricQuery.operator) {
      labels.push({ type: "operator", value: filters.metricQuery.operator });
    }
    if (filters.metricQuery.value !== undefined) {
      labels.push({ type: "metricValue", value: filters.metricQuery.value });
    }
  }

  return labels;
}
