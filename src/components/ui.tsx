import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// ---------------------------------------------------------------------------
// Botões e campos
// Áreas de toque de no mínimo 44px (h-11) nas ações principais.
// ---------------------------------------------------------------------------

const buttonBase =
  "inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const buttonSizes = {
  md: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-sm",
  lg: "h-12 px-5 text-base",
};

const buttonVariants = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50 active:bg-red-100",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
};

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return `${buttonBase} ${buttonSizes[size]} ${buttonVariants[variant]} ${extra}`;
}

// Mantido por compatibilidade com o código existente.
export const buttonStyles = {
  primary: buttonClass("primary"),
  secondary: buttonClass("secondary"),
  danger: buttonClass("danger"),
  link: "text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline",
};

// text-base no celular evita o zoom automático do iOS ao focar o campo.
export const inputStyles =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:bg-slate-50 sm:text-sm";

export const checkboxStyles = "h-5 w-5 shrink-0 rounded border-slate-300 accent-brand-600";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Estrutura de página
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
  back,
  leading,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  leading?: ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {back && <BackLink href={back.href}>{back.label}</BackLink>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
            {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
          </div>
        </div>
        {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
      </div>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 mb-2 inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    >
      <Icon name="chevronLeft" className="h-4 w-4" />
      {children}
    </Link>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-xs ${className}`} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-900">{children}</h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

const badgeTones = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  indigo: "bg-brand-50 text-brand-700 ring-brand-200",
};

export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "slate", icon, children }: { tone?: BadgeTone; icon?: IconName; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone]}`}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  href?: string;
  children?: ReactNode;
}) {
  const content = (
    <Card className={`h-full p-4 sm:p-5 ${href ? "transition hover:border-brand-300 hover:shadow-sm" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <Icon name={icon} className="h-5 w-5 text-slate-400" />}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children}
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl">
      {content}
    </Link>
  ) : (
    content
  );
}

const progressTones = {
  brand: "bg-brand-600",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
};

export function ProgressBar({
  value,
  max,
  tone = "brand",
  label,
  className = "",
}: {
  value: number;
  max: number;
  tone?: keyof typeof progressTones;
  label?: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}
    >
      <div className={`h-full rounded-full transition-all ${progressTones[tone]}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

// Iniciais coloridas no lugar de fotos: identificam o aluno sem expor dado biométrico.
const avatarColors = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${avatarColors[hash % avatarColors.length]}`}
    >
      {initials || "?"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

const alertTones = {
  info: { box: "border-brand-200 bg-brand-50 text-brand-900", icon: "info" as IconName, iconColor: "text-brand-600" },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: "checkCircle" as IconName, iconColor: "text-emerald-600" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: "alert" as IconName, iconColor: "text-amber-600" },
  error: { box: "border-red-200 bg-red-50 text-red-900", icon: "xCircle" as IconName, iconColor: "text-red-600" },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: {
  tone?: keyof typeof alertTones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = alertTones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center ${t.box} ${className}`}
    >
      <div className="flex flex-1 items-start gap-3">
        <Icon name={t.icon} className={`mt-0.5 h-5 w-5 ${t.iconColor}`} />
        <div className="min-w-0 flex-1">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 pl-8 sm:pl-0">{action}</div>}
    </div>
  );
}

export function ErrorMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Alert tone="error">{message}</Alert>;
}

export function SuccessMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
      <Icon name="checkCircle" className="h-4 w-4" />
      {message}
    </p>
  );
}

export function EmptyState({
  children,
  title,
  icon,
  action,
}: {
  children?: ReactNode;
  title?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      {icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Icon name={icon} className="h-6 w-6" />
        </span>
      )}
      {title && <p className="font-semibold text-slate-800">{title}</p>}
      {children && <div className={`max-w-md text-sm text-slate-500 ${title ? "mt-1" : ""}`}>{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const TIME_ZONE = "America/Sao_Paulo";

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE }).format(date);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: TIME_ZONE })
    .format(date)
    .replaceAll(" de ", " ")
    .replace(".", ""); // "15 de out. de 2026" -> "15 out 2026"
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: TIME_ZONE }).format(date);
}

export function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE }).format(date);
}

// "hoje, 14:30" / "ontem, 09:00" / "12 nov 2026, 10:00"
export function formatRelativeDateTime(date: Date, now = new Date()) {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (day(date) === day(now)) return `hoje, ${formatTime(date)}`;
  if (day(date) === day(yesterday)) return `ontem, ${formatTime(date)}`;
  return `${formatDate(date)}, ${formatTime(date)}`;
}

export function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function formatRate(part: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

// plural(1, "aluno", "alunos") -> "1 aluno"; plural(3, ...) -> "3 alunos"
export function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
