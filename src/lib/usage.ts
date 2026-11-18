import "server-only";
// Registro de uso do sistema, visível só para o administrador tech.
// PRIVACIDADE: não grave nomes nem imagens de alunos aqui — apenas ids, contagens e
// nomes de telas/botões. Os registros são apagados após USAGE_RETENTION_DAYS.
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const USAGE_RETENTION_DAYS = 180;

export type UsageType = "page" | "click" | "action" | "error";

// Ids (cuid) na rota viram ":id" para agrupar telas iguais.
export function normalizePath(path: string | null | undefined): string | null {
  if (!path) return null;
  const pathname = path.split(/[?#]/)[0] ?? "";
  return (
    pathname
      .split("/")
      .map((seg) => (/^c[a-z0-9]{20,}$/.test(seg) || /^[0-9a-f-]{24,}$/i.test(seg) ? ":id" : seg))
      .join("/")
      .slice(0, 200) || "/"
  );
}

// Nunca lança erro: registrar uso não pode atrapalhar o professor.
export async function trackEvent(
  userId: string | null | undefined,
  name: string,
  data?: Prisma.InputJsonObject,
  type: UsageType = "action",
) {
  try {
    await db.usageEvent.create({ data: { userId: userId ?? null, type, name: name.slice(0, 80), data } });
  } catch (error) {
    console.error("[usage] falha ao registrar evento", error instanceof Error ? error.message : error);
  }
}

export async function trackError(userId: string | null | undefined, name: string, message: string) {
  await trackEvent(userId, name, { message: message.slice(0, 300) }, "error");
}

export async function purgeOldUsageEvents() {
  const cutoff = new Date(Date.now() - USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.usageEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
