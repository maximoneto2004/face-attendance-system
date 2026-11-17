import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sessionScope } from "@/lib/access";
import { STALE_REVIEW_MS } from "@/lib/config";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  ProgressBar,
  StatCard,
  buttonClass,
  formatDateTime,
  formatPercent,
  formatWeekday,
  formatRate,
  formatTime,
  plural,
  type BadgeTone,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { correctAttendance, discardAttendanceSession } from "../actions";
import { ShareAttendance } from "./share-attendance";
import { AddPhoto } from "./add-photo";
import { ReviewForm } from "./review-form";
import type { AttendanceMethod } from "@/generated/prisma/client";

const methodLabels: Record<AttendanceMethod, { label: string; tone: BadgeTone }> = {
  FACIAL_AUTO: { label: "Facial automático", tone: "green" },
  FACIAL_CONFIRMED: { label: "Facial confirmado", tone: "indigo" },
  MANUAL: { label: "Manual", tone: "slate" },
};

export default async function AttendanceSessionPage({ params, searchParams }: PageProps<"/attendance/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { aviso, fotosComErro, repetidos } = await searchParams;
  const session = await db.attendanceSession.findFirst({
    where: { id, ...sessionScope(user) },
    select: {
      id: true,
      status: true,
      takenAt: true,
      createdAt: true,
      facesDetected: true,
      recognizedCount: true,
      classroom: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!session) notFound();

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
    const expiresAt = new Date(session.createdAt.getTime() + STALE_REVIEW_MS);

    return (
      <>
        <PageHeader
          back={{ href: "/attendance", label: "Histórico" }}
          title={`Chamada — ${session.classroom.name}`}
          description={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone="amber" icon="clock">
                Aguardando revisão
              </Badge>
              {formatDateTime(session.takenAt)} · por {session.createdBy.name}
            </span>
          }
          actions={
            <form action={discardAttendanceSession}>
              <input type="hidden" name="sessionId" value={session.id} />
              <SubmitButton
                variant="danger"
                icon="trash"
                pendingText="Descartando..."
                confirmMessage="Descartar esta chamada? Nenhuma presença será registrada e os rostos detectados serão apagados."
                className="w-full"
              >
                Descartar
              </SubmitButton>
            </form>
          }
        />
        <p className="-mt-4 mb-6 flex items-center gap-1.5 text-xs text-slate-500">
          <Icon name="clock" className="h-3.5 w-3.5" />
          Se não for confirmada, esta chamada será descartada automaticamente após as {formatTime(expiresAt)} de{" "}
          {expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
        </p>
        {typeof fotosComErro === "string" && Number(fotosComErro) > 0 && (
          <Alert tone="warning" className="mb-4" title={`${plural(Number(fotosComErro), "foto não pôde", "fotos não puderam")} ser analisada${Number(fotosComErro) > 1 ? "s" : ""}`}>
            Os rostos das outras fotos estão abaixo. Se faltou alguém, use “Adicionar foto” ou marque a presença
            manualmente.
          </Alert>
        )}
        {typeof repetidos === "string" && Number(repetidos) > 0 && (
          <Alert tone="info" className="mb-4">
            {plural(Number(repetidos), "aluno apareceu", "alunos apareceram")} em mais de uma foto e foi contado só uma vez.
          </Alert>
        )}
        <AddPhoto sessionId={session.id} />
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
      <PageHeader
        back={{ href: "/attendance", label: "Histórico" }}
        title={`Chamada — ${session.classroom.name}`}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone="green" icon="check">
              Confirmada
            </Badge>
            {formatDateTime(session.takenAt)} · por {session.createdBy.name}
          </span>
        }
        actions={
          <>
            <Link href={`/classes/${session.classroom.id}`} className={buttonClass("secondary")}>
              Ver turma
            </Link>
            <Link href={`/attendance/new?classroomId=${session.classroom.id}`} className={buttonClass("primary")}>
              <Icon name="camera" className="h-5 w-5" />
              Nova chamada
            </Link>
          </>
        }
      />

      {aviso === "qualidade" && (
        <Alert tone="warning" className="mb-6" title="Chamada registrada com um aviso">
          Alguns rostos confirmados não tinham qualidade suficiente para serem cadastrados no reconhecimento facial. As
          presenças foram registradas normalmente.
        </Alert>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Resumo da chamada">
        <StatCard label="Presentes" value={present.length} icon="checkCircle" />
        <StatCard label="Ausentes" value={absent.length} icon="xCircle" />
        <StatCard label="Taxa de presença" value={formatRate(present.length, attendances.length)}>
          <ProgressBar value={present.length} max={attendances.length} tone="green" className="mt-3" label="Taxa de presença" />
        </StatCard>
        <StatCard
          label="Rostos na foto"
          value={session.facesDetected}
          icon="scan"
          hint={`${session.recognizedCount} ${session.recognizedCount === 1 ? "reconhecido" : "reconhecidos"} automaticamente`}
        />
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Alguém chegou depois da foto ou foi marcado errado? Use os botões ao lado de cada nome para corrigir.
        </p>
        <ShareAttendance
          classroomName={session.classroom.name}
          dateLabel={`${formatWeekday(session.takenAt)} · ${formatTime(session.takenAt)}`}
          present={present.map((a) => a.student.name)}
          absent={absent.map((a) => a.student.name)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title={`Presentes (${present.length})`} />
          {present.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum aluno presente.</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {present.map((a) => (
                <li key={a.student.id} className="flex items-center gap-2">
                  <Link
                    href={`/students/${a.student.id}`}
                    className="-ml-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50"
                  >
                    <Avatar name={a.student.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{a.student.name}</span>
                      {a.method && (
                        <span className="mt-0.5 flex items-center gap-2">
                          <Badge tone={methodLabels[a.method].tone}>{methodLabels[a.method].label}</Badge>
                          {a.similarity !== null && (
                            <span className="hidden text-xs text-slate-400 sm:inline">{formatPercent(a.similarity)}</span>
                          )}
                        </span>
                      )}
                    </span>
                  </Link>
                  <CorrectButton sessionId={session.id} studentId={a.student.id} name={a.student.name} present={false} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={`Ausentes (${absent.length})`} />
          {absent.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <Icon name="checkCircle" className="h-4 w-4" />
              Ninguém faltou.
            </p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {absent.map((a) => (
                <li key={a.student.id} className="flex items-center gap-2">
                  <Link
                    href={`/students/${a.student.id}`}
                    className="-ml-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50"
                  >
                    <Avatar name={a.student.name} size="sm" />
                    <span className="truncate text-sm font-medium text-slate-800">{a.student.name}</span>
                  </Link>
                  <CorrectButton sessionId={session.id} studentId={a.student.id} name={a.student.name} present />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        {plural(attendances.length, "aluno ativo", "alunos ativos")} na turma no momento da chamada. Os recortes de rosto
        desta chamada já foram apagados. Correções feitas aqui ficam registradas como presença manual e não alteram o
        reconhecimento facial.
      </p>
    </>
  );
}

function CorrectButton({
  sessionId,
  studentId,
  name,
  present,
}: {
  sessionId: string;
  studentId: string;
  name: string;
  present: boolean;
}) {
  return (
    <form action={correctAttendance} className="shrink-0">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="present" value={String(present)} />
      <SubmitButton
        variant={present ? "secondary" : "ghost"}
        size="sm"
        icon={present ? "check" : "x"}
        pendingText=""
        ariaLabel={present ? `Marcar ${name} como presente` : `Marcar falta para ${name}`}
        className={present ? "text-emerald-700" : "text-slate-500 hover:text-red-600"}
      >
        {present ? "Presente" : "Faltou"}
      </SubmitButton>
    </form>
  );
}
