import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listSessions } from "@/lib/sessions";
import { classroomScope, isAdmin, sessionScope, studentScope } from "@/lib/access";
import { ABSENCE_STREAK, listAbsenceAlerts } from "@/lib/absences";
import {
  Avatar,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionTitle,
  StatCard,
  buttonClass,
  formatRate,
  formatRelativeDateTime,
  formatWeekday,
  plural,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { SessionsTable } from "@/components/sessions-table";
import { PendingReviews } from "@/components/pending-reviews";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const [students, studentsWithFace, classrooms, pending, recent, presentLast30, totalLast30, absenceAlerts] = await Promise.all([
    db.student.count({ where: { active: true, ...studentScope(user) } }),
    db.student.count({ where: { active: true, faceIdentities: { some: {} }, ...studentScope(user) } }),
    db.classroom.findMany({
      where: { active: true, ...classroomScope(user) },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { students: { where: { student: { active: true } } } } },
        attendanceSessions: { orderBy: { takenAt: "desc" }, take: 1, select: { takenAt: true } },
      },
    }),
    listSessions(20, { status: "REVIEW", scope: sessionScope(user) }),
    listSessions(6, { scope: sessionScope(user) }),
    db.attendance.count({ where: { present: true, session: { takenAt: { gte: since }, ...sessionScope(user) } } }),
    db.attendance.count({ where: { session: { takenAt: { gte: since }, ...sessionScope(user) } } }),
    listAbsenceAlerts(user),
  ]);

  const firstName = user.name.trim().split(/\s+/)[0];
  const weekday = formatWeekday(now);

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description={<span className="first-letter:uppercase">{weekday}</span>}
        actions={
          // No celular, a ação principal já está na barra inferior.
          <div className="hidden lg:block">
            <Link href="/attendance/new" className={buttonClass("primary")}>
              <Icon name="camera" className="h-5 w-5" />
              Nova chamada
            </Link>
          </div>
        }
      />

      <PendingReviews sessions={pending} now={now} />

      <section className="mb-8" aria-labelledby="quick-start">
        <SectionTitle
          action={
            classrooms.length > 0 && (
              <Link href="/classes" className="text-sm font-medium text-brand-600 hover:underline">
                Ver turmas
              </Link>
            )
          }
        >
          <span id="quick-start">Fazer chamada</span>
        </SectionTitle>
        {classrooms.length === 0 ? (
          <EmptyState
            icon="layers"
            title="Nenhuma turma ativa"
            action={
              <Link href="/classes" className={buttonClass("primary")}>
                <Icon name="plus" className="h-4 w-4" />
                Criar turma
              </Link>
            }
          >
            Crie uma turma (por exemplo, “Dança — Terça 14h”) e adicione os alunos para começar a fazer chamadas.
            {!isAdmin(user) && " Se a sua turma já existe, peça à coordenação para colocá-la no seu nome."}
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {classrooms.map((c) => {
              const last = c.attendanceSessions[0]?.takenAt;
              const empty = c._count.students === 0;
              return (
                <li key={c.id}>
                  <Link
                    href={empty ? `/classes/${c.id}` : `/attendance/new?classroomId=${c.id}`}
                    className="group flex h-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-brand-300 hover:shadow-sm active:bg-slate-50"
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                        empty ? "bg-slate-100 text-slate-400" : "bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white"
                      } transition-colors`}
                    >
                      <Icon name={empty ? "userPlus" : "camera"} className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{c.name}</span>
                      <span className="block text-sm text-slate-500">
                        {empty ? "Adicione alunos para começar" : plural(c._count.students, "aluno", "alunos")}
                      </span>
                      {!empty && (
                        <span className="block text-xs text-slate-400">
                          {last ? `Última chamada: ${formatRelativeDateTime(last, now)}` : "Nenhuma chamada ainda"}
                        </span>
                      )}
                    </span>
                    <Icon name="chevronRight" className="h-5 w-5 text-slate-300 group-hover:text-brand-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Indicadores">
        <StatCard label="Alunos ativos" value={students} icon="users" href="/students" />
        <StatCard label="Turmas ativas" value={classrooms.length} icon="layers" href="/classes" />
        <StatCard
          label="Presença (30 dias)"
          value={formatRate(presentLast30, totalLast30)}
          icon="checkCircle"
          hint={totalLast30 > 0 ? `${presentLast30} de ${totalLast30} registros` : "Sem chamadas no período"}
        />
        <StatCard
          label="Reconhecimento facial"
          value={formatRate(studentsWithFace, students)}
          icon="scan"
          hint={`${studentsWithFace} de ${students} alunos com rosto cadastrado`}
        >
          <ProgressBar value={studentsWithFace} max={students} className="mt-3" label="Alunos com rosto cadastrado" />
        </StatCard>
      </section>

      {absenceAlerts.length > 0 && (
        <section className="mb-8" aria-labelledby="absences">
          <SectionTitle>
            <span id="absences">Alunos faltando seguido</span>
          </SectionTitle>
          <Card className="p-0">
            <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-5">
              Faltaram às últimas {ABSENCE_STREAK} chamadas da turma. Vale um contato com a família.
            </p>
            <ul className="divide-y divide-slate-100">
              {absenceAlerts.slice(0, 8).map((a) => (
                <li key={`${a.classroomId}:${a.studentId}`}>
                  <Link
                    href={`/students/${a.studentId}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 sm:px-5"
                  >
                    <Avatar name={a.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{a.name}</span>
                      <span className="block truncate text-xs text-slate-500">{a.classroomName}</span>
                    </span>
                    <Icon name="chevronRight" className="h-4 w-4 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
            {absenceAlerts.length > 8 && (
              <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
                E mais {absenceAlerts.length - 8}. Veja a página de cada turma.
              </p>
            )}
          </Card>
        </section>
      )}

      <section aria-labelledby="recent">
        <SectionTitle
          action={
            recent.length > 0 && (
              <Link href="/attendance" className="text-sm font-medium text-brand-600 hover:underline">
                Ver histórico
              </Link>
            )
          }
        >
          <span id="recent">Chamadas recentes</span>
        </SectionTitle>
        <SessionsTable sessions={recent} />
      </section>
    </>
  );
}
