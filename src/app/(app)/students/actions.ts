"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canAccessClassroom, canAccessStudent, isAdmin } from "@/lib/access";
import { deleteStudentFaceIdentity, describeError } from "@/lib/attendance";
import { firstIssue, type FormState } from "@/lib/form";
import { trackEvent } from "@/lib/usage";

const nameSchema = z.string().trim().min(2, "Informe o nome do aluno.").max(120, "Nome muito longo.");

export async function createStudent(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  // Professores cadastram alunos sempre em uma das suas turmas (senão o aluno
  // ficaria invisível para eles). A coordenação pode cadastrar sem turma.
  const classroomId = String(formData.get("classroomId") ?? "");
  if (classroomId) {
    if (!(await canAccessClassroom(user, classroomId))) return { error: "Turma não encontrada." };
  } else if (!isAdmin(user)) {
    return { error: "Escolha a turma do aluno." };
  }

  const student = await db.student.create({
    data: { name: parsed.data, ...(classroomId ? { classrooms: { create: { classroomId } } } : {}) },
    select: { name: true },
  });
  revalidatePath("/students");
  if (classroomId) revalidatePath(`/classes/${classroomId}`);
  await trackEvent(user.id, "Aluno cadastrado", { classroomId: classroomId || null });
  return { success: `Cadastro de ${student.name} concluído.` };
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: nameSchema,
  active: z.boolean(),
});

export async function updateStudent(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { id, ...data } = parsed.data;
  if (!(await canAccessStudent(user, id))) return { error: "Aluno não encontrado." };
  const updated = await db.student.updateMany({ where: { id }, data });
  if (updated.count === 0) return { error: "Aluno não encontrado." };
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { success: "Alterações salvas." };
}

export async function removeFaceIdentity(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = z.string().min(1).safeParse(formData.get("id"));
  if (!id.success) return { error: "Aluno inválido." };
  if (!(await canAccessStudent(user, id.data))) return { error: "Aluno não encontrado." };
  try {
    await deleteStudentFaceIdentity(id.data);
  } catch (error) {
    return { error: describeError(error) };
  }
  revalidatePath(`/students/${id.data}`);
  await trackEvent(user.id, "Identidade facial excluída", { studentId: id.data });
  return { success: "Identidade facial excluída." };
}
