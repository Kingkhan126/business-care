import * as React from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";

export interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  subtitle: string;
  icon: LucideIcon;
  accent?: "indigo" | "emerald" | "amber" | "sky" | "rose";
  href?: string;
}

export function MetricCard({
  title,
  value,
  change,
  trend = "neutral",
  subtitle,
  icon: Icon,
  accent = "indigo",
  href,
}: MetricCardProps) {
  const accentGlow = {
    indigo: "group-hover:shadow-[0_0_24px_rgba(99,102,241,0.25)] border-indigo-500/20 text-indigo-400",
    emerald: "group-hover:shadow-[0_0_24px_rgba(16,185,129,0.25)] border-emerald-500/20 text-emerald-400",
    amber: "group-hover:shadow-[0_0_24px_rgba(245,158,11,0.25)] border-amber-500/20 text-amber-400",
    sky: "group-hover:shadow-[0_0_24px_rgba(14,165,233,0.25)] border-sky-500/20 text-sky-400",
    rose: "group-hover:shadow-[0_0_24px_rgba(244,63,94,0.25)] border-rose-500/20 text-rose-400",
  };

  const iconBg = {
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  const content = (
    <div className="relative overflow-hidden rounded-2xl glass-card-3d p-5">
      {/* Top light shimmer */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-50" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-300",
            iconBg[accent]
          )}
        >
          <Icon className="h-4 w-4 drop-shadow-[0_0_6px_currentColor]" />
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-depth font-mono">
          {value}
        </span>
      </div>

      {/* Trend & Contextual Subtitle */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        {change && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold font-mono border",
              trend === "up" && "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
              trend === "down" && "bg-rose-500/10 text-rose-300 border-rose-500/20",
              trend === "neutral" && "bg-white/5 text-slate-300 border-white/10"
            )}
          >
            {trend === "up" && <ArrowUpRight className="h-3 w-3" />}
            {trend === "down" && <ArrowDownRight className="h-3 w-3" />}
            {change}
          </span>
        )}
        <span className="text-slate-400 truncate text-[11px]">{subtitle}</span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-2xl">
        {content}
      </Link>
    );
  }

  return <div className="group">{content}</div>;
}
