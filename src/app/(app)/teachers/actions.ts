"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/access";
import { firstIssue, type FormState } from "@/lib/form";

// Gestão de professores — somente coordenação (ADMIN).

const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres.").max(100, "Senha muito longa.");
const roleSchema = z.enum(["ADMIN", "TEACHER"]);

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  password: passwordSchema,
  role: roleSchema,
});

export async function createTeacher(_state: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role") ?? "TEACHER",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { password, ...data } = parsed.data;
  if (await db.user.count({ where: { email: data.email } })) return { error: "Já existe um acesso com este e-mail." };
  await db.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
  revalidatePath("/teachers");
  return { success: `Acesso criado. Envie para ${data.name}: e-mail ${data.email} · senha ${password}` };
}

export async function resetTeacherPassword(_state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return { error: firstIssue(password.error) };

  // Nova senha desconecta todos os aparelhos que estavam usando a antiga.
  const user = await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password.data), sessionVersion: { increment: 1 } },
    select: { id: true, sessionVersion: true },
  });
  if (user.id === admin.id) await startSession(user); // mantém a coordenação conectada neste aparelho
  revalidatePath("/teachers");
  return { success: `Senha alterada para: ${password.data}` };
}

export async function updateTeacherRole(_state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = roleSchema.safeParse(formData.get("role"));
  if (!role.success) return { error: "Perfil inválido." };
  if (userId === admin.id && role.data !== "ADMIN") {
    return { error: "Você não pode remover o seu próprio acesso de coordenação." };
  }
  await db.user.update({ where: { id: userId }, data: { role: role.data } });
  revalidatePath("/teachers");
  return { success: "Perfil atualizado." };
}

export async function disconnectTeacher(_state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (userId === admin.id) return { error: "Para sair deste aparelho, use “Sair”." };
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
  revalidatePath("/teachers");
  return { success: "Todos os aparelhos foram desconectados. A pessoa precisará entrar de novo." };
}
