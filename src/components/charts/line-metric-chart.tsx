"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Dot,
} from "recharts";
import { BloodMetricData } from "@/types";
import { format } from "date-fns";

interface LineMetricChartProps {
  data: BloodMetricData[];
  metricName: string;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
}

export function LineMetricChart({
  data,
  metricName,
  unit,
  referenceMin,
  referenceMax,
}: LineMetricChartProps) {
  const chartData = data.map((d) => ({
    date: format(new Date(d.measuredAt), "MMM d, yy"),
    value: d.value,
    isAbnormal: d.isAbnormal,
    raw: d,
  }));

  const values = data.map((d) => d.value);
  const min = Math.min(...values, referenceMin ?? Infinity) * 0.9;
  const max = Math.max(...values, referenceMax ?? -Infinity) * 1.1;

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
            stroke="rgba(255,255,255,0.1)"
          />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
            stroke="rgba(255,255,255,0.1)"
            unit={` ${unit}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
            itemStyle={{ color: "#38bdf8" }}
            formatter={(value) => [`${value} ${unit}`, metricName]}
          />

          {/* Reference range band */}
          {referenceMin !== undefined && referenceMax !== undefined && (
            <ReferenceArea
              y1={referenceMin}
              y2={referenceMax}
              fill="rgba(34, 197, 94, 0.08)"
              stroke="rgba(34, 197, 94, 0.2)"
              strokeDasharray="3 3"
            />
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as {
                cx: number;
                cy: number;
                payload: { isAbnormal: boolean };
              };
              return (
                <Dot
                  key={`${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={payload.isAbnormal ? 6 : 4}
                  fill={payload.isAbnormal ? "#ef4444" : "#38bdf8"}
                  stroke={payload.isAbnormal ? "#ef4444" : "#38bdf8"}
                  strokeWidth={payload.isAbnormal ? 2 : 0}
                />
              );
            }}
            activeDot={{ r: 6, stroke: "#38bdf8", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
