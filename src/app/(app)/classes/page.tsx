import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { classroomScope, isAdmin } from "@/lib/access";
import { Alert, Badge, Card, EmptyState, PageHeader, buttonClass, formatRelativeDateTime, plural } from "@/components/ui";
import { Icon } from "@/components/icons";
import { CreateClassroomForm } from "./forms";

export default async function ClassesPage({ searchParams }: PageProps<"/classes">) {
  const user = await requireUser();
  const admin = isAdmin(user);
  const { nova } = await searchParams;
  const classrooms = await db.classroom.findMany({
    where: classroomScope(user),
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      teacher: { select: { name: true } },
      _count: { select: { students: { where: { student: { active: true } } }, attendanceSessions: true } },
      attendanceSessions: { orderBy: { takenAt: "desc" }, take: 1, select: { takenAt: true } },
    },
  });
  const showCreate = nova !== undefined || classrooms.length === 0;
  const teachers = admin
    ? await db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    : undefined;
  const unassigned = admin ? classrooms.filter((c) => !c.teacher).length : 0;

  return (
    <>
      <PageHeader
        title="Turmas"
        description={
          admin
            ? "Todas as turmas do projeto. Cada professor vê só as turmas pelas quais é responsável."
            : "Suas turmas. Cada turma corresponde a uma modalidade ou horário de atividade."
        }
        actions={
          !showCreate && (
            <Link href="/classes?nova" className={buttonClass("primary")}>
              <Icon name="plus" className="h-4 w-4" />
              Nova turma
            </Link>
          )
        }
      />

      {showCreate && (
        <Card className="mb-6 border-brand-200">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Nova turma</h2>
            {classrooms.length > 0 && (
              <Link href="/classes" aria-label="Fechar" className={buttonClass("ghost", "sm", "-mt-1 -mr-2 px-2")}>
                <Icon name="x" className="h-5 w-5" />
              </Link>
            )}
          </div>
          <CreateClassroomForm teachers={teachers} />
        </Card>
      )}

      {unassigned > 0 && (
        <Alert tone="warning" className="mb-6" title={`${plural(unassigned, "turma está", "turmas estão")} sem professor responsável`}>
          Turmas sem professor só aparecem para a coordenação. Abra a turma, vá em “Configurações da turma” e escolha o
          professor.
        </Alert>
      )}

      {classrooms.length === 0 ? (
        <EmptyState icon="layers" title={admin ? "Nenhuma turma cadastrada ainda" : "Você ainda não tem turmas"}>
          Crie a primeira turma acima. Depois, adicione os alunos e faça a chamada com uma foto.
          {!admin && " Se a sua turma já existe, peça à coordenação para colocá-la no seu nome."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classrooms.map((c) => {
            const last = c.attendanceSessions[0]?.takenAt;
            return (
              <li key={c.id}>
                <Card className={`flex h-full flex-col p-0 ${c.active ? "" : "bg-slate-50"}`}>
                  <Link href={`/classes/${c.id}`} className="block flex-1 rounded-t-2xl p-5 hover:bg-slate-50/70">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{c.name}</h3>
                      {!c.active && <Badge>Inativa</Badge>}
                    </div>
                    {admin && (
                      <p className="mt-1 text-xs font-medium">
                        {c.teacher ? (
                          <span className="text-slate-600">Professor: {c.teacher.name}</span>
                        ) : (
                          <span className="text-amber-700">Sem professor responsável</span>
                        )}
                      </p>
                    )}
                    {c.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Icon name="users" className="h-4 w-4 text-slate-400" />
                        {plural(c._count.students, "aluno", "alunos")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icon name="history" className="h-4 w-4 text-slate-400" />
                        {plural(c._count.attendanceSessions, "chamada", "chamadas")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {last ? `Última chamada: ${formatRelativeDateTime(last)}` : "Nenhuma chamada ainda"}
                    </p>
                  </Link>
                  {c.active && (
                    <div className="flex gap-2 border-t border-slate-100 p-3">
                      <Link
                        href={c._count.students > 0 ? `/attendance/new?classroomId=${c.id}` : `/classes/${c.id}`}
                        className={buttonClass(c._count.students > 0 ? "primary" : "secondary", "sm", "flex-1")}
                      >
                        <Icon name={c._count.students > 0 ? "camera" : "userPlus"} className="h-4 w-4" />
                        {c._count.students > 0 ? "Fazer chamada" : "Adicionar alunos"}
                      </Link>
                      <Link href={`/classes/${c.id}`} className={buttonClass("ghost", "sm")}>
                        Gerenciar
                      </Link>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
