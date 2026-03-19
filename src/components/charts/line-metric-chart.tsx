"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
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

function useChartColors() {
  const [colors, setColors] = useState({
    grid: "rgba(45,32,22,0.08)",
    axis: "rgba(45,32,22,0.1)",
    muted: "#9C8B7A",
    cardBg: "#FFFFFF",
    border: "#E8DFD3",
    shadow: "rgba(45,32,22,0.1)",
    refFill: "rgba(58,143,92,0.08)",
  });

  useEffect(() => {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    setColors({
      grid: styles.getPropertyValue("--chart-grid").trim() || colors.grid,
      axis: styles.getPropertyValue("--chart-axis").trim() || colors.axis,
      muted: styles.getPropertyValue("--text-muted").trim() || colors.muted,
      cardBg: styles.getPropertyValue("--card").trim() || colors.cardBg,
      border: styles.getPropertyValue("--card-border").trim() || colors.border,
      shadow: styles.getPropertyValue("--chart-shadow").trim() || colors.shadow,
      refFill: styles.getPropertyValue("--chart-ref-fill").trim() || colors.refFill,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return colors;
}

export function LineMetricChart({
  data,
  metricName,
  unit,
  referenceMin,
  referenceMax,
}: LineMetricChartProps) {
  const colors = useChartColors();

  const chartData = data.map((d) => ({
    date: format(new Date(d.measuredAt), "MMM d, yy"),
    value: d.value,
    isAbnormal: d.isAbnormal,
    confidence: d.confidence,
    raw: d,
  }));

  const values = data.map((d) => d.value);
  const min = Math.min(...values, referenceMin ?? Infinity) * 0.9;
  const max = Math.max(...values, referenceMax ?? -Infinity) * 1.1;

  return (
    <div className="w-full h-full min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: colors.muted }}
            stroke={colors.axis}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 11, fill: colors.muted }}
            stroke={colors.axis}
            unit={` ${unit}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              padding: "8px 12px",
              boxShadow: `0 4px 12px ${colors.shadow}`,
            }}
            labelStyle={{ color: colors.muted, fontSize: 12 }}
            itemStyle={{ color: "#D97757" }}
            formatter={(value, _name, props) => {
              const conf = props?.payload?.confidence;
              const confLabel = conf && conf !== "high" ? ` (${conf} confidence)` : "";
              return [`${value} ${unit}${confLabel}`, metricName];
            }}
          />

          {/* Reference range band */}
          {referenceMin !== undefined && referenceMax !== undefined && (
            <ReferenceArea
              y1={referenceMin}
              y2={referenceMax}
              fill={colors.refFill}
              stroke="rgba(58, 143, 92, 0.2)"
              strokeDasharray="3 3"
            />
          )}

          {/* Reference boundary lines with labels */}
          {referenceMin !== undefined && (
            <ReferenceLine
              y={referenceMin}
              stroke="rgba(58,143,92,0.4)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: `${referenceMin}`,
                position: "left",
                fill: "rgba(58,143,92,0.6)",
                fontSize: 10,
              }}
            />
          )}
          {referenceMax !== undefined && (
            <ReferenceLine
              y={referenceMax}
              stroke="rgba(58,143,92,0.4)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: `${referenceMax}`,
                position: "left",
                fill: "rgba(58,143,92,0.6)",
                fontSize: 10,
              }}
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
                payload: { isAbnormal: boolean; confidence?: string };
              };
              const isLowConf = payload.confidence === "low";
              const isMedConf = payload.confidence === "medium";
              return (
                <Dot
                  key={`${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={payload.isAbnormal ? 6 : 4}
                  fill={payload.isAbnormal ? "#C93B3B" : "#D97757"}
                  stroke={payload.isAbnormal ? "#C93B3B" : "#D97757"}
                  strokeWidth={payload.isAbnormal ? 2 : 0}
                  strokeDasharray={isLowConf ? "2 2" : isMedConf ? "4 2" : undefined}
                  opacity={isLowConf ? 0.5 : isMedConf ? 0.75 : 1}
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
