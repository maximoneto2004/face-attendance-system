"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canAccessClassroom, isAdmin } from "@/lib/access";
import { firstIssue, type FormState } from "@/lib/form";
import { trackEvent } from "@/lib/usage";

const classroomSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da turma.").max(120, "Nome muito longo."),
  description: z
    .string()
    .trim()
    .max(500, "Descrição muito longa.")
    .transform((v) => v || null),
});

// Coordenação escolhe o professor responsável; vazio = sem professor.
async function teacherFromForm(formData: FormData): Promise<string | null | undefined> {
  if (!formData.has("teacherId")) return undefined; // campo ausente: não altera
  const teacherId = String(formData.get("teacherId") ?? "");
  if (!teacherId) return null;
  const exists = await db.user.count({ where: { id: teacherId } });
  return exists ? teacherId : undefined;
}

export async function createClassroom(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = classroomSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  // O professor que cria a turma passa a ser o responsável por ela.
  const teacherId = isAdmin(user) ? ((await teacherFromForm(formData)) ?? null) : user.id;
  const classroom = await db.classroom.create({ data: { ...parsed.data, teacherId } });
  await trackEvent(user.id, "Turma criada", { classroomId: classroom.id });
  redirect(`/classes/${classroom.id}`);
}

export async function updateClassroom(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!(await canAccessClassroom(user, id))) return { error: "Turma não encontrada." };
  const parsed = classroomSchema.extend({ active: z.boolean() }).safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  // Só a coordenação troca o professor responsável.
  const teacherId = isAdmin(user) ? await teacherFromForm(formData) : undefined;
  const updated = await db.classroom.updateMany({
    where: { id },
    data: { ...parsed.data, ...(teacherId !== undefined ? { teacherId } : {}) },
  });
  if (updated.count === 0) return { error: "Turma não encontrada." };
  revalidatePath(`/classes/${id}`);
  revalidatePath("/classes");
  return { success: "Alterações salvas." };
}

export async function addStudentsToClassroom(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const classroomId = String(formData.get("classroomId") ?? "");
  if (!(await canAccessClassroom(user, classroomId))) return { error: "Turma não encontrada." };
  const studentIds = formData.getAll("studentIds").map(String).filter(Boolean);
  if (studentIds.length === 0) return { error: "Selecione ao menos um aluno." };

  const classroom = await db.classroom.findUnique({ where: { id: classroomId }, select: { id: true } });
  if (!classroom) return { error: "Turma não encontrada." };
  const students = await db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true } });

  const added = await db.classroomStudent.createMany({
    data: students.map((s) => ({ classroomId, studentId: s.id })),
    skipDuplicates: true,
  });
  revalidatePath(`/classes/${classroomId}`);
  await trackEvent(user.id, "Alunos adicionados à turma", { classroomId, count: added.count });
  return { success: `${added.count} ${added.count === 1 ? "aluno adicionado" : "alunos adicionados"} à turma.` };
}

const namesSchema = z
  .array(z.string().trim().min(2, "Cada nome deve ter pelo menos 2 caracteres.").max(120, "Nome muito longo."))
  .min(1, "Informe ao menos um nome.")
  .max(200, "Máximo de 200 alunos por vez.");

// Cadastra novos alunos (um nome por linha) já vinculados à turma.
export async function createStudentsInClassroom(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const classroomId = String(formData.get("classroomId") ?? "");
  if (!(await canAccessClassroom(user, classroomId))) return { error: "Turma não encontrada." };
  const names = String(formData.get("names") ?? "")
    .split(/\r?\n/)
    .map((n) => n.trim())
    .filter(Boolean);
  const parsed = namesSchema.safeParse(names);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const classroom = await db.classroom.findUnique({ where: { id: classroomId }, select: { id: true } });
  if (!classroom) return { error: "Turma não encontrada." };

  await db.$transaction(
    parsed.data.map((name) =>
      db.student.create({ data: { name, classrooms: { create: { classroomId } } } }),
    ),
  );
  revalidatePath(`/classes/${classroomId}`);
  revalidatePath("/students");
  const count = parsed.data.length;
  await trackEvent(user.id, "Alunos cadastrados em lote", { classroomId, count });
  return { success: `${count} ${count === 1 ? "aluno cadastrado" : "alunos cadastrados"} e adicionado${count === 1 ? "" : "s"} à turma.` };
}

export async function removeStudentFromClassroom(formData: FormData) {
  const user = await requireUser();
  const classroomId = String(formData.get("classroomId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  if (!(await canAccessClassroom(user, classroomId))) return;
  await db.classroomStudent.deleteMany({ where: { classroomId, studentId } });
  revalidatePath(`/classes/${classroomId}`);
}
