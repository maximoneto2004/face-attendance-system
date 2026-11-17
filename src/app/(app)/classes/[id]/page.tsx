import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { classroomScope, isAdmin } from "@/lib/access";
import { listSessions } from "@/lib/sessions";
import { ABSENCE_STREAK, listAbsenceAlerts } from "@/lib/absences";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionTitle,
  StatCard,
  buttonClass,
  formatRate,
  plural,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { SessionsTable } from "@/components/sessions-table";
import { AddStudentsPanel, EditClassroomForm } from "../forms";
import { removeStudentFromClassroom } from "../actions";

export default async function ClassroomPage({ params }: PageProps<"/classes/[id]">) {
  const user = await requireUser();
  const admin = isAdmin(user);
  const { id } = await params;
  const classroom = await db.classroom.findFirst({
    where: { id, ...classroomScope(user) },
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      teacherId: true,
      teacher: { select: { name: true } },
      students: {
        orderBy: { student: { name: "asc" } },
        select: {
          student: {
            select: { id: true, name: true, active: true, _count: { select: { faceIdentities: true } } },
          },
        },
      },
    },
  });
  if (!classroom) notFound();

  const memberIds = classroom.students.map((s) => s.student.id);
  const teachers = admin
    ? await db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    : undefined;
  const [otherStudents, attendanceStats, sessionCount, recentSessions, absenceAlerts] = await Promise.all([
    db.student.findMany({
      where: { active: true, id: { notIn: memberIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Frequência de cada aluno nas chamadas confirmadas desta turma.
    db.attendance.groupBy({
      by: ["studentId", "present"],
      where: { session: { classroomId: id } },
      _count: true,
    }),
    db.attendanceSession.count({ where: { classroomId: id, status: "CONFIRMED" } }),
    listSessions(5, { classroomId: id }),
    listAbsenceAlerts(user, id),
  ]);
  const missing = new Set(absenceAlerts.map((a) => a.studentId));
  const months = reportMonths(new Date());

  const stats = new Map<string, { present: number; total: number }>();
  let presentTotal = 0;
  let recordsTotal = 0;
  for (const row of attendanceStats) {
    const s = stats.get(row.studentId) ?? { present: 0, total: 0 };
    s.total += row._count;
    recordsTotal += row._count;
    if (row.present) {
      s.present += row._count;
      presentTotal += row._count;
    }
    stats.set(row.studentId, s);
  }
  const activeMembers = classroom.students.filter((s) => s.student.active);
  const withFace = activeMembers.filter((s) => s.student._count.faceIdentities > 0).length;

  return (
    <>
      <PageHeader
        back={{ href: "/classes", label: "Turmas" }}
        title={classroom.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {!classroom.active && <Badge>Inativa</Badge>}
            {admin &&
              (classroom.teacher ? (
                <Badge tone="indigo">Professor: {classroom.teacher.name}</Badge>
              ) : (
                <Badge tone="amber">Sem professor</Badge>
              ))}
            {classroom.description}
          </span>
        }
        actions={
          classroom.active && activeMembers.length > 0 ? (
            <Link href={`/attendance/new?classroomId=${classroom.id}`} className={buttonClass("primary")}>
              <Icon name="camera" className="h-5 w-5" />
              Fazer chamada
            </Link>
          ) : undefined
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Indicadores da turma">
        <StatCard label="Alunos ativos" value={activeMembers.length} icon="users" />
        <StatCard label="Chamadas" value={sessionCount} icon="history" />
        <StatCard label="Presença média" value={formatRate(presentTotal, recordsTotal)} icon="checkCircle" />
        <StatCard label="Com rosto cadastrado" value={`${withFace}/${activeMembers.length}`} icon="scan">
          <ProgressBar value={withFace} max={activeMembers.length} className="mt-3" label="Alunos com rosto cadastrado" />
        </StatCard>
      </section>

      {absenceAlerts.length > 0 && (
        <Alert tone="warning" className="mb-6" title={`${plural(absenceAlerts.length, "aluno faltou", "alunos faltaram")} às últimas ${ABSENCE_STREAK} chamadas`}>
          {absenceAlerts.map((a) => a.name).join(", ")}. Vale entrar em contato com a família para saber se está tudo bem.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Card className="p-0">
            <div className="p-5 pb-0">
              <CardHeader
                title={`Alunos da turma (${classroom.students.length})`}
                description={recordsTotal > 0 ? "Frequência considerando as chamadas confirmadas desta turma." : undefined}
              />
            </div>
            {classroom.students.length === 0 ? (
              <div className="p-5 pt-0">
                <EmptyState icon="userPlus" title="Nenhum aluno nesta turma">
                  Use o painel “Adicionar alunos” para incluir os participantes.
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {classroom.students.map(({ student }) => {
                  const s = stats.get(student.id);
                  return (
                    <li key={student.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <Link href={`/students/${student.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 hover:text-brand-700">
                        <Avatar name={student.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{student.name}</span>
                          <span className="flex flex-wrap gap-1.5 pt-0.5">
                            {!student.active ? (
                              <Badge tone="red">Inativo</Badge>
                            ) : student._count.faceIdentities > 0 ? (
                              <Badge tone="green" icon="scan">
                                Rosto ok
                              </Badge>
                            ) : (
                              <Badge tone="amber">Sem rosto</Badge>
                            )}
                            {missing.has(student.id) && (
                              <Badge tone="red" icon="alert">
                                {ABSENCE_STREAK} faltas seguidas
                              </Badge>
                            )}
                          </span>
                        </span>
                      </Link>
                      <span className="w-16 shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums text-slate-800">
                          {s ? formatRate(s.present, s.total) : "—"}
                        </span>
                        {s && <span className="block text-[11px] text-slate-400">{s.present}/{s.total}</span>}
                      </span>
                      <form action={removeStudentFromClassroom}>
                        <input type="hidden" name="classroomId" value={classroom.id} />
                        <input type="hidden" name="studentId" value={student.id} />
                        <SubmitButton
                          variant="ghost"
                          size="sm"
                          icon="x"
                          pendingText=""
                          ariaLabel={`Remover ${student.name} da turma`}
                          confirmMessage={`Remover ${student.name} desta turma? O cadastro do aluno e o histórico de presenças são mantidos.`}
                          className="w-10 px-0 text-slate-400 hover:text-red-600"
                        >
                          <span className="sr-only">Remover</span>
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <section>
            <SectionTitle
              action={
                recentSessions.length > 0 && (
                  <Link href={`/attendance?turma=${classroom.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    Ver todas
                  </Link>
                )
              }
            >
              Chamadas recentes
            </SectionTitle>
            <SessionsTable sessions={recentSessions} showClassroom={false} />
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader icon="userPlus" title="Adicionar alunos" />
            <AddStudentsPanel classroomId={classroom.id} students={otherStudents} />
          </Card>
          {sessionCount > 0 && (
            <Card>
              <CardHeader
                icon="download"
                title="Planilha de frequência"
                description="Abre no Excel ou Google Planilhas, com P/F por data e a frequência de cada aluno."
              />
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {months.map((m) => (
                  <a
                    key={m.label}
                    href={`/api/classes/${classroom.id}/frequencia${m.value ? `?mes=${m.value}` : ""}`}
                    download
                    className={buttonClass("secondary", "md", "w-full")}
                  >
                    <Icon name="download" className="h-4 w-4" />
                    {m.label}
                  </a>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-0">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-5 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Icon name="settings" className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-900">Configurações da turma</span>
                    <span className="block text-sm text-slate-500">
                      {admin ? "Nome, professor responsável e situação" : "Nome, descrição e situação"}
                    </span>
                  </span>
                </span>
                <Icon name="chevronDown" className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-slate-100 p-5">
                <EditClassroomForm classroom={classroom} teachers={teachers} />
              </div>
            </details>
          </Card>
          {activeMembers.length > withFace && (
            <p className="px-1 text-xs text-slate-500">
              {plural(activeMembers.length - withFace, "aluno ainda não tem", "alunos ainda não têm")} rosto cadastrado.
              Eles serão reconhecidos automaticamente depois de identificados na revisão de uma chamada.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// Mês atual, mês anterior e tudo — os recortes mais pedidos em relatórios.
function reportMonths(now: Date) {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(now)
    .split("-")
    .map(Number);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const name = (y: number, m: number) =>
    new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
  const pad = (m: number) => String(m).padStart(2, "0");
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  return [
    { label: cap(name(year, month)), value: `${year}-${pad(month)}` },
    { label: cap(name(prevYear, prevMonth)), value: `${prevYear}-${pad(prevMonth)}` },
    { label: "Todas", value: null },
  ];
}
