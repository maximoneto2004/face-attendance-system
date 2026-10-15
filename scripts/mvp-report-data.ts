import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { db } from "@/lib/db";

async function main() {
  const classroom = await db.classroom.findFirst({
    where: { name: "Turma Jiu-Jitsu Teste" },
    select: {
      id: true,
      name: true,
      students: { select: { student: { select: { id: true, name: true } } } },
      attendanceSessions: {
        where: { status: "CONFIRMED" },
        orderBy: { takenAt: "asc" },
        select: {
          id: true,
          takenAt: true,
          facesDetected: true,
          recognizedCount: true,
          detectedFaces: { select: { status: true, similarity: true } },
          attendances: { select: { present: true, method: true, similarity: true } },
        },
      },
    },
  });
  if (!classroom) throw new Error("Turma de teste não encontrada.");

  const studentIds = classroom.students.map(({ student }) => student.id);
  const identities = await db.faceIdentity.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: { student: { name: "asc" } },
    select: {
      rekognitionFaceId: true,
      confidence: true,
      sourceSessionId: true,
      student: { select: { id: true, name: true } },
    },
  });

  const sessions = classroom.attendanceSessions.map((session) => {
    const similarities = session.detectedFaces
      .map((face) => face.similarity)
      .filter((value): value is number => value !== null);
    return {
      id: session.id,
      takenAt: session.takenAt,
      detected: session.facesDetected,
      auto: session.detectedFaces.filter((face) => face.status === "AUTO").length,
      review: session.detectedFaces.filter((face) => face.status === "REVIEW").length,
      unknown: session.detectedFaces.filter((face) => face.status === "UNKNOWN").length,
      present: session.attendances.filter((attendance) => attendance.present).length,
      absent: session.attendances.filter((attendance) => !attendance.present).length,
      averageSimilarity:
        similarities.length > 0
          ? similarities.reduce((total, value) => total + value, 0) / similarities.length
          : null,
      minSimilarity: similarities.length > 0 ? Math.min(...similarities) : null,
      maxSimilarity: similarities.length > 0 ? Math.max(...similarities) : null,
      methods: {
        auto: session.attendances.filter((attendance) => attendance.method === "FACIAL_AUTO").length,
        confirmed: session.attendances.filter((attendance) => attendance.method === "FACIAL_CONFIRMED").length,
        manual: session.attendances.filter((attendance) => attendance.method === "MANUAL").length,
      },
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    database: "PostgreSQL (connected)",
    region: process.env.AWS_REGION,
    collectionId: process.env.AWS_REKOGNITION_COLLECTION_ID,
    classroom: { id: classroom.id, name: classroom.name, students: studentIds.length },
    sessions,
    identities,
  };
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/mvp-db-report.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        database: report.database,
        region: report.region,
        collectionId: report.collectionId,
        students: report.classroom.students,
        sessions: sessions.length,
        identities: identities.length,
        totalDetected: sessions.reduce((sum, session) => sum + session.detected, 0),
        totalAuto: sessions.reduce((sum, session) => sum + session.auto, 0),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(`[mvp:report-data] error=${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
