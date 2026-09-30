"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deleteStudentFaceIdentity, describeError } from "@/lib/attendance";
import { firstIssue, type FormState } from "@/lib/form";

const nameSchema = z.string().trim().min(2, "Informe o nome do aluno.").max(120, "Nome muito longo.");

export async function createStudent(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await db.student.create({ data: { name: parsed.data } });
  revalidatePath("/students");
  return {};
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: nameSchema,
  active: z.boolean(),
});

export async function updateStudent(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { id, ...data } = parsed.data;
  const updated = await db.student.updateMany({ where: { id }, data });
  if (updated.count === 0) return { error: "Aluno não encontrado." };
  revalidatePath("/students");
  redirect("/students");
}

export async function removeFaceIdentity(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.string().min(1).safeParse(formData.get("id"));
  if (!id.success) return { error: "Aluno inválido." };
  try {
    await deleteStudentFaceIdentity(id.data);
  } catch (error) {
    return { error: describeError(error) };
  }
  revalidatePath(`/students/${id.data}`);
  return {};
}
