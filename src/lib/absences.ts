import "server-only";
import { db } from "@/lib/db";
import { classroomScope, type CurrentUser } from "@/lib/access";

// Quantas chamadas seguidas sem presença fazem um aluno aparecer no alerta.
export const ABSENCE_STREAK = 3;

export type AbsenceAlert = { studentId: string; name: string; classroomId: string; classroomName: string };

// Alunos ativos que faltaram às últimas ABSENCE_STREAK chamadas confirmadas da turma.
// Somente leitura: ajuda o professor a perceber cedo quem pode estar abandonando a atividade.
export async function listAbsenceAlerts(user: CurrentUser, classroomId?: string): Promise<AbsenceAlert[]> {
  const classrooms = await db.classroom.findMany({
    where: { active: true, id: classroomId, ...classroomScope(user) },
    select: {
      id: true,
      name: true,
      attendanceSessions: {
        where: { status: "CONFIRMED" },
        orderBy: { takenAt: "desc" },
        take: ABSENCE_STREAK,
        select: { id: true },
      },
      students: { where: { student: { active: true } }, select: { studentId: true } },
    },
  });
  const eligible = classrooms.filter((c) => c.attendanceSessions.length === ABSENCE_STREAK);
  if (eligible.length === 0) return [];

  const classBySession = new Map(eligible.flatMap((c) => c.attendanceSessions.map((s) => [s.id, c] as const)));
  const absences = await db.attendance.findMany({
    where: { sessionId: { in: [...classBySession.keys()] }, present: false },
    select: { sessionId: true, studentId: true, student: { select: { name: true } } },
  });

  const counts = new Map<string, { alert: AbsenceAlert; count: number }>();
  for (const a of absences) {
    const classroom = classBySession.get(a.sessionId)!;
    const key = `${classroom.id}:${a.studentId}`;
    const entry = counts.get(key) ?? {
      alert: { studentId: a.studentId, name: a.student.name, classroomId: classroom.id, classroomName: classroom.name },
      count: 0,
    };
    entry.count++;
    counts.set(key, entry);
  }

  const members = new Set(eligible.flatMap((c) => c.students.map((s) => `${c.id}:${s.studentId}`)));
  return [...counts.entries()]
    .filter(([key, e]) => e.count === ABSENCE_STREAK && members.has(key))
    .map(([, e]) => e.alert)
    .sort((a, b) => a.classroomName.localeCompare(b.classroomName, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
}
