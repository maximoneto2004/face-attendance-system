import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, verifySessionToken } from "./session-token";

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, sessionVersion: true },
  });
  // Sessão revogada (senha redefinida ou "desconectar aparelhos").
  if (!user || (session.v ?? 0) !== user.sessionVersion) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// Use em toda página, Server Action e Route Handler protegidos.
// O proxy também redireciona, mas não deve ser a única barreira.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function startSession(user: { id: string; sessionVersion: number }) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(user.id, user.sessionVersion), sessionCookieOptions());
}

export async function endSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
