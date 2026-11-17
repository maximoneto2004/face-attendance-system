import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { classroomScope, isAdmin, sessionScope, studentScope } from "@/lib/access";
import { Card, CardHeader, PageHeader, plural } from "@/components/ui";
import { CreateStudentForm } from "./create-student-form";
import { StudentsDirectory } from "./students-directory";

export default async function StudentsPage() {
  const user = await requireUser();
  const [students, attendanceStats, myClassrooms] = await Promise.all([
    db.student.findMany({
      where: studentScope(user),
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        active: true,
        _count: { select: { faceIdentities: true } },
        classrooms: { where: { classroom: classroomScope(user) }, select: { classroom: { select: { name: true } } } },
      },
    }),
    db.attendance.groupBy({ by: ["studentId", "present"], where: { session: sessionScope(user) }, _count: true }),
    db.classroom.findMany({
      where: { active: true, ...classroomScope(user) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const stats = new Map<string, { present: number; total: number }>();
  for (const row of attendanceStats) {
    const s = stats.get(row.studentId) ?? { present: 0, total: 0 };
    s.total += row._count;
    if (row.present) s.present += row._count;
    stats.set(row.studentId, s);
  }
  const active = students.filter((s) => s.active).length;

  return (
    <>
      <PageHeader
        title="Alunos"
        description={`${plural(active, "aluno ativo", "alunos ativos")} · ${plural(students.length, "cadastrado", "cadastrados")} no total`}
      />
      <Card className="mb-6">
        <CardHeader
          icon="userPlus"
          title="Adicionar aluno"
          description="Para cadastrar vários de uma vez, abra a turma e use “Novos alunos”."
        />
        {!isAdmin(user) && myClassrooms.length === 0 ? (
          <p className="text-sm text-slate-500">Crie uma turma primeiro: todo aluno precisa estar em uma das suas turmas.</p>
        ) : (
          <CreateStudentForm classrooms={myClassrooms} classroomRequired={!isAdmin(user)} />
        )}
      </Card>

      <StudentsDirectory
        students={students.map((s) => ({
          id: s.id,
          name: s.name,
          active: s.active,
          faceCount: s._count.faceIdentities,
          classrooms: s.classrooms.map((c) => c.classroom.name),
          present: stats.get(s.id)?.present ?? 0,
          total: stats.get(s.id)?.total ?? 0,
        }))}
      />
    </>
  );
}
