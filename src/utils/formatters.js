// src/utils/formatters.js

/**
 * Format a number with comma separators (Arabic locale).
 */
export const formatNumber = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("ar-EG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * Format a number as Egyptian Pounds.
 */
export const formatCurrency = (value) =>
  `${formatNumber(value)} ج.م`;

/**
 * Format a value into a full Arabic date + time.
 * Accepts: ISO datetime string, JS Date, or a Firestore Timestamp (has .toDate()).
 * A plain "YYYY-MM-DD" string (no time component — e.g. legacy records saved
 * before createdAt existed) has no real time to show, so it falls back to a
 * date-only format rather than falsely implying midnight is the actual time.
 */
export const formatDateTime = (value) => {
  if (!value) return "—";
  const isDateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (isDateOnly) return formatDate(value);
  const d = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
};

/**
 * Format an ISO date string → full Arabic locale date.
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });
};

/**
 * Format an ISO date string → short Arabic locale date.
 */
export const formatDateShort = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ar-EG");
};

/**
 * "day month" Arabic label, no year — used in itemized breakdowns (e.g.
 * WhatsApp message templates) where the surrounding text already states
 * the month/period, so repeating the year on every line would be noise.
 */
export const formatDayMonth = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
};

/**
 * Today as YYYY-MM-DD (for input[type=date]), in the device's LOCAL
 * timezone. toISOString() converts to UTC first, which silently rolls the
 * date back by one day during the first couple of local hours in
 * timezones ahead of UTC (e.g. Egypt, UTC+2) — that's what was causing
 * custody entries logged just after midnight to be saved under yesterday's
 * date and drop out of "this month"'s report.
 */
export const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * First letter of a name for avatar display.
 */
export const getInitial = (name = "") => name.trim().charAt(0) || "؟";

/**
 * Format a percentage.
 */
export const formatPercent = (value, decimals = 1) =>
  `${Number(value || 0).toFixed(decimals)}%`;

/**
 * Tailwind color class based on profit sign.
 */
export const profitColor = (value) =>
  Number(value) >= 0 ? "text-green-400" : "text-red-400";

/**
 * Add thousand separators as the user types.
 * Strips all non-digit characters, formats with commas.
 * Returns the raw numeric string for storage.
 *
 * Usage in an input:
 *   value={formatInputNumber(rawValue)}
 *   onChange={(e) => setRawValue(parseInputNumber(e.target.value))}
 */
export const formatInputNumber = (rawValue) => {
  if (rawValue === "" || rawValue == null) return "";
  const digits = String(rawValue).replace(/[^\d.]/g, "");
  const parts  = digits.split(".");
  parts[0]     = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

/**
 * Strip formatting commas → plain numeric string.
 */
export const parseInputNumber = (formattedValue) =>
  String(formattedValue || "").replace(/,/g, "");
