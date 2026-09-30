import type { z } from "zod";

// Estado retornado pelas Server Actions usadas com useActionState.
export type FormState = { error?: string } | undefined;

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
