import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BackLink, Card, PageHeader, formatDateTime } from "@/components/ui";
import { EditStudentForm, RemoveFaceIdentityForm } from "./forms";

export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  await requireUser();
  const { id } = await params;
  const student = await db.student.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      createdAt: true,
      classrooms: { select: { classroom: { select: { id: true, name: true } } } },
      faceIdentities: { select: { createdAt: true }, orderBy: { createdAt: "asc" } },
      _count: { select: { attendances: { where: { present: true } } } },
    },
  });
  if (!student) notFound();

  const faceCount = student.faceIdentities.length;

  return (
    <>
      <BackLink href="/students">Alunos</BackLink>
      <PageHeader title={student.name} description={`Cadastrado em ${formatDateTime(student.createdAt)}`} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium">Dados</h2>
          <EditStudentForm student={student} />
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 font-medium">Identidade facial</h2>
            {faceCount > 0 ? (
              <>
                <p className="text-sm text-slate-600">
                  {faceCount} rosto(s) cadastrado(s) no reconhecimento facial. O primeiro foi confirmado em{" "}
                  {formatDateTime(student.faceIdentities[0]!.createdAt)}.
                </p>
                <RemoveFaceIdentityForm studentId={student.id} />
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Nenhum rosto cadastrado. O rosto é cadastrado quando o professor identifica este aluno na revisão de
                uma chamada.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-medium">Turmas</h2>
            {student.classrooms.length === 0 ? (
              <p className="text-sm text-slate-500">Não pertence a nenhuma turma.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {student.classrooms.map(({ classroom }) => (
                  <li key={classroom.id}>
                    <Link href={`/classes/${classroom.id}`} className="text-indigo-600 hover:underline">
                      {classroom.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm text-slate-500">Presenças registradas: {student._count.attendances}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
