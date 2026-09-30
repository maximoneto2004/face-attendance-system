"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { confirmAttendance, describeError, discardSession, processClassPhoto } from "@/lib/attendance";
import type { FormState } from "@/lib/form";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export async function createAttendanceSession(formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const classroomId = z.string().min(1).safeParse(formData.get("classroomId"));
  if (!classroomId.success) return { error: "Selecione uma turma." };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Envie uma foto da turma." };
  if (!photo.type.startsWith("image/")) return { error: "O arquivo enviado não é uma imagem." };
  if (photo.size > MAX_PHOTO_BYTES) return { error: "Foto grande demais (máximo 12 MB)." };

  let sessionId: string;
  try {
    // A foto existe só em memória durante o processamento; não é gravada.
    sessionId = await processClassPhoto({
      classroomId: classroomId.data,
      userId: user.id,
      photo: Buffer.from(await photo.arrayBuffer()),
    });
  } catch (error) {
    return { error: describeError(error) };
  }
  redirect(`/attendance/${sessionId}`);
}

const confirmSchema = z.object({
  sessionId: z.string().min(1),
  faces: z.array(z.object({ faceId: z.string().min(1), studentId: z.string().min(1).nullable() })).max(200),
  manualPresentIds: z.array(z.string().min(1)).max(500),
});

export async function confirmAttendanceSession(input: z.input<typeof confirmSchema>): Promise<FormState> {
  await requireUser();
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados da chamada inválidos." };

  let warnings: string[];
  try {
    ({ warnings } = await confirmAttendance(parsed.data));
  } catch (error) {
    return { error: describeError(error) };
  }
  revalidatePath("/attendance");
  redirect(`/attendance/${parsed.data.sessionId}${warnings.length > 0 ? "?aviso=qualidade" : ""}`);
}

export async function discardAttendanceSession(formData: FormData) {
  await requireUser();
  await discardSession(String(formData.get("sessionId") ?? ""));
  revalidatePath("/attendance");
  redirect("/attendance");
}
