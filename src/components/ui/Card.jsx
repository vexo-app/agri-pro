// src/components/ui/Card.jsx
import React from "react";
import clsx from "clsx";
import { usePrivacy } from "../../contexts/PrivacyContext";
import { useDataOptional } from "../../contexts/DataContext";
import { ArrowUpCircleIcon, ArrowDownCircleIcon } from "./Icons";
import { formatPercent } from "../../utils/formatters";

export const Card = ({ children, className, hover = false, ...props }) => (
  <div className={clsx(
    "bg-surface border border-white/8 rounded-2xl",
    hover && "transition-colors duration-150 hover:border-white/20",
    className
  )} {...props}>{children}</div>
);

export const CardHeader = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/8">
    <div>
      <h3 className="text-sm font-bold text-gray-100">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
);

export const CardBody = ({ children, className }) => (
  <div className={clsx("p-5", className)}>{children}</div>
);

// ── Badge ─────────────────────────────────────────────────
const BADGE_VARIANTS = {
  green:  "bg-green-900/40 text-green-400 border-green-800/50",
  amber:  "bg-amber-900/40 text-amber-400 border-amber-800/50",
  red:    "bg-red-900/40 text-red-400 border-red-800/50",
  blue:   "bg-blue-900/40 text-blue-400 border-blue-800/50",
  gray:   "bg-gray-800 text-gray-400 border-gray-700",
  purple: "bg-purple-900/40 text-purple-400 border-purple-800/50",
};

export const Badge = ({ children, variant = "gray", className }) => (
  <span className={clsx(
    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border",
    BADGE_VARIANTS[variant], className
  )}>{children}</span>
);

// Small "+12% / -4% عن الشهر اللي فات" pill. `changeInvert` flips which
// direction counts as "good" — for cost rows (fuel, maintenance, salaries…)
// a drop is the good direction, unlike revenue/profit where a rise is.
const ChangeBadge = ({ change, invert = false }) => {
  if (typeof change !== "number" || !Number.isFinite(change)) return null;
  const isUp = change > 0;
  const isFlat = change === 0;
  const isGood = isFlat ? null : (invert ? !isUp : isUp);
  const colorClass = isFlat
    ? "bg-gray-800 text-gray-400"
    : isGood
      ? "bg-green-900/30 text-green-400"
      : "bg-red-900/30 text-red-400";
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0", colorClass)}>
      {!isFlat && (isUp ? <ArrowUpCircleIcon size={10}/> : <ArrowDownCircleIcon size={10}/>)}
      {formatPercent(Math.abs(change), 0)}
    </span>
  );
};

// ── StatCard ──────────────────────────────────────────────
const STAT_ACCENTS = {
  green:  {
    bar:    "bg-green-500",
    value:  "text-green-400",
    icon:   "text-green-400",
    glow:   "bg-green-500/10",
    border: "border-green-500/20",
  },
  amber:  {
    bar:    "bg-amber-500",
    value:  "text-amber-400",
    icon:   "text-amber-400",
    glow:   "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  blue:   {
    bar:    "bg-blue-500",
    value:  "text-blue-400",
    icon:   "text-blue-400",
    glow:   "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  orange: {
    bar:    "bg-orange-500",
    value:  "text-orange-400",
    icon:   "text-orange-400",
    glow:   "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  red:    {
    bar:    "bg-red-500",
    value:  "text-red-400",
    icon:   "text-red-400",
    glow:   "bg-red-500/10",
    border: "border-red-500/20",
  },
  purple: {
    bar:    "bg-purple-500",
    value:  "text-purple-400",
    icon:   "text-purple-400",
    glow:   "bg-purple-500/10",
    border: "border-purple-500/20",
  },
};

export const StatCard = ({ icon, label, value, color = "green", sensitive = false, change, changeInvert = false }) => {
  const accent = STAT_ACCENTS[color] || STAT_ACCENTS.green;
  const { isPrivate } = usePrivacy();
  const hidden = sensitive && isPrivate;

  return (
    <div className={clsx(
      // Step 4: شكل ثابت وبسيط — من غير حركة hover ولا تدرّج لوني.
      "relative bg-surface border rounded-2xl p-5 overflow-hidden flex flex-col items-center text-center gap-3",
      accent.border
    )}>
      {/* Top accent bar (solid) */}
      <div className={clsx("absolute top-0 inset-x-0 h-0.5", accent.bar)} />

      {/* Icon with glow bg */}
      <div className={clsx(
        "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0",
        accent.glow
      )}>
        <div className={accent.icon}>
          {React.isValidElement(icon) ? icon : <span className="text-2xl">{icon}</span>}
        </div>
      </div>

      {/* Value */}
      <div
        className={clsx("text-2xl font-extrabold tabular-nums leading-tight transition-[filter] duration-300", accent.value)}
        style={{ filter: hidden ? "blur(9px)" : "none", userSelect: hidden ? "none" : "auto" }}
      >
        {value}
      </div>

      {/* Label */}
      <div className="text-xs text-gray-400 font-semibold">{label}</div>

      {/* Change vs. last month */}
      <ChangeBadge change={change} invert={changeInvert}/>
    </div>
  );
};


// ── EmptyState ────────────────────────────────────────────
export const EmptyState = ({ icon, title, description, action }) => {
  // Step 4: لو تحميل البيانات فشل جزئيًا، "مفيش بيانات" ممكن تكون غلط —
  // بنقول ده صراحة بدل ما القائمة الفاضية تبان كأن البيانات اتمسحت.
  const data = useDataOptional();
  const loadError = !!data?.loadError;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {React.isValidElement(icon)
        ? <div className="opacity-40 mb-2">{icon}</div>
        : <div className="text-5xl mb-4 opacity-40">{icon}</div>
      }
      <h3 className="text-base font-bold text-gray-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-5">{description}</p>}
      {loadError && (
        <p className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-4 max-w-sm">
          ⚠ بعض البيانات ما اتحملتش لسه — القائمة ممكن تكون ناقصة، مش فاضية فعلًا. بياناتك محفوظة.
        </p>
      )}
      {action}
    </div>
  );
};

export const SummaryRow = ({ label, value, valueColor = "text-gray-200", bold = false, sensitive = false, change, changeInvert = false }) => {
  const { isPrivate } = usePrivacy();
  const hidden = sensitive && isPrivate;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/8 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="flex items-center gap-2">
        <span
          className={clsx("text-sm font-bold tabular-nums transition-[filter] duration-300", valueColor, bold && "text-base")}
          style={{ filter: hidden ? "blur(6px)" : "none", userSelect: hidden ? "none" : "auto" }}
        >
          {value}
        </span>
        <ChangeBadge change={change} invert={changeInvert}/>
      </span>
    </div>
  );
};

export const ProgressBar = ({ value, max = 100, color = "bg-brand-500" }) => {
  const pct = Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100));
  return (
    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
      <div className={clsx("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${pct}%` }} />
    </div>
  );
};
