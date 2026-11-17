import "server-only";
// Regras de acesso por perfil.
//
// - Coordenação (ADMIN): vê e gerencia tudo, inclusive turmas sem professor.
// - Professor (TEACHER): vê apenas as turmas pelas quais é responsável, os alunos
//   dessas turmas e as chamadas delas.
//
// Toda consulta de página, Server Action e Route Handler deve passar por aqui.
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

export type { CurrentUser };

export const isAdmin = (user: Pick<CurrentUser, "role">) => user.role === "ADMIN";

export function classroomScope(user: CurrentUser): Prisma.ClassroomWhereInput {
  return isAdmin(user) ? {} : { teacherId: user.id };
}

export function studentScope(user: CurrentUser): Prisma.StudentWhereInput {
  return isAdmin(user) ? {} : { classrooms: { some: { classroom: { teacherId: user.id } } } };
}

export function sessionScope(user: CurrentUser): Prisma.AttendanceSessionWhereInput {
  return isAdmin(user) ? {} : { classroom: { teacherId: user.id } };
}

export async function canAccessClassroom(user: CurrentUser, classroomId: string) {
  return (await db.classroom.count({ where: { id: classroomId, ...classroomScope(user) } })) > 0;
}

export async function canAccessStudent(user: CurrentUser, studentId: string) {
  return (await db.student.count({ where: { id: studentId, ...studentScope(user) } })) > 0;
}

export async function canAccessSession(user: CurrentUser, sessionId: string) {
  return (await db.attendanceSession.count({ where: { id: sessionId, ...sessionScope(user) } })) > 0;
}

// Para páginas: quem não tem acesso vê "não encontrado" (não revela que o item existe).
export async function requireClassroomAccess(user: CurrentUser, classroomId: string) {
  if (!(await canAccessClassroom(user, classroomId))) notFound();
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}
