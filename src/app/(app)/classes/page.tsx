import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { CreateClassroomForm } from "./forms";

export default async function ClassesPage() {
  await requireUser();
  const classrooms = await db.classroom.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      _count: { select: { students: true, attendanceSessions: true } },
    },
  });

  return (
    <>
      <PageHeader title="Turmas" />
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-medium">Nova turma</h2>
        <CreateClassroomForm />
      </Card>

      {classrooms.length === 0 ? (
        <EmptyState>Nenhuma turma cadastrada ainda.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((c) => (
            <Link key={c.id} href={`/classes/${c.id}`}>
              <Card className="h-full transition hover:border-indigo-300">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{c.name}</h3>
                  {!c.active && <Badge>Inativa</Badge>}
                </div>
                {c.description && <p className="mt-1 text-sm text-slate-500">{c.description}</p>}
                <p className="mt-3 text-sm text-slate-600">
                  {c._count.students} aluno(s) · {c._count.attendanceSessions} chamada(s)
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
