import "dotenv/config";

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { confirmAttendance, discardSession, processClassPhoto } from "@/lib/attendance";
import { db } from "@/lib/db";

const CLASS_NAME = "Turma Jiu-Jitsu Teste";
const PHOTO_NAMES = [
  "WhatsApp Image 2026-10-14 at 19.03.40.jpeg",
  "WhatsApp Image 2026-10-14 at 19.03.41 (1).jpeg",
  "WhatsApp Image 2026-10-14 at 19.03.41 (4).jpeg",
  "WhatsApp Image 2026-10-14 at 19.03.41.jpeg",
  "WhatsApp Image 2026-10-14 at 19.03.42 (1).jpeg",
  "WhatsApp Image 2026-10-14 at 19.03.42.jpeg",
  "WhatsApp Image 2026-10-14 at 19.03.43.jpeg",
] as const;

type PhotoResult = {
  file: string;
  sessionId: string;
  detected: number;
  auto: number;
  review: number;
  unknown: number;
  assigned: number;
  present: number;
  absent: number;
  similarities: number[];
  warnings: string[];
};

async function prepareData() {
  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("Nenhum professor cadastrado. Execute npm run user:create antes do teste.");

  let classroom = await db.classroom.findFirst({ where: { name: CLASS_NAME } });
  if (!classroom) {
    classroom = await db.classroom.create({
      data: { name: CLASS_NAME, description: "Turma criada para validação real do MVP facial." },
    });
  }

  const existingMembers = await db.classroomStudent.findMany({
    where: { classroomId: classroom.id },
    orderBy: { createdAt: "asc" },
    select: { student: { select: { id: true, name: true } } },
  });
  const students = existingMembers.map(({ student }) => student);
  for (let number = students.length + 1; number <= 25; number += 1) {
    const student = await db.student.create({
      data: {
        name: `Aluno ${String(number).padStart(2, "0")}`,
        classrooms: { create: { classroomId: classroom.id } },
      },
      select: { id: true, name: true },
    });
    students.push(student);
  }

  return { user, classroom, students: students.slice(0, 25) };
}

async function loadFaces(sessionId: string) {
  return db.detectedFace.findMany({
    where: { sessionId },
    orderBy: { position: "asc" },
    select: { id: true, status: true, suggestedStudentId: true, similarity: true },
  });
}

function statusCounts(faces: Awaited<ReturnType<typeof loadFaces>>) {
  return {
    auto: faces.filter((face) => face.status === "AUTO").length,
    review: faces.filter((face) => face.status === "REVIEW").length,
    unknown: faces.filter((face) => face.status === "UNKNOWN").length,
  };
}

async function attendanceCounts(sessionId: string) {
  const rows = await db.attendance.groupBy({ by: ["present"], where: { sessionId }, _count: true });
  return {
    present: rows.find((row) => row.present)?._count ?? 0,
    absent: rows.find((row) => !row.present)?._count ?? 0,
  };
}

async function createSession(classroomId: string, userId: string, file: string) {
  console.log(`[mvp:e2e] processing file=${file}`);
  const sessionId = await processClassPhoto({
    classroomId,
    userId,
    photo: await readFile(path.join("fotos", file)),
  });
  return { sessionId, faces: await loadFaces(sessionId) };
}

async function main() {
  const { user, classroom, students } = await prepareData();
  console.log(`[mvp:e2e] data ready class=${classroom.name} students=${students.length}`);

  const existingConfirmed = await db.attendanceSession.count({
    where: { classroomId: classroom.id, status: "CONFIRMED" },
  });
  if (existingConfirmed > 0) {
    throw new Error(
      `A turma de teste já possui ${existingConfirmed} chamada(s) confirmada(s). Use uma base limpa para repetir o cadastro inicial.`,
    );
  }

  const results: PhotoResult[] = [];

  // Primeira chamada: cada rosto recebe um identificador técnico, sem inferir nomes reais.
  const first = await createSession(classroom.id, user.id, PHOTO_NAMES[0]);
  assert.equal(first.faces.length, students.length, "A foto inicial deve ter um rosto para cada aluno técnico.");
  assert.ok(first.faces.every((face) => face.status === "UNKNOWN"), "A primeira chamada deve começar desconhecida.");

  // Valida que duas faces não podem ser atribuídas ao mesmo aluno.
  await assert.rejects(
    confirmAttendance({
      sessionId: first.sessionId,
      faces: first.faces.slice(0, 2).map((face) => ({ faceId: face.id, studentId: students[0].id })),
      manualPresentIds: [],
    }),
    /mais de uma vez/,
  );
  console.log("[mvp:e2e] duplicate assignment rejected");

  const firstConfirmation = await confirmAttendance({
    sessionId: first.sessionId,
    faces: first.faces.map((face, index) => ({ faceId: face.id, studentId: students[index].id })),
    manualPresentIds: [],
  });
  const firstAttendance = await attendanceCounts(first.sessionId);
  const identitiesAfterFirst = await db.faceIdentity.count({
    where: { studentId: { in: students.map((student) => student.id) } },
  });
  assert.ok(identitiesAfterFirst > 0, "A confirmação inicial deve persistir identidades faciais.");
  assert.equal(firstAttendance.present, 25, "A primeira chamada deve salvar 25 presenças.");
  results.push({
    file: PHOTO_NAMES[0],
    sessionId: first.sessionId,
    detected: first.faces.length,
    auto: 0,
    review: 0,
    unknown: first.faces.length,
    assigned: first.faces.length,
    ...firstAttendance,
    similarities: [],
    warnings: firstConfirmation.warnings,
  });
  console.log(`[mvp:e2e] first call confirmed identities=${identitiesAfterFirst}`);

  for (const file of PHOTO_NAMES.slice(1)) {
    const current = await createSession(classroom.id, user.id, file);
    const counts = statusCounts(current.faces);
    const decisions = current.faces.map((face) => ({
      faceId: face.id,
      studentId: face.suggestedStudentId,
    }));
    const assigned = decisions.filter((decision) => decision.studentId).length;
    const confirmation = await confirmAttendance({
      sessionId: current.sessionId,
      faces: decisions,
      manualPresentIds: [],
    });
    const attendance = await attendanceCounts(current.sessionId);
    const similarities = current.faces
      .map((face) => face.similarity)
      .filter((value): value is number => value !== null);
    results.push({
      file,
      sessionId: current.sessionId,
      detected: current.faces.length,
      ...counts,
      assigned,
      ...attendance,
      similarities,
      warnings: confirmation.warnings,
    });
    console.log(
      `[mvp:e2e] confirmed detected=${current.faces.length} auto=${counts.auto} ` +
        `review=${counts.review} unknown=${counts.unknown} present=${attendance.present}`,
    );
  }

  // Teste isolado de desconhecido: cria uma revisão e confirma sem forçar associação.
  const unknownProbe = await createSession(classroom.id, user.id, "WhatsApp Image 2026-10-14 at 19.03.41 (5).jpeg");
  const unknownFace = unknownProbe.faces.find((face) => face.status === "UNKNOWN");
  assert.ok(unknownFace, "A foto de controle deve conter ao menos um rosto desconhecido.");
  await discardSession(unknownProbe.sessionId);
  assert.equal(await db.attendanceSession.count({ where: { id: unknownProbe.sessionId } }), 0);
  console.log("[mvp:e2e] unknown face preserved and review session discarded");

  const identities = await db.faceIdentity.findMany({
    where: { studentId: { in: students.map((student) => student.id) } },
    orderBy: [{ studentId: "asc" }, { createdAt: "asc" }],
    select: { studentId: true, rekognitionFaceId: true, confidence: true, sourceSessionId: true },
  });
  const output = {
    generatedAt: new Date().toISOString(),
    class: { id: classroom.id, name: classroom.name, students: students.length },
    thresholds: {
      auto: process.env.FACE_AUTO_ACCEPT_THRESHOLD ?? "95 (default)",
      review: process.env.FACE_REVIEW_THRESHOLD ?? "85 (default)",
    },
    results,
    identities,
  };
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/mvp-results.json", `${JSON.stringify(output, null, 2)}\n`);
  console.log(`[mvp:e2e] complete sessions=${results.length} identities=${identities.length}`);
  console.log("[mvp:e2e] report=tmp/mvp-results.json");
}

main()
  .catch((error: unknown) => {
    console.error(`[mvp:e2e] error=${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
