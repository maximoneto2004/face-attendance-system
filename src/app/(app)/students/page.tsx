import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { CreateStudentForm } from "./create-student-form";

export default async function StudentsPage() {
  await requireUser();
  const students = await db.student.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      _count: { select: { faceIdentities: true } },
      classrooms: { select: { classroom: { select: { name: true } } } },
    },
  });

  return (
    <>
      <PageHeader title="Alunos" description={`${students.length} aluno(s) cadastrado(s)`} />
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-medium">Novo aluno</h2>
        <CreateStudentForm />
        <p className="mt-2 text-xs text-slate-500">
          Dica: para cadastrar vários alunos de uma vez, abra a turma e use “Cadastrar novos alunos”.
        </p>
      </Card>

      {students.length === 0 ? (
        <EmptyState>Nenhum aluno cadastrado ainda.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Turmas</th>
                <th className="px-5 py-3 font-medium">Identidade facial</th>
                <th className="px-5 py-3 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/students/${student.id}`} className="font-medium text-indigo-600 hover:underline">
                      {student.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {student.classrooms.map((c) => c.classroom.name).join(", ") || "—"}
                  </td>
                  <td className="px-5 py-3">
                    {student._count.faceIdentities > 0 ? (
                      <Badge tone="green">Cadastrada ({student._count.faceIdentities})</Badge>
                    ) : (
                      <Badge>Sem rosto</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">{student.active ? <Badge tone="indigo">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
