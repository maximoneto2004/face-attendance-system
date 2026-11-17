import "server-only";
import { db } from "@/lib/db";
import type { SessionRow } from "@/components/sessions-table";
import type { Prisma } from "@/generated/prisma/client";

export async function listSessions(
  take: number,
  filter: { classroomId?: string; status?: "REVIEW" | "CONFIRMED"; scope?: Prisma.AttendanceSessionWhereInput } = {},
): Promise<SessionRow[]> {
  const sessions = await db.attendanceSession.findMany({
    where: { classroomId: filter.classroomId, status: filter.status, ...filter.scope },
    orderBy: { takenAt: "desc" },
    take,
    select: {
      id: true,
      takenAt: true,
      createdAt: true,
      status: true,
      facesDetected: true,
      recognizedCount: true,
      classroom: { select: { id: true, name: true } },
      _count: { select: { attendances: true } },
    },
  });
  const presentCounts = await db.attendance.groupBy({
    by: ["sessionId"],
    where: { sessionId: { in: sessions.map((s) => s.id) }, present: true },
    _count: true,
  });
  const presentBySession = new Map(presentCounts.map((p) => [p.sessionId, p._count]));
  return sessions.map((s) => ({ ...s, presentCount: presentBySession.get(s.id) ?? 0 }));
}
