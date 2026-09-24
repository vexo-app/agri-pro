// src/components/ui/Button.jsx
import React from "react";
import clsx from "clsx";

const VARIANTS = {
  primary:   "bg-brand-600 hover:bg-brand-500 text-white",
  secondary: "bg-surface-2 hover:bg-surface-3 text-gray-200 border border-white/10",
  danger:    "bg-red-700 hover:bg-red-600 text-white",
  info:      "bg-blue-600 hover:bg-blue-500 text-white",
  ghost:     "bg-transparent hover:bg-surface-2 text-gray-400 hover:text-gray-200 border border-white/10",
  outline:   "bg-transparent border border-brand-700 text-brand-400 hover:bg-brand-900/30",
};

const SIZES = {
  xs: "px-2.5 py-1.5 text-xs rounded-lg gap-1.5",
  sm: "px-3 py-2 text-sm rounded-xl gap-2",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-5 py-3 text-base rounded-2xl gap-2.5",
};

const Button = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  className,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        // Step 4: من غير ظل ملوّن ولا تصغير عند الضغط — بس حلقة تركيز واضحة للكيبورد.
        "inline-flex items-center justify-center font-semibold transition-colors duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-0",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        // icon is now an SVG React element, not a string
        React.isValidElement(icon) ? icon : <span className="text-base leading-none">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

export default Button;
