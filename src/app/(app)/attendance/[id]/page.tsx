import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, BackLink, Card, PageHeader, formatDateTime, formatPercent } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { discardAttendanceSession } from "../actions";
import { ReviewForm } from "./review-form";
import type { AttendanceMethod } from "@/generated/prisma/client";

const methodLabels: Record<AttendanceMethod, { label: string; tone: "green" | "indigo" | "slate" }> = {
  FACIAL_AUTO: { label: "Facial automático", tone: "green" },
  FACIAL_CONFIRMED: { label: "Facial confirmado", tone: "indigo" },
  MANUAL: { label: "Manual", tone: "slate" },
};

export default async function AttendanceSessionPage({ params, searchParams }: PageProps<"/attendance/[id]">) {
  await requireUser();
  const { id } = await params;
  const { aviso } = await searchParams;
  const session = await db.attendanceSession.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      takenAt: true,
      facesDetected: true,
      recognizedCount: true,
      classroom: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!session) notFound();

  const header = (
    <>
      <BackLink href="/attendance">Histórico</BackLink>
      <PageHeader
        title={`Chamada — ${session.classroom.name}`}
        description={`${formatDateTime(session.takenAt)} · por ${session.createdBy.name}`}
        actions={
          session.status === "REVIEW" ? (
            <form action={discardAttendanceSession}>
              <input type="hidden" name="sessionId" value={session.id} />
              <SubmitButton variant="danger" pendingText="Descartando..." confirmMessage="Descartar esta chamada?">
                Descartar
              </SubmitButton>
            </form>
          ) : undefined
        }
      />
    </>
  );

  if (session.status === "REVIEW") {
    const [faces, members] = await Promise.all([
      db.detectedFace.findMany({
        where: { sessionId: session.id },
        orderBy: { position: "asc" },
        select: { id: true, status: true, suggestedStudentId: true, similarity: true },
      }),
      db.classroomStudent.findMany({
        where: { classroomId: session.classroom.id, student: { active: true } },
        orderBy: { student: { name: "asc" } },
        select: { student: { select: { id: true, name: true, _count: { select: { faceIdentities: true } } } } },
      }),
    ]);
    return (
      <>
        {header}
        <ReviewForm
          sessionId={session.id}
          faces={faces}
          students={members.map(({ student }) => ({
            id: student.id,
            name: student.name,
            hasFace: student._count.faceIdentities > 0,
          }))}
        />
      </>
    );
  }

  const attendances = await db.attendance.findMany({
    where: { sessionId: session.id },
    orderBy: { student: { name: "asc" } },
    select: { present: true, method: true, similarity: true, student: { select: { id: true, name: true } } },
  });
  const present = attendances.filter((a) => a.present);
  const absent = attendances.filter((a) => !a.present);

  return (
    <>
      {header}
      {aviso === "qualidade" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Alguns rostos confirmados não tinham qualidade suficiente para serem cadastrados no reconhecimento facial. As
          presenças foram registradas normalmente.
        </p>
      )}
      <Card className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>
          <strong>{present.length}</strong> presente(s)
        </span>
        <span>
          <strong>{absent.length}</strong> ausente(s)
        </span>
        <span className="text-slate-500">{session.facesDetected} rosto(s) na foto</span>
        <span className="text-slate-500">{session.recognizedCount} reconhecido(s) automaticamente</span>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Presentes</h2>
          <ul className="divide-y divide-slate-100">
            {present.map((a) => (
              <li key={a.student.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/students/${a.student.id}`} className="hover:underline">
                  {a.student.name}
                </Link>
                <span className="flex items-center gap-2">
                  {a.similarity !== null && <span className="text-xs text-slate-400">{formatPercent(a.similarity)}</span>}
                  {a.method && <Badge tone={methodLabels[a.method].tone}>{methodLabels[a.method].label}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">Ausentes</h2>
          {absent.length === 0 ? (
            <p className="text-sm text-slate-500">Ninguém faltou.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {absent.map((a) => (
                <li key={a.student.id} className="py-2 text-sm">
                  <Link href={`/students/${a.student.id}`} className="hover:underline">
                    {a.student.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
