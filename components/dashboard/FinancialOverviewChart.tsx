"use client";

import * as React from "react";
import { useState } from "react";
import { TrendingUp, ArrowUpRight, DollarSign, Calendar, Layers } from "lucide-react";

export interface MonthlyDataPoint {
  label: string;
  fullLabel: string;
  revenue: number;
  expenses: number;
}

export interface FinancialOverviewChartProps {
  data: MonthlyDataPoint[];
  currency?: string;
}

export function FinancialOverviewChart({
  data,
  currency = "USD",
}: FinancialOverviewChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute scale boundaries
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 0);
  const maxExpenses = Math.max(...data.map((d) => d.expenses), 0);
  const rawMax = Math.max(maxRevenue, maxExpenses);
  const maxValue = rawMax === 0 ? 1000 : Math.ceil(rawMax * 1.2 / 500) * 500;

  // Chart coordinates
  const width = 640;
  const height = 240;
  const paddingX = 40;
  const paddingY = 30;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  // Helper to map index to X coord
  const getX = (index: number) => {
    if (data.length <= 1) return paddingX + usableWidth / 2;
    return paddingX + (index / (data.length - 1)) * usableWidth;
  };

  // Helper to map value to Y coord
  const getY = (value: number) => {
    const clamped = Math.max(0, Math.min(value, maxValue));
    return height - paddingY - (clamped / maxValue) * usableHeight;
  };

  // Build SVG path strings with smooth curves
  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return "";
    const points = values.map((v, i) => ({ x: getX(i), y: getY(v) }));
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  // Area fill paths
  const revenueLine = buildSmoothPath(data.map((d) => d.revenue));
  const expensesLine = buildSmoothPath(data.map((d) => d.expenses));

  const revenueArea = revenueLine
    ? `${revenueLine} L ${getX(data.length - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`
    : "";
  const expensesArea = expensesLine
    ? `${expensesLine} L ${getX(data.length - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`
    : "";

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Grid lines
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = (maxValue / gridSteps) * (gridSteps - i);
    const y = getY(val);
    return { val, y };
  });

  const activePoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="relative overflow-hidden rounded-2xl glass-card-3d p-6">
      {/* Top ambient highlight */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent opacity-60" />

      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white text-depth">
              Financial Performance &amp; Cash Flow
            </h3>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-300">
              Live Ledger
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Real monthly Revenue vs Operating Expenses aggregated from general ledger &amp; invoices.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-slate-300 font-medium">Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            <span className="text-slate-300 font-medium">Expenses</span>
          </div>
        </div>
      </div>

      {/* Financial KPIs Banner inside chart */}
      <div className="grid grid-cols-3 gap-3 my-4 rounded-xl glass-surface p-3 border border-white/5 text-center">
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400">6-Mo Invoiced</span>
          <p className="text-sm sm:text-base font-bold text-emerald-400 font-mono mt-0.5">
            PKR {totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="border-x border-white/5">
          <span className="text-[10px] uppercase font-semibold text-slate-400">6-Mo Expenses</span>
          <p className="text-sm sm:text-base font-bold text-rose-400 font-mono mt-0.5">
            PKR {totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400">Net Margin</span>
          <p className="text-sm sm:text-base font-bold text-indigo-300 font-mono mt-0.5">
            PKR {netProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* SVG Dimensional Chart Container */}
      <div className="relative mt-2 w-full select-none" onMouseLeave={() => setHoveredIndex(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {/* Revenue Gradient */}
            <linearGradient id="revenue-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Expenses Gradient */}
            <linearGradient id="expenses-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing line filters */}
            <filter id="emerald-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.6" />
            </filter>
            <filter id="rose-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f43f5e" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Grid lines & Y-axis labels */}
          {gridLines.map(({ val, y }, idx) => (
            <g key={idx}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingX - 6}
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-500 text-[10px] font-mono"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            </g>
          ))}

          {/* Area Fills */}
          {revenueArea && <path d={revenueArea} fill="url(#revenue-gradient)" />}
          {expensesArea && <path d={expensesArea} fill="url(#expenses-gradient)" />}

          {/* Stroke Lines */}
          {expensesLine && (
            <path
              d={expensesLine}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="url(#rose-glow)"
            />
          )}
          {revenueLine && (
            <path
              d={revenueLine}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="url(#emerald-glow)"
            />
          )}

          {/* X Axis month labels & interactive hitboxes */}
          {data.map((point, index) => {
            const x = getX(index);
            const isHovered = hoveredIndex === index;
            const revY = getY(point.revenue);
            const expY = getY(point.expenses);

            return (
              <g
                key={index}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
              >
                {/* Vertical hover indicator line */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingY}
                    x2={x}
                    y2={height - paddingY}
                    stroke="rgba(99, 102, 241, 0.5)"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Invisible wide hover column */}
                <rect
                  x={x - usableWidth / (data.length * 2)}
                  y={paddingY}
                  width={usableWidth / data.length}
                  height={usableHeight}
                  fill="transparent"
                />

                {/* Data point circles */}
                <circle
                  cx={x}
                  cy={revY}
                  r={isHovered ? 5 : 3.5}
                  fill="#10b981"
                  stroke="#020617"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />
                <circle
                  cx={x}
                  cy={expY}
                  r={isHovered ? 5 : 3.5}
                  fill="#f43f5e"
                  stroke="#020617"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />

                {/* X label */}
                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className={`text-[11px] font-mono transition-colors ${
                    isHovered ? "fill-white font-bold" : "fill-slate-400"
                  }`}
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Glass Tooltip */}
        {activePoint && hoveredIndex !== null && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl glass-panel p-2.5 shadow-glass-lg border border-indigo-500/20 text-xs text-white"
            style={{
              left: `${(getX(hoveredIndex) / width) * 100}%`,
              top: "10%",
              transform: "translate(-50%, 0)",
            }}
          >
            <div className="font-semibold text-slate-300 font-mono text-[11px] border-b border-white/10 pb-1 mb-1.5">
              {activePoint.fullLabel}
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Revenue:
                </span>
                <span className="font-semibold text-white">
                  PKR {activePoint.revenue.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-rose-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Expenses:
                </span>
                <span className="font-semibold text-white">
                  PKR {activePoint.expenses.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/5">
                <span className="text-indigo-300">Net:</span>
                <span
                  className={`font-semibold ${
                    activePoint.revenue - activePoint.expenses >= 0
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }`}
                >
                  PKR {(activePoint.revenue - activePoint.expenses).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
