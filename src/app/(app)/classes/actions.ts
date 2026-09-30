"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { firstIssue, type FormState } from "@/lib/form";

const classroomSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da turma.").max(120, "Nome muito longo."),
  description: z
    .string()
    .trim()
    .max(500, "Descrição muito longa.")
    .transform((v) => v || null),
});

export async function createClassroom(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = classroomSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const classroom = await db.classroom.create({ data: parsed.data });
  redirect(`/classes/${classroom.id}`);
}

export async function updateClassroom(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = classroomSchema.extend({ active: z.boolean() }).safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const updated = await db.classroom.updateMany({ where: { id }, data: parsed.data });
  if (updated.count === 0) return { error: "Turma não encontrada." };
  revalidatePath(`/classes/${id}`);
  return {};
}

export async function addStudentsToClassroom(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const classroomId = String(formData.get("classroomId") ?? "");
  const studentIds = formData.getAll("studentIds").map(String).filter(Boolean);
  if (studentIds.length === 0) return { error: "Selecione ao menos um aluno." };

  const classroom = await db.classroom.findUnique({ where: { id: classroomId }, select: { id: true } });
  if (!classroom) return { error: "Turma não encontrada." };
  const students = await db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true } });

  await db.classroomStudent.createMany({
    data: students.map((s) => ({ classroomId, studentId: s.id })),
    skipDuplicates: true,
  });
  revalidatePath(`/classes/${classroomId}`);
  return {};
}

const namesSchema = z
  .array(z.string().trim().min(2, "Cada nome deve ter pelo menos 2 caracteres.").max(120, "Nome muito longo."))
  .min(1, "Informe ao menos um nome.")
  .max(200, "Máximo de 200 alunos por vez.");

// Cadastra novos alunos (um nome por linha) já vinculados à turma.
export async function createStudentsInClassroom(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const classroomId = String(formData.get("classroomId") ?? "");
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
  return {};
}

export async function removeStudentFromClassroom(formData: FormData) {
  await requireUser();
  const classroomId = String(formData.get("classroomId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  await db.classroomStudent.deleteMany({ where: { classroomId, studentId } });
  revalidatePath(`/classes/${classroomId}`);
}
