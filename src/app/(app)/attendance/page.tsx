import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listSessions } from "@/lib/sessions";
import { classroomScope, sessionScope } from "@/lib/access";
import { PageHeader, buttonClass, plural } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SessionsTable } from "@/components/sessions-table";
import { PendingReviews } from "@/components/pending-reviews";

export default async function AttendanceHistoryPage({ searchParams }: PageProps<"/attendance">) {
  const user = await requireUser();
  const { turma } = await searchParams;
  const classrooms = await db.classroom.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    where: { attendanceSessions: { some: {} }, ...classroomScope(user) },
    select: { id: true, name: true },
  });
  const selected = typeof turma === "string" ? classrooms.find((c) => c.id === turma) : undefined;
  const [pending, sessions] = await Promise.all([
    listSessions(20, { status: "REVIEW", classroomId: selected?.id, scope: sessionScope(user) }),
    listSessions(200, { status: "CONFIRMED", classroomId: selected?.id, scope: sessionScope(user) }),
  ]);

  const chip = (active: boolean) =>
    `inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors ${
      active
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
    }`;

  return (
    <>
      <PageHeader
        title="Histórico de chamadas"
        description={
          selected
            ? `${plural(sessions.length, "chamada confirmada", "chamadas confirmadas")} em ${selected.name}`
            : plural(sessions.length, "chamada confirmada", "chamadas confirmadas")
        }
        actions={
          <Link
            href={selected ? `/attendance/new?classroomId=${selected.id}` : "/attendance/new"}
            className={buttonClass("primary")}
          >
            <Icon name="camera" className="h-5 w-5" />
            Nova chamada
          </Link>
        }
      />

      {classrooms.length > 1 && (
        <nav aria-label="Filtrar por turma" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 pb-1 sm:flex-wrap">
            <Link href="/attendance" className={chip(!selected)} aria-current={!selected ? "true" : undefined}>
              Todas as turmas
            </Link>
            {classrooms.map((c) => (
              <Link
                key={c.id}
                href={`/attendance?turma=${c.id}`}
                className={chip(selected?.id === c.id)}
                aria-current={selected?.id === c.id ? "true" : undefined}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <PendingReviews sessions={pending} now={new Date()} />
      <SessionsTable sessions={sessions} showClassroom={!selected} />
    </>
  );
}
