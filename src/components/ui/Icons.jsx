// src/components/ui/Icons.jsx
import React from "react";

const Icon = ({ d, size = 20, className = "", strokeWidth = 1.8, fill = "none", viewBox = "0 0 24 24" }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill={fill}
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
  </svg>
);

// ── Navigation ────────────────────────────────────────────
export const HomeIcon = (p) => <Icon {...p} d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />;

export const TractorIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <circle cx="7" cy="17" r="3"/>
    <circle cx="17" cy="17" r="2"/>
    <path d="M10 17h5"/>
    <path d="M4 17V9l4-4h6l2 4v2H4"/>
    <path d="M14 5h4l1 4"/>
    <path d="M4 13h12"/>
  </svg>
);

export const ClipboardIcon = (p) => <Icon {...p} d={[
  "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2",
  "M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  "M9 12h6M9 16h4"
]} />;

export const DriverIcon = (p) => <Icon {...p} d={[
  "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2",
  "M12 11a4 4 0 100-8 4 4 0 000 8z"
]} />;

export const WrenchIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
  </svg>
);

export const ChartIcon = (p) => <Icon {...p} d={[
  "M18 20V10",
  "M12 20V4",
  "M6 20v-6"
]} />;

// ── Actions ───────────────────────────────────────────────
export const PlusIcon = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;

export const EditIcon = (p) => <Icon {...p} d={[
  "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7",
  "M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
]} />;

export const TrashIcon = (p) => <Icon {...p} d={[
  "M3 6h18",
  "M8 6V4h8v2",
  "M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
  "M10 11v6M14 11v6"
]} />;

export const SaveIcon = (p) => <Icon {...p} d={[
  "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z",
  "M17 21v-8H7v8M7 3v5h8"
]} />;

export const CloseIcon = (p) => <Icon {...p} d="M18 6L6 18M6 6l12 12" />;

export const ExpandIcon = (p) => <Icon {...p} d={[
  "M8 3H5a2 2 0 00-2 2v3",
  "M16 3h3a2 2 0 012 2v3",
  "M21 16v3a2 2 0 01-2 2h-3",
  "M3 16v3a2 2 0 002 2h3",
]} />;

export const FilterIcon = (p) => <Icon {...p} d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />;

export const ClearIcon = (p) => <Icon {...p} d={[
  "M20 5H9l-7 7 7 7h11a2 2 0 002-2V7a2 2 0 00-2-2z",
  "M18 9l-6 6M12 9l6 6"
]} />;

export const LogoutIcon = (p) => <Icon {...p} d={[
  "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4",
  "M16 17l5-5-5-5",
  "M21 12H9"
]} />;

export const MenuIcon = (p) => <Icon {...p} d="M3 12h18M3 6h18M3 18h18" />;

// ── Domain ────────────────────────────────────────────────
export const FuelIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M3 22V8l6-6h6l2 2v3h1a2 2 0 012 2v7a2 2 0 01-2 2h-1v2H3z"/>
    <path d="M9 2v6H3"/>
    <path d="M13 14v-4"/>
  </svg>
);

export const AcreIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M3 21V7l9-4 9 4v14"/>
    <path d="M3 21h18"/>
    <path d="M9 21v-6h6v6"/>
    <path d="M9 9h.01M15 9h.01M12 9h.01M12 14h.01"/>
  </svg>
);

export const RevenueIcon = (p) => <Icon {...p} d={[
  "M12 1v22",
  "M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
]} />;

export const ProfitIcon = (p) => <Icon {...p} d={[
  "M23 6l-9.5 9.5-5-5L1 18",
  "M17 6h6v6"
]} />;

export const SettingsIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

export const StarIcon = (p) => <Icon {...p} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />;

export const AlertIcon = (p) => <Icon {...p} d={[
  "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  "M12 9v4M12 17h.01"
]} />;

export const CalendarIcon = (p) => <Icon {...p} d={[
  "M8 2v4M16 2v4",
  "M3 8h18",
  "M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z"
]} />;

export const WalletIcon = (p) => <Icon {...p} d={[
  "M21 7H6a3 3 0 000 6h15v-6z",
  "M21 13v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h13a2 2 0 012 2v2",
  "M17 10h.01"
]} />;

export const ReceiptIcon = (p) => <Icon {...p} d={[
  "M6 2h12a1 1 0 011 1v18l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 011-1z",
  "M8 7h8M8 11h8M8 15h5"
]} />;

export const ArrowUpCircleIcon = (p) => <Icon {...p} d={[
  "M12 22a10 10 0 100-20 10 10 0 000 20z",
  "M12 16V8M8 12l4-4 4 4"
]} />;

export const ArrowDownCircleIcon = (p) => <Icon {...p} d={[
  "M12 2a10 10 0 100 20 10 10 0 000-20z",
  "M12 8v8M8 12l4 4 4-4"
]} />;

// Plain (no circle) chevron — used as a small collapse/expand affordance,
// e.g. the "minimize this banner" button on OfflineBanner.
export const ChevronUpIcon = (p) => <Icon {...p} d="M6 15l6-6 6 6" />;
export const ChevronDownIcon = (p) => <Icon {...p} d="M6 9l6 6 6-6" />;

export const PhoneIcon = (p) => <Icon {...p} d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />;

// ── Status badges ─────────────────────────────────────────
export const CheckCircleIcon = (p) => <Icon {...p} d={["M22 11.08V12a10 10 0 11-5.93-9.14", "M22 4L12 14.01l-3-3"]} />;
export const XCircleIcon     = (p) => <Icon {...p} d={["M12 22a10 10 0 100-20 10 10 0 000 20z", "M15 9l-6 6M9 9l6 6"]} />;
export const InfoIcon        = (p) => <Icon {...p} d={["M12 22a10 10 0 100-20 10 10 0 000 20z", "M12 8h.01M12 12v4"]} />;

// ── Privacy ───────────────────────────────────────────────
export const EyeIcon = (p) => <Icon {...p} d={[
  "M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12z",
  "M12 15a3 3 0 100-6 3 3 0 000 6z"
]} />;

export const EyeOffIcon = (p) => <Icon {...p} d={[
  "M17.94 17.94A10.94 10.94 0 0112 19.5C5 19.5 1 12 1 12a19.4 19.4 0 015.06-5.94M9.9 4.66A10.6 10.6 0 0112 4.5c7 0 11 7.5 11 7.5a19.5 19.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24",
  "M1 1l22 22"
]} />;

// ── Work types ────────────────────────────────────────────
export const PlowIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M2 20h20"/>
    <path d="M4 20V8l4-4 4 4v4l4-4 4 4v8"/>
    <path d="M8 20v-8"/>
    <path d="M16 20v-8"/>
  </svg>
);

export const SeedIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M12 22V12"/>
    <path d="M5 12C5 7 8 4 12 4s7 3 7 8c-2 0-5-1-7-4-2 3-5 4-7 4z"/>
  </svg>
);

export const LevelIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M2 12h20"/>
    <path d="M6 8l-4 4 4 4"/>
    <path d="M18 8l4 4-4 4"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

export const WaterIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z"/>
  </svg>
);

export const TruckIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M2 8h11v9H2z"/>
    <path d="M13 11h4l3 3v3h-7z"/>
    <circle cx="6" cy="18" r="1.8"/>
    <circle cx="17" cy="18" r="1.8"/>
  </svg>
);

export const LinkIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M9 12a4 4 0 004 4h3a4 4 0 000-8h-1"/>
    <path d="M15 12a4 4 0 00-4-4H8a4 4 0 000 8h1"/>
  </svg>
);

export const OilCanIcon = (p) => (
  <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M4 10h9l4-4h3l-2 4"/>
    <path d="M4 10v8a2 2 0 002 2h7a2 2 0 002-2v-8"/>
    <path d="M8 14h3"/>
  </svg>
);

// ── Map of work type → icon component ────────────────────
export const WORK_TYPE_ICON_MAP = {
  "المحراث":      PlowIcon,
  "القلاب":       PlowIcon,
  "السبسيولار":   PlowIcon,
  "معدة تسوية":   LevelIcon,
  "الدسك":        LevelIcon,
  "الرشاشة":      WaterIcon,
  "كومباين":      AcreIcon,
  "بلانتر بنجر":  SeedIcon,
  "بلانتر ذرة":   SeedIcon,
  "سطارة":        SeedIcon,
  "هولمر حصاد":   AcreIcon,
  "بدارة خدمة":   LevelIcon,
  "بدارة خضري":   LevelIcon,
  "أخرى":         WrenchIcon,
};

// ── Map of equipment type → icon component ────────────────
export const EQUIP_TYPE_ICON_MAP = {
  "جرار":        TractorIcon,
  "عربية":       TruckIcon,
  "معدة حرث":   PlowIcon,
  "معدة زراعة": SeedIcon,
  "مضخة مياه":  WaterIcon,
  "حصادة":      AcreIcon,
  "أخرى":       WrenchIcon,
};

export const PrintIcon = (p) => <Icon {...p} d={[
  "M6 9V2h12v7",
  "M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2",
  "M6 14h12v8H6z",
]} />;

// ── Profile / Account ─────────────────────────────────────
export const UserIcon = (p) => <Icon {...p} d={[
  "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2",
  "M12 11a4 4 0 100-8 4 4 0 000 8z",
]} />;

export const LockIcon = (p) => <Icon {...p} d={[
  "M5 11h14v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9z",
  "M8 11V7a4 4 0 118 0v4",
]} />;

export const CloudUploadIcon = (p) => <Icon {...p} d={[
  "M7 18a5 5 0 01-1-9.9A6 6 0 0117.9 9H18a4 4 0 010 8h-1",
  "M12 12v9",
  "M9 15l3-3 3 3",
]} />;

export const ChevronLeftIcon = (p) => <Icon {...p} d="M15 18l-6-6 6-6" />;

export const ClockIcon = (p) => <Icon {...p} d={[
  "M12 22a10 10 0 100-20 10 10 0 000 20z",
  "M12 6v6l4 2",
]} />;

export const DownloadIcon = (p) => <Icon {...p} d={[
  "M12 3v12",
  "M7 10l5 5 5-5",
  "M4 21h16",
]} />;

export const UploadFileIcon = (p) => <Icon {...p} d={[
  "M12 21V9",
  "M7 14l5-5 5 5",
  "M4 21h16",
]} />;

export const RestoreIcon = (p) => <Icon {...p} d={[
  "M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8",
  "M3 3v5h5",
]} />;

export const ShieldIcon = (p) => <Icon {...p} d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />;

export const UsersGroupIcon = (p) => <Icon {...p} d={[
  "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2",
  "M9 11a4 4 0 100-8 4 4 0 000 8z",
  "M22 21v-2a4 4 0 00-3-3.87",
  "M16 3.13a4 4 0 010 7.75",
]} />;

export const BugIcon = (p) => <Icon {...p} d={[
  "M9 9l-1.5-1.5M15 9l1.5-1.5M9 15l-1.5 1.5M15 15l1.5 1.5",
  "M12 20a5 5 0 005-5v-4a5 5 0 00-10 0v4a5 5 0 005 5z",
  "M8 12h8",
  "M12 7V5a2 2 0 114 0",
  "M12 7V5a2 2 0 10-4 0",
]} />;

export const MegaphoneIcon = (p) => <Icon {...p} d={[
  "M3 11v2a2 2 0 002 2h1l3 5V4l-3 5H5a2 2 0 00-2 2z",
  "M14 8a4 4 0 010 8",
  "M17 5a8 8 0 010 14",
]} />;

export const SendIcon = (p) => <Icon {...p} d={["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"]} />;

export const ExternalLinkIcon = (p) => <Icon {...p} d={[
  "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6",
  "M15 3h6v6",
  "M10 14L21 3",
]} />;

