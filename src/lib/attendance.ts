import "server-only";
// Fluxo principal: foto da turma -> rostos detectados -> revisão -> presenças.
//
// DADOS BIOMÉTRICOS: a foto coletiva existe apenas em memória durante o
// processamento. Os recortes de rosto ficam em DetectedFace.cropImage somente
// até a chamada ser confirmada ou descartada.

import { db } from "@/lib/db";
import { faceConfig } from "@/lib/config";
import { cropFace, normalizePhoto } from "@/lib/face-images";
import {
  FaceServiceError,
  deleteFaces,
  detectFaces,
  indexFace,
  searchFace,
  type FaceMatch,
} from "@/lib/rekognition";
import type { AttendanceMethod, DetectedFaceStatus } from "@/generated/prisma/client";

export class AttendanceError extends Error {}

// Chamadas abandonadas em revisão (com seus recortes) são descartadas após este prazo.
const STALE_REVIEW_MS = 24 * 60 * 60 * 1000;
const SEARCH_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function classifySimilarity(similarity: number | null): DetectedFaceStatus {
  if (similarity === null) return "UNKNOWN";
  if (similarity >= faceConfig.autoAcceptThreshold) return "AUTO";
  if (similarity >= faceConfig.reviewThreshold) return "REVIEW";
  return "UNKNOWN";
}

// Processa a foto da turma e cria uma chamada em revisão. Retorna o id da chamada.
export async function processClassPhoto(input: {
  classroomId: string;
  userId: string;
  photo: Buffer;
}): Promise<string> {
  const classroom = await db.classroom.findUnique({
    where: { id: input.classroomId },
    select: {
      id: true,
      students: { where: { student: { active: true } }, select: { studentId: true } },
    },
  });
  if (!classroom) throw new AttendanceError("Turma não encontrada.");
  if (classroom.students.length === 0) {
    throw new AttendanceError("A turma não possui alunos ativos. Adicione alunos antes de fazer a chamada.");
  }
  const classStudentIds = new Set(classroom.students.map((s) => s.studentId));

  await discardStaleReviewSessions();

  let photo;
  try {
    photo = await normalizePhoto(input.photo);
  } catch {
    throw new AttendanceError("Não foi possível ler a imagem. Envie uma foto JPEG ou PNG.");
  }

  // 1. Detecta todos os rostos da foto coletiva (uma chamada à AWS).
  const faces = (await detectFaces(photo.buffer))
    .filter((f) => f.confidence >= faceConfig.minDetectionConfidence)
    // Ordem de leitura aproximada: da esquerda para a direita.
    .sort((a, b) => a.boundingBox.left - b.boundingBox.left);
  if (faces.length === 0) {
    throw new AttendanceError("Nenhum rosto foi detectado na foto. Tente outra foto, com boa iluminação.");
  }

  // 2. Recorta cada rosto.
  const crops = await Promise.all(faces.map((f) => cropFace(photo, f.boundingBox)));

  // 3. Busca cada rosto individualmente na Collection — apenas se já existirem
  //    rostos cadastrados (evita chamadas inúteis na primeira chamada).
  const hasKnownFaces = (await db.faceIdentity.count()) > 0;
  const searchResults: (FaceMatch[] | null)[] = hasKnownFaces
    ? await mapWithConcurrency(crops, SEARCH_CONCURRENCY, searchFace)
    : crops.map(() => []);

  // 4. Traduz os rostos da Collection para alunos (a fonte da verdade é o banco).
  const matchedFaceIds = [...new Set(searchResults.flatMap((r) => r?.map((m) => m.faceId) ?? []))];
  const identities = await db.faceIdentity.findMany({
    where: { rekognitionFaceId: { in: matchedFaceIds } },
    select: { rekognitionFaceId: true, studentId: true },
  });
  const studentByFaceId = new Map(identities.map((i) => [i.rekognitionFaceId, i.studentId]));

  // Melhor correspondência de cada rosto, considerando só alunos desta turma.
  const bestMatches = searchResults.map((matches) => {
    let best: { studentId: string; similarity: number } | null = null;
    for (const m of matches ?? []) {
      const studentId = studentByFaceId.get(m.faceId);
      if (!studentId || !classStudentIds.has(studentId)) continue;
      if (!best || m.similarity > best.similarity) best = { studentId, similarity: m.similarity };
    }
    return best;
  });

  // 5. Um aluno não pode aparecer em dois rostos: mantém só a maior similaridade.
  const bestFaceForStudent = new Map<string, number>();
  bestMatches.forEach((match, i) => {
    if (!match) return;
    const current = bestFaceForStudent.get(match.studentId);
    if (current === undefined || bestMatches[current]!.similarity < match.similarity) {
      bestFaceForStudent.set(match.studentId, i);
    }
  });

  const detectedFaces = faces.map((face, i) => {
    const match = bestMatches[i];
    const kept = match && bestFaceForStudent.get(match.studentId) === i ? match : null;
    const status = classifySimilarity(kept?.similarity ?? null);
    return {
      position: i,
      boundingBox: face.boundingBox,
      cropImage: new Uint8Array(crops[i]),
      status,
      suggestedStudentId: status === "UNKNOWN" ? null : kept!.studentId,
      similarity: status === "UNKNOWN" ? null : kept!.similarity,
    };
  });

  const session = await db.attendanceSession.create({
    data: {
      classroomId: classroom.id,
      createdById: input.userId,
      facesDetected: faces.length,
      recognizedCount: detectedFaces.filter((f) => f.status === "AUTO").length,
      detectedFaces: { create: detectedFaces },
    },
    select: { id: true },
  });
  return session.id;
}

export type ConfirmInput = {
  sessionId: string;
  // Decisão do professor para cada rosto: aluno atribuído ou null (ignorar).
  faces: { faceId: string; studentId: string | null }[];
  // Alunos marcados presentes manualmente (não identificados na foto).
  manualPresentIds: string[];
};

export type ConfirmResult = { warnings: string[] };

// Confirma a chamada: grava presenças e cadastra no Rekognition os rostos que o
// professor identificou/confirmou manualmente (aprendizado progressivo).
export async function confirmAttendance(input: ConfirmInput): Promise<ConfirmResult> {
  const session = await db.attendanceSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      status: true,
      classroom: {
        select: { students: { where: { student: { active: true } }, select: { studentId: true } } },
      },
      detectedFaces: {
        select: { id: true, status: true, suggestedStudentId: true, similarity: true, cropImage: true },
      },
    },
  });
  if (!session) throw new AttendanceError("Chamada não encontrada.");
  if (session.status !== "REVIEW") throw new AttendanceError("Esta chamada já foi confirmada.");

  const classStudentIds = new Set(session.classroom.students.map((s) => s.studentId));
  const facesById = new Map(session.detectedFaces.map((f) => [f.id, f]));
  const decisions = new Map(input.faces.map((f) => [f.faceId, f.studentId]));

  // Validação: todo rosto decidido pertence à chamada; alunos são da turma e sem duplicidade.
  const presentStudents = new Set<string>();
  const assignStudent = (studentId: string) => {
    if (!classStudentIds.has(studentId)) throw new AttendanceError("Aluno não pertence a esta turma.");
    if (presentStudents.has(studentId)) {
      throw new AttendanceError("O mesmo aluno foi marcado mais de uma vez.");
    }
    presentStudents.add(studentId);
  };
  for (const faceId of decisions.keys()) {
    if (!facesById.has(faceId)) throw new AttendanceError("Rosto inválido para esta chamada.");
  }

  type Presence = { studentId: string; method: AttendanceMethod; similarity: number | null };
  const presences: Presence[] = [];
  const toIndex: { studentId: string; faceId: string; crop: Uint8Array }[] = [];

  for (const face of session.detectedFaces) {
    const studentId = decisions.get(face.id) ?? null;
    if (!studentId) continue;
    assignStudent(studentId);
    const isSuggested = studentId === face.suggestedStudentId;
    if (face.status === "AUTO" && isSuggested) {
      presences.push({ studentId, method: "FACIAL_AUTO", similarity: face.similarity });
    } else {
      // Confirmado ou corrigido pelo professor: este rosto passa a identificar o aluno.
      presences.push({ studentId, method: "FACIAL_CONFIRMED", similarity: isSuggested ? face.similarity : null });
      if (face.cropImage) toIndex.push({ studentId, faceId: face.id, crop: face.cropImage });
    }
  }
  for (const studentId of new Set(input.manualPresentIds)) {
    assignStudent(studentId);
    presences.push({ studentId, method: "MANUAL", similarity: null });
  }

  // Indexa os rostos confirmados (fora da transação, pois é uma chamada externa).
  const warnings: string[] = [];
  const faceCounts = await db.faceIdentity.groupBy({
    by: ["studentId"],
    where: { studentId: { in: toIndex.map((t) => t.studentId) } },
    _count: true,
  });
  const countByStudent = new Map(faceCounts.map((c) => [c.studentId, c._count]));
  const newIdentities: { studentId: string; rekognitionFaceId: string; confidence: number }[] = [];
  try {
    for (const item of toIndex) {
      if ((countByStudent.get(item.studentId) ?? 0) >= faceConfig.maxFacesPerStudent) continue;
      const indexed = await indexFace(item.crop, item.studentId);
      if (!indexed) {
        warnings.push("Um rosto confirmado não tinha qualidade suficiente para ser cadastrado; a presença foi registrada mesmo assim.");
        continue;
      }
      newIdentities.push({ studentId: item.studentId, rekognitionFaceId: indexed.faceId, confidence: indexed.confidence });
    }

    const presenceByStudent = new Map(presences.map((p) => [p.studentId, p]));
    await db.$transaction(async (tx) => {
      // Garante que duas confirmações simultâneas não gravem a mesma chamada.
      const locked = await tx.attendanceSession.updateMany({
        where: { id: session.id, status: "REVIEW" },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          recognizedCount: presences.filter((p) => p.method === "FACIAL_AUTO").length,
        },
      });
      if (locked.count !== 1) throw new AttendanceError("Esta chamada já foi confirmada.");

      await tx.attendance.createMany({
        data: [...classStudentIds].map((studentId) => {
          const presence = presenceByStudent.get(studentId);
          return {
            sessionId: session.id,
            studentId,
            present: Boolean(presence),
            method: presence?.method ?? null,
            similarity: presence?.similarity ?? null,
          };
        }),
      });
      await tx.faceIdentity.createMany({
        data: newIdentities.map((i) => ({ ...i, sourceSessionId: session.id })),
      });
      for (const face of session.detectedFaces) {
        await tx.detectedFace.update({
          where: { id: face.id },
          // Apaga o recorte: a chamada está concluída.
          data: { assignedStudentId: decisions.get(face.id) ?? null, cropImage: null },
        });
      }
    });
  } catch (error) {
    // Desfaz cadastros no Rekognition para não deixar rostos órfãos.
    await deleteFaces(newIdentities.map((i) => i.rekognitionFaceId)).catch(() => {
      console.error("[attendance] falha ao remover rostos órfãos após erro na confirmação");
    });
    throw error;
  }

  return { warnings: [...new Set(warnings)] };
}

// Descarta uma chamada em revisão (apaga rostos detectados e recortes).
export async function discardSession(sessionId: string) {
  // Chamadas confirmadas nunca são apagadas por aqui.
  await db.attendanceSession.deleteMany({ where: { id: sessionId, status: "REVIEW" } });
}

async function discardStaleReviewSessions() {
  await db.attendanceSession.deleteMany({
    where: { status: "REVIEW", createdAt: { lt: new Date(Date.now() - STALE_REVIEW_MS) } },
  });
}

// Remove toda a identidade facial de um aluno (Rekognition + banco).
export async function deleteStudentFaceIdentity(studentId: string) {
  const identities = await db.faceIdentity.findMany({
    where: { studentId },
    select: { rekognitionFaceId: true },
  });
  await deleteFaces(identities.map((i) => i.rekognitionFaceId));
  await db.faceIdentity.deleteMany({ where: { studentId } });
}

export function describeError(error: unknown): string {
  if (error instanceof AttendanceError || error instanceof FaceServiceError) return error.message;
  console.error("[attendance] erro inesperado:", error instanceof Error ? `${error.name}: ${error.message}` : error);
  return "Ocorreu um erro inesperado. Tente novamente.";
}
