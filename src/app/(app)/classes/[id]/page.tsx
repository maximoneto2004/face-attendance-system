import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, BackLink, Card, EmptyState, PageHeader, buttonStyles } from "@/components/ui";
import { AddStudentsForm, CreateStudentsForm, EditClassroomForm } from "../forms";
import { removeStudentFromClassroom } from "../actions";

export default async function ClassroomPage({ params }: PageProps<"/classes/[id]">) {
  await requireUser();
  const { id } = await params;
  const classroom = await db.classroom.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
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
  const otherStudents = await db.student.findMany({
    where: { active: true, id: { notIn: memberIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const withFace = classroom.students.filter((s) => s.student._count.faceIdentities > 0).length;

  return (
    <>
      <BackLink href="/classes">Turmas</BackLink>
      <PageHeader
        title={classroom.name}
        description={`${classroom.students.length} aluno(s) · ${withFace} com rosto cadastrado`}
        actions={
          <Link href={`/attendance/new?classroomId=${classroom.id}`} className={buttonStyles.primary}>
            Fazer chamada
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <h2 className="mb-4 font-medium">Alunos da turma</h2>
          {classroom.students.length === 0 ? (
            <EmptyState>Nenhum aluno nesta turma. Adicione alunos ao lado.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {classroom.students.map(({ student }) => (
                <li key={student.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/students/${student.id}`} className="text-sm font-medium hover:underline">
                      {student.name}
                    </Link>
                    {student._count.faceIdentities > 0 ? <Badge tone="green">Rosto cadastrado</Badge> : <Badge>Sem rosto</Badge>}
                    {!student.active && <Badge tone="red">Inativo</Badge>}
                  </div>
                  <form action={removeStudentFromClassroom}>
                    <input type="hidden" name="classroomId" value={classroom.id} />
                    <input type="hidden" name="studentId" value={student.id} />
                    <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                      Remover
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-medium">Cadastrar novos alunos</h2>
            <CreateStudentsForm classroomId={classroom.id} />
          </Card>
          <Card>
            <h2 className="mb-3 font-medium">Adicionar alunos já cadastrados</h2>
            <AddStudentsForm classroomId={classroom.id} students={otherStudents} />
          </Card>
          <Card>
            <h2 className="mb-3 font-medium">Dados da turma</h2>
            <EditClassroomForm classroom={classroom} />
          </Card>
        </div>
      </div>
    </>
  );
}
