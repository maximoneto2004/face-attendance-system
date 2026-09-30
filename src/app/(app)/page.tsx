import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listSessions } from "@/lib/sessions";
import { Card, PageHeader, buttonStyles } from "@/components/ui";
import { SessionsTable } from "@/components/sessions-table";

export default async function DashboardPage() {
  await requireUser();
  const [students, studentsWithFace, classrooms, sessions] = await Promise.all([
    db.student.count({ where: { active: true } }),
    db.student.count({ where: { active: true, faceIdentities: { some: {} } } }),
    db.classroom.count({ where: { active: true } }),
    listSessions(5),
  ]);

  const stats = [
    { label: "Alunos ativos", value: students, href: "/students" },
    { label: "Com rosto cadastrado", value: `${studentsWithFace} / ${students}`, href: "/students" },
    { label: "Turmas ativas", value: classrooms, href: "/classes" },
  ];

  return (
    <>
      <PageHeader
        title="Início"
        actions={
          <Link href="/attendance/new" className={buttonStyles.primary}>
            Nova chamada
          </Link>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition hover:border-indigo-300">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-1 text-3xl font-semibold">{s.value}</p>
            </Card>
          </Link>
        ))}
      </div>
      <h2 className="mb-3 font-medium">Chamadas recentes</h2>
      <SessionsTable sessions={sessions} />
    </>
  );
}
