// src/components/charts/chartHelpers.jsx
// Shared Recharts helpers used by more than one page (DashboardPage,
// ReportsPage) — extracted because these two pages had independently
// written the exact same (or a parameterizable variant of the same)
// axis-label logic, and duplicated logic like this tends to slowly drift
// apart over time. Only what was genuinely identical, or safely
// parameterizable without changing either page's rendered output one bit,
// was moved here.

import React from "react";

// ── Compact number formatter for chart axes (١٫٢م / ١٢k) ──────────────────
// Byte-for-byte identical in both DashboardPage.jsx and ReportsPage.jsx
// before this extraction.
export const shortNum = (v) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}م`
  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
  : String(v);

// ── Truncate a label to `max` chars, appending an ellipsis ────────────────
// Was only defined in ReportsPage.jsx; DashboardPage.jsx's AngledNameTick
// inlined the exact same `length > 11 ? slice(0,11)+"…" : full` logic —
// i.e. truncateLabel(full, 11). Moving it here lets both use one
// implementation instead of two that happened to agree.
export const truncateLabel = (n = "", max) => (n.length > max ? `${n.slice(0, max)}…` : n);

// ── Angled X-axis tick factory ─────────────────────────────────────────────
// Shows a shortened name (to fit the chart width) rotated -15°, wrapped in
// a native SVG <title> so hovering the label with the mouse shows the
// full, untruncated name as a browser tooltip.
//
// DashboardPage and ReportsPage each had their own copy of this component
// with slightly different constants (fontSize 10 vs 11, truncate length 11
// vs 10) — this factory takes those as parameters so each page keeps its
// own exact original look, while sharing the one piece of markup/logic.
export const createAngledNameTick = ({ fontSize, maxLength, fill = "#6b7280" }) => {
  const AngledNameTick = (props) => {
    const { x, y, payload } = props;
    const full = payload.value ?? "";
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0} y={0} dy={6}
          textAnchor="end"
          fill={fill}
          fontSize={fontSize}
          fontFamily="Cairo"
          transform="rotate(-15)"
        >
          {truncateLabel(full, maxLength)}
          <title>{full}</title>
        </text>
      </g>
    );
  };
  return AngledNameTick;
};
