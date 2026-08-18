import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  HelpCircle,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import type { AccessibilityStatus, EvidenceSource } from "../types/index.js";
import { SOURCE_LABELS } from "../utils/constants.js";
import { formatPercent } from "../utils/format.js";

/* ---------------- Button ---------------- */

type ButtonVariant = "primary" | "ghost" | "outline" | "subtle" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-apple-blue text-white hover:brightness-110 active:brightness-95 disabled:bg-smoke",
  ghost: "bg-transparent text-silk hover:bg-charcoal",
  outline: "border border-graphite text-silk hover:border-platinum hover:bg-charcoal",
  subtle: "bg-charcoal text-silk hover:bg-smoke",
  danger: "bg-ember text-white hover:brightness-110",
};

const SIZE_CLASSES = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-pill font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={`rounded-card bg-charcoal p-6 ${className}`}>{children}</Tag>
  );
}

/* ---------------- Badge ---------------- */

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-smoke px-3 py-1 text-xs font-medium text-platinum ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------------- Status badge ---------------- */

const STATUS_META: Record<AccessibilityStatus, { label: string; icon: ReactNode; className: string }> = {
  accessible: {
    label: "Accessible",
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    className: "bg-status-accessible/15 text-status-accessible",
  },
  inaccessible: {
    label: "Inaccessible",
    icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
    className: "bg-status-inaccessible/15 text-status-inaccessible",
  },
  unknown: {
    label: "Unknown",
    icon: <HelpCircle className="h-4 w-4" aria-hidden="true" />,
    className: "bg-status-unknown/15 text-status-unknown",
  },
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: AccessibilityStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.className} ${className}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: "info" | "warning" | "blocked" }) {
  if (severity === "blocked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-status-warning/15 px-3 py-1 text-xs font-semibold text-status-warning">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Temporarily blocked
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-status-warning/15 px-3 py-1 text-xs font-semibold text-status-warning">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Reported
      </span>
    );
  }
  return null;
}

/* ---------------- Source badge ---------------- */

const SOURCE_COLORS: Record<EvidenceSource, string> = {
  institutional: "bg-link-blue/15 text-link-blue",
  osm: "bg-platinum/15 text-platinum",
  community: "bg-status-warning/15 text-status-warning",
  ai: "bg-ember/20 text-ember",
};

export function SourceBadge({ source }: { source: EvidenceSource }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_COLORS[source]}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}

/* ---------------- Score ring ---------------- */

export function ScoreRing({
  value,
  label,
  size = 96,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  const color =
    value >= 75 ? "var(--color-status-accessible)" : value >= 50 ? "var(--color-status-warning)" : "var(--color-status-inaccessible)";

  return (
    <div
      role="img"
      aria-label={`${label}: ${value} out of 100`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#333336"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold text-silk">{value}</span>
        <span className="text-[10px] uppercase tracking-wide text-ash">{label}</span>
      </div>
    </div>
  );
}

/* ---------------- Progress bar ---------------- */

export function ProgressBar({
  value,
  label,
  className = "",
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-ash">
          <span>{label}</span>
          <span>{formatPercent(value)}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="h-2 w-full overflow-hidden rounded-full bg-smoke"
      >
        <div
          className="h-full rounded-full bg-apple-blue transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- Spinner ---------------- */

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-ash" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-link-blue" aria-hidden="true" />
      {label}
    </div>
  );
}

/* ---------------- Toggle (switch) ---------------- */

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <label htmlFor={id} className="text-base font-medium text-silk">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-ash">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-pill transition-colors ${
          checked ? "bg-apple-blue" : "bg-smoke"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
            checked ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

/* ---------------- Select ---------------- */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

export function Select({ label, children, id, className = "", ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div>
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-silk">
        {label}
      </label>
      <select
        id={selectId}
        className={`w-full rounded-input border border-graphite bg-charcoal px-5 py-3 text-base text-silk focus:border-link-blue ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

/* ---------------- Text field ---------------- */

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, id, className = "", ...props }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-silk">
        {label}
      </label>
      <input
        id={fieldId}
        className={`w-full rounded-input border border-graphite bg-charcoal px-5 py-3 text-base text-silk placeholder:text-ash focus:border-link-blue ${className}`}
        {...props}
      />
      {hint && <p className="mt-1 text-xs text-ash">{hint}</p>}
    </div>
  );
}

/* ---------------- Textarea ---------------- */

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function TextArea({ label, hint, id, className = "", ...props }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-silk">
        {label}
      </label>
      <textarea
        id={fieldId}
        className={`w-full rounded-card-sm border border-graphite bg-charcoal px-5 py-3 text-base text-silk placeholder:text-ash focus:border-link-blue ${className}`}
        {...props}
      />
      {hint && <p className="mt-1 text-xs text-ash">{hint}</p>}
    </div>
  );
}

/* ---------------- Modal (accessible dialog) ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-card bg-charcoal p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl font-semibold text-silk">
            {title}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-full bg-smoke p-2 text-ash hover:text-silk"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Misc ---------------- */

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-smoke px-3 py-1 text-xs font-medium text-platinum">
      {children}
    </span>
  );
}

export function CheckIcon({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-status-accessible">
      <Check className="h-4 w-4" aria-hidden="true" />
      {label}
    </span>
  );
}