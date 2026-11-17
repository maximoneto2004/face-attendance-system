import Link from "next/link";
import { Badge, Card, EmptyState, ProgressBar, buttonClass, formatRelativeDateTime, plural } from "./ui";
import { Icon } from "./icons";

export type SessionRow = {
  id: string;
  takenAt: Date;
  createdAt: Date;
  status: "REVIEW" | "CONFIRMED";
  facesDetected: number;
  recognizedCount: number;
  classroom: { id: string; name: string };
  _count: { attendances: number };
  presentCount: number;
};

function StatusBadge({ status }: { status: SessionRow["status"] }) {
  return status === "CONFIRMED" ? (
    <Badge tone="green" icon="check">
      Confirmada
    </Badge>
  ) : (
    <Badge tone="amber" icon="clock">
      Aguardando revisão
    </Badge>
  );
}

function Presence({ s }: { s: SessionRow }) {
  if (s.status !== "CONFIRMED") return <span className="text-sm text-slate-400">—</span>;
  const total = s._count.attendances;
  return (
    <div className="min-w-28">
      <p className="text-sm tabular-nums">
        <span className="font-semibold text-slate-900">{s.presentCount}</span>
        <span className="text-slate-500"> de {total}</span>
      </p>
      <ProgressBar value={s.presentCount} max={total} tone="green" className="mt-1.5 h-1.5" label="Presença" />
    </div>
  );
}

export function SessionsTable({
  sessions,
  showClassroom = true,
  emptyAction,
}: {
  sessions: SessionRow[];
  showClassroom?: boolean;
  emptyAction?: React.ReactNode;
}) {
  if (sessions.length === 0) {
    return (
      <EmptyState icon="history" title="Nenhuma chamada por aqui" action={emptyAction}>
        As chamadas realizadas aparecerão nesta lista.
      </EmptyState>
    );
  }
  return (
    <>
      {/* Celular: lista de cartões tocáveis */}
      <ul className="space-y-3 md:hidden">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={`/attendance/${s.id}`}
              className={`block rounded-2xl border bg-white p-4 shadow-xs active:bg-slate-50 ${
                s.status === "REVIEW" ? "border-amber-300" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {showClassroom && <p className="truncate font-semibold text-slate-900">{s.classroom.name}</p>}
                  <p className="text-sm text-slate-500">{formatRelativeDateTime(s.takenAt)}</p>
                </div>
                <Icon name="chevronRight" className="mt-1 h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                {s.status === "CONFIRMED" ? <Presence s={s} /> : <StatusBadge status={s.status} />}
                <span className="text-xs text-slate-500">{plural(s.facesDetected, "rosto", "rostos")}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet/desktop: tabela */}
      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Data</th>
              {showClassroom && <th scope="col" className="px-5 py-3 font-medium">Turma</th>}
              <th scope="col" className="px-5 py-3 font-medium">Presença</th>
              <th scope="col" className="hidden px-5 py-3 font-medium xl:table-cell">Reconhecimento</th>
              <th scope="col" className="px-5 py-3 font-medium">Situação</th>
              <th scope="col" className="px-5 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <tr key={s.id} className="group hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-5 py-3.5">
                  <Link href={`/attendance/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                    {formatRelativeDateTime(s.takenAt)}
                  </Link>
                </td>
                {showClassroom && <td className="px-5 py-3.5 text-slate-700">{s.classroom.name}</td>}
                <td className="px-5 py-3.5">
                  <Presence s={s} />
                </td>
                <td className="hidden px-5 py-3.5 text-slate-600 xl:table-cell">
                  {plural(s.facesDetected, "rosto", "rostos")}
                  <span className="block text-xs text-slate-400">
                    {s.recognizedCount} {s.recognizedCount === 1 ? "automático" : "automáticos"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/attendance/${s.id}`}
                    className={s.status === "REVIEW" ? buttonClass("primary", "sm") : buttonClass("ghost", "sm")}
                  >
                    {s.status === "REVIEW" ? "Revisar" : "Ver"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
