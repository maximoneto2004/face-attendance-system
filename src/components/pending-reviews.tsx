import Link from "next/link";
import { STALE_REVIEW_MS } from "@/lib/config";
import type { SessionRow } from "./sessions-table";
import { Alert, buttonClass, formatRelativeDateTime, formatTime } from "./ui";
import { Icon } from "./icons";

// Chamadas que ainda não foram confirmadas — são descartadas após 24 h.
export function PendingReviews({ sessions, now }: { sessions: SessionRow[]; now: Date }) {
  const pending = sessions.filter((s) => s.status === "REVIEW");
  if (pending.length === 0) return null;

  return (
    <Alert
      tone="warning"
      className="mb-6 sm:items-start"
      title={pending.length === 1 ? "1 chamada aguardando sua revisão" : `${pending.length} chamadas aguardando sua revisão`}
    >
      <p>As presenças só são registradas após a confirmação. Chamadas não revisadas são descartadas em 24 horas.</p>
      <ul className="mt-3 space-y-2">
        {pending.map((s) => {
          const expiresAt = new Date(s.createdAt.getTime() + STALE_REVIEW_MS);
          const hoursLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 3_600_000));
          return (
            <li key={s.id}>
              <Link
                href={`/attendance/${s.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-slate-800 hover:border-amber-300 hover:bg-amber-50/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.classroom.name}</span>
                  <span className="block text-xs text-slate-500">
                    {formatRelativeDateTime(s.takenAt, now)} · expira {hoursLeft < 1 ? "em menos de 1 h" : `às ${formatTime(expiresAt)}`}
                  </span>
                </span>
                <span className={buttonClass("primary", "sm", "shrink-0")}>
                  Revisar
                  <Icon name="chevronRight" className="h-4 w-4" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Alert>
  );
}
