"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canAccessClassroom, canAccessSession } from "@/lib/access";
import { db } from "@/lib/db";
import {
  MAX_FACES_PER_SESSION,
  addPhotoToSession,
  confirmAttendance,
  describeError,
  discardSession,
  processClassPhoto,
} from "@/lib/attendance";
import type { FormState } from "@/lib/form";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

function readPhoto(formData: FormData): File | string {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return "Envie uma foto da turma.";
  if (!photo.type.startsWith("image/")) return "O arquivo enviado não é uma imagem.";
  if (photo.size > MAX_PHOTO_BYTES) return "Foto grande demais (máximo 12 MB).";
  return photo;
}

// Cria a chamada a partir da primeira foto. O navegador envia as demais fotos com
// addAttendancePhoto e então abre a revisão.
export async function createAttendanceSession(formData: FormData): Promise<{ error: string } | { sessionId: string }> {
  const user = await requireUser();
  const classroomId = z.string().min(1).safeParse(formData.get("classroomId"));
  if (!classroomId.success) return { error: "Selecione uma turma." };
  if (!(await canAccessClassroom(user, classroomId.data))) return { error: "Turma não encontrada." };

  const photo = readPhoto(formData);
  if (typeof photo === "string") return { error: photo };

  try {
    // A foto existe só em memória durante o processamento; não é gravada.
    const sessionId = await processClassPhoto({
      classroomId: classroomId.data,
      userId: user.id,
      photo: Buffer.from(await photo.arrayBuffer()),
    });
    return { sessionId };
  } catch (error) {
    return { error: describeError(error) };
  }
}

// Acrescenta mais uma foto a uma chamada em revisão.
export async function addAttendancePhoto(
  formData: FormData,
): Promise<{ error: string } | { added: number; duplicates: number }> {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!(await canAccessSession(user, sessionId))) return { error: "Chamada não encontrada." };

  const photo = readPhoto(formData);
  if (typeof photo === "string") return { error: photo };

  try {
    const result = await addPhotoToSession({ sessionId, photo: Buffer.from(await photo.arrayBuffer()) });
    revalidatePath(`/attendance/${sessionId}`);
    return result;
  } catch (error) {
    return { error: describeError(error) };
  }
}

const confirmSchema = z.object({
  sessionId: z.string().min(1),
  faces: z
    .array(z.object({ faceId: z.string().min(1), studentId: z.string().min(1).nullable() }))
    .max(MAX_FACES_PER_SESSION),
  manualPresentIds: z.array(z.string().min(1)).max(500),
});

export async function confirmAttendanceSession(input: z.input<typeof confirmSchema>): Promise<FormState> {
  const user = await requireUser();
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados da chamada inválidos." };
  if (!(await canAccessSession(user, parsed.data.sessionId))) return { error: "Chamada não encontrada." };

  let warnings: string[];
  try {
    ({ warnings } = await confirmAttendance(parsed.data));
  } catch (error) {
    return { error: describeError(error) };
  }
  revalidatePath("/attendance");
  redirect(`/attendance/${parsed.data.sessionId}${warnings.length > 0 ? "?aviso=qualidade" : ""}`);
}

// Correção manual de uma chamada já confirmada (ex.: aluno chegou depois da foto,
// ou foi marcado por engano). Altera só o registro de presença: não mexe no
// reconhecimento facial nem em rostos cadastrados.
const correctSchema = z.object({
  sessionId: z.string().min(1),
  studentId: z.string().min(1),
  present: z.enum(["true", "false"]),
});

export async function correctAttendance(formData: FormData) {
  const user = await requireUser();
  const parsed = correctSchema.safeParse({
    sessionId: formData.get("sessionId"),
    studentId: formData.get("studentId"),
    present: formData.get("present"),
  });
  if (!parsed.success) return;
  const { sessionId, studentId } = parsed.data;
  if (!(await canAccessSession(user, sessionId))) return;
  const present = parsed.data.present === "true";

  await db.attendance.updateMany({
    // Só chamadas confirmadas e só alunos que já constam na chamada.
    where: { sessionId, studentId, session: { status: "CONFIRMED" } },
    data: present ? { present: true, method: "MANUAL", similarity: null } : { present: false, method: null, similarity: null },
  });
  revalidatePath(`/attendance/${sessionId}`);
  revalidatePath("/attendance");
}

export async function discardAttendanceSession(formData: FormData) {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (await canAccessSession(user, sessionId)) await discardSession(sessionId);
  revalidatePath("/attendance");
  redirect("/attendance");
}
