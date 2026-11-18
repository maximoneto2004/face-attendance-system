"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { endSession, startSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth/password";
import type { FormState } from "@/lib/form";
import { getCurrentUser } from "@/lib/auth";
import { trackEvent } from "@/lib/usage";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

const INVALID = "E-mail ou senha incorretos.";

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: INVALID };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    await trackEvent(user?.id, "Login com senha errada", undefined, "error");
    return { error: INVALID };
  }
  await startSession(user);
  await trackEvent(user.id, "Login");
  redirect("/");
}

export async function logout() {
  const user = await getCurrentUser();
  await trackEvent(user?.id, "Logout");
  await endSession();
  redirect("/login");
}
