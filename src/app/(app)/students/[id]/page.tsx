import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { classroomScope, sessionScope, studentScope } from "@/lib/access";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  ProgressBar,
  StatCard,
  formatDate,
  formatDateTime,
  formatRate,
  formatRelativeDateTime,
  plural,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { EditStudentForm, RemoveFaceIdentityForm } from "./forms";

const HISTORY_SIZE = 20;

export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const student = await db.student.findFirst({
    where: { id, ...studentScope(user) },
    select: {
      id: true,
      name: true,
      active: true,
      createdAt: true,
      classrooms: { where: { classroom: classroomScope(user) }, select: { classroom: { select: { id: true, name: true } } } },
      faceIdentities: { select: { createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!student) notFound();

  const [presentCount, totalCount, history] = await Promise.all([
    // Frequência nas turmas que o usuário pode ver.
    db.attendance.count({ where: { studentId: id, present: true, session: sessionScope(user) } }),
    db.attendance.count({ where: { studentId: id, session: sessionScope(user) } }),
    db.attendance.findMany({
      where: { studentId: id, session: sessionScope(user) },
      orderBy: { session: { takenAt: "desc" } },
      take: HISTORY_SIZE,
      select: {
        present: true,
        session: { select: { id: true, takenAt: true, classroom: { select: { name: true } } } },
      },
    }),
  ]);

  const faceCount = student.faceIdentities.length;

  return (
    <>
      <PageHeader
        back={{ href: "/students", label: "Alunos" }}
        leading={<Avatar name={student.name} size="lg" />}
        title={student.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {student.active ? <Badge tone="indigo">Ativo</Badge> : <Badge>Inativo</Badge>}
            {faceCount > 0 ? (
              <Badge tone="green" icon="scan">
                Reconhecimento ativo
              </Badge>
            ) : (
              <Badge tone="amber">Sem rosto cadastrado</Badge>
            )}
            <span>Cadastrado em {formatDate(student.createdAt)}</span>
          </span>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" aria-label="Frequência">
        <StatCard label="Presenças" value={presentCount} icon="checkCircle" />
        <StatCard label="Faltas" value={totalCount - presentCount} icon="xCircle" />
        <div className="col-span-2 lg:col-span-1">
          <StatCard label="Frequência" value={formatRate(presentCount, totalCount)} hint={`em ${plural(totalCount, "chamada", "chamadas")}`}>
            <ProgressBar value={presentCount} max={totalCount} tone="green" className="mt-3" label="Frequência" />
          </StatCard>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title="Últimas chamadas"
            description={totalCount > HISTORY_SIZE ? `Mostrando as ${HISTORY_SIZE} mais recentes` : undefined}
          />
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">Este aluno ainda não participou de nenhuma chamada confirmada.</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {history.map((a) => (
                <li key={a.session.id}>
                  <Link
                    href={`/attendance/${a.session.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        a.present ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                      }`}
                    >
                      <Icon name={a.present ? "check" : "x"} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{a.session.classroom.name}</span>
                      <span className="block text-xs text-slate-500">{formatRelativeDateTime(a.session.takenAt)}</span>
                    </span>
                    {a.present ? <Badge tone="green">Presente</Badge> : <Badge tone="red">Ausente</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Dados do aluno" />
            <EditStudentForm student={student} />
          </Card>

          <Card>
            <CardHeader title="Turmas" />
            {student.classrooms.length === 0 ? (
              <p className="text-sm text-slate-500">
                Não pertence a nenhuma turma. Adicione-o pela página da turma.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {student.classrooms.map(({ classroom }) => (
                  <li key={classroom.id}>
                    <Link
                      href={`/classes/${classroom.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700"
                    >
                      <Icon name="layers" className="h-4 w-4 text-slate-400" />
                      {classroom.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon="shield" title="Identidade facial" />
            {faceCount > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  {plural(faceCount, "rosto cadastrado", "rostos cadastrados")} no reconhecimento facial. O primeiro foi
                  confirmado em {formatDateTime(student.faceIdentities[0]!.createdAt)}.
                </p>
                <div className="rounded-xl border border-red-100 bg-red-50/40 p-4">
                  <p className="mb-3 text-xs text-slate-600">
                    Use esta opção se o responsável pedir a exclusão dos dados biométricos ou se o aluno estiver sendo
                    reconhecido incorretamente. As presenças já registradas não são afetadas.
                  </p>
                  <RemoveFaceIdentityForm studentId={student.id} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Nenhum rosto cadastrado. O rosto é cadastrado quando você identifica este aluno na revisão de uma
                chamada — a partir daí, ele passa a ser reconhecido automaticamente.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
