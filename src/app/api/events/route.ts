import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizePath } from "@/lib/usage";

// Recebe, em lote, telas abertas e cliques enviados pelo navegador (UsageTracker).
const eventSchema = z.object({
  type: z.enum(["page", "click", "error"]),
  name: z.string().trim().min(1).max(80),
  path: z.string().max(300).optional(),
  tab: z.string().max(40).optional(),
  at: z.number().int().positive().optional(), // horário do clique no aparelho (ms)
  message: z.string().max(300).optional(),
});
const batchSchema = z.array(eventSchema).min(1).max(50);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  const now = Date.now();
  await db.usageEvent.createMany({
    data: parsed.data.map((e) => ({
      userId: user.id,
      type: e.type,
      name: e.name,
      path: normalizePath(e.path),
      tab: e.tab ?? null,
      // Usa o horário do aparelho se for plausível (lote reenviado com atraso).
      createdAt: new Date(e.at && Math.abs(now - e.at) < 30 * 60 * 1000 ? e.at : now),
      data: e.message ? { message: e.message } : undefined,
    })),
  });
  return new Response(null, { status: 204 });
}
