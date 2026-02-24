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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,32,22,0.08)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9C8B7A" }}
            stroke="rgba(45,32,22,0.1)"
          />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 11, fill: "#9C8B7A" }}
            stroke="rgba(45,32,22,0.1)"
            unit={` ${unit}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E8DFD3",
              borderRadius: "12px",
              padding: "8px 12px",
              boxShadow: "0 4px 12px rgba(45,32,22,0.1)",
            }}
            labelStyle={{ color: "#6B5B4D", fontSize: 12 }}
            itemStyle={{ color: "#D97757" }}
            formatter={(value) => [`${value} ${unit}`, metricName]}
          />

          {/* Reference range band */}
          {referenceMin !== undefined && referenceMax !== undefined && (
            <ReferenceArea
              y1={referenceMin}
              y2={referenceMax}
              fill="rgba(58, 143, 92, 0.08)"
              stroke="rgba(58, 143, 92, 0.2)"
              strokeDasharray="3 3"
            />
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke="#D97757"
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
                  fill={payload.isAbnormal ? "#C93B3B" : "#D97757"}
                  stroke={payload.isAbnormal ? "#C93B3B" : "#D97757"}
                  strokeWidth={payload.isAbnormal ? 2 : 0}
                />
              );
            }}
            activeDot={{ r: 6, stroke: "#D97757", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
