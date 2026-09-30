import "server-only";
import { db } from "@/lib/db";
import type { SessionRow } from "@/components/sessions-table";

export async function listSessions(take: number): Promise<SessionRow[]> {
  const sessions = await db.attendanceSession.findMany({
    orderBy: { takenAt: "desc" },
    take,
    select: {
      id: true,
      takenAt: true,
      status: true,
      facesDetected: true,
      recognizedCount: true,
      classroom: { select: { name: true } },
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
