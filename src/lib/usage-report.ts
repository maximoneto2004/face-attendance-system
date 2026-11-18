import "server-only";
// Cálculos da tela "Uso do sistema" (somente administrador tech).
import { db } from "@/lib/db";

const TZ = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;
// Intervalo máximo entre dois eventos para contar como uso contínuo.
const IDLE_MS = 5 * 60 * 1000;
const MAX_EVENTS = 100_000;

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

export type UsageReport = Awaited<ReturnType<typeof buildUsageReport>>;

export async function buildUsageReport({ days, userId }: { days: number; userId?: string }) {
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY_MS);

  const [users, events, sessions, methods, firstEvent] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    db.usageEvent.findMany({
      where: { createdAt: { gte: since }, userId },
      orderBy: { createdAt: "asc" },
      take: MAX_EVENTS,
      select: { id: true, userId: true, type: true, name: true, path: true, tab: true, data: true, createdAt: true },
    }),
    db.attendanceSession.findMany({
      where: { createdAt: { gte: since }, createdById: userId },
      select: { id: true, createdById: true, status: true, createdAt: true, confirmedAt: true },
    }),
    db.attendance.groupBy({
      by: ["method"],
      where: { present: true, session: { status: "CONFIRMED", createdAt: { gte: since }, createdById: userId } },
      _count: true,
    }),
    db.usageEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));

  // ---- Por usuário ----
  type Row = {
    id: string;
    name: string;
    role: string;
    lastSeen: Date | null;
    days: Set<string>;
    usageMs: number;
    pages: number;
    clicks: number;
    created: number;
    confirmed: number;
    discarded: number;
    corrections: number;
    errors: number;
  };
  const rows = new Map<string, Row>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) {
      const u = userById.get(id);
      r = {
        id,
        name: u?.name ?? "Usuário removido",
        role: u?.role ?? "-",
        lastSeen: null,
        days: new Set(),
        usageMs: 0,
        pages: 0,
        clicks: 0,
        created: 0,
        confirmed: 0,
        discarded: 0,
        corrections: 0,
        errors: 0,
      };
      rows.set(id, r);
    }
    return r;
  };
  const seen = (r: Row, at: Date) => {
    if (!r.lastSeen || at > r.lastSeen) r.lastSeen = at;
    r.days.add(dayKey(at));
  };

  // Tempo de uso: soma dos intervalos entre eventos da mesma aba (pausas longas não contam).
  const lastByTab = new Map<string, number>();
  for (const e of events) {
    if (!e.userId) continue;
    const r = row(e.userId);
    seen(r, e.createdAt);
    if (e.type === "page") r.pages++;
    else if (e.type === "click") r.clicks++;
    else if (e.type === "error") r.errors++;
    else if (e.name === "Chamada descartada") r.discarded++;
    else if (e.name === "Presença corrigida") r.corrections++;
    const tabKey = `${e.userId}:${e.tab ?? dayKey(e.createdAt)}`;
    const prev = lastByTab.get(tabKey);
    const t = e.createdAt.getTime();
    if (prev !== undefined && t - prev <= IDLE_MS) r.usageMs += t - prev;
    lastByTab.set(tabKey, t);
  }
  for (const s of sessions) {
    const r = row(s.createdById);
    seen(r, s.createdAt);
    r.created++;
    if (s.status === "CONFIRMED") r.confirmed++;
  }
  // Inclui quem não usou no período (para enxergar quem está parado).
  if (!userId) for (const u of users) row(u.id);
  else row(userId);

  const perUser = [...rows.values()]
    .map((r) => ({ ...r, activeDays: r.days.size }))
    .sort((a, b) => (b.lastSeen?.getTime() ?? 0) - (a.lastSeen?.getTime() ?? 0) || a.name.localeCompare(b.name, "pt-BR"));

  // ---- Série diária: usuários ativos por dia ----
  const activeByDay = new Map<string, Set<string>>();
  const markActive = (at: Date, uid: string) => {
    const key = dayKey(at);
    const set = activeByDay.get(key) ?? new Set<string>();
    set.add(uid);
    activeByDay.set(key, set);
  };
  for (const e of events) if (e.userId) markActive(e.createdAt, e.userId);
  for (const s of sessions) markActive(s.createdAt, s.createdById);
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getTime() - (days - 1 - i) * DAY_MS);
    const key = dayKey(d);
    return { key, date: d, value: activeByDay.get(key)?.size ?? 0 };
  });

  // ---- Telas e botões ----
  const group = (type: string) => {
    const m = new Map<string, { name: string; count: number; users: Set<string>; paths: Map<string, number> }>();
    for (const e of events) {
      if (e.type !== type) continue;
      const g = m.get(e.name) ?? { name: e.name, count: 0, users: new Set(), paths: new Map() };
      g.count++;
      if (e.userId) g.users.add(e.userId);
      if (e.path) g.paths.set(e.path, (g.paths.get(e.path) ?? 0) + 1);
      m.set(e.name, g);
    }
    return [...m.values()]
      .sort((a, b) => b.count - a.count)
      .map((g) => ({
        name: g.name,
        count: g.count,
        users: g.users.size,
        topPath: [...g.paths.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      }));
  };
  const pages = group("page");
  const clicks = group("click");

  // ---- Funil da chamada (com base no registro de uso) ----
  const openedNew = new Set(
    events.filter((e) => e.type === "page" && e.name === "/attendance/new").map((e) => `${e.userId}:${e.tab ?? dayKey(e.createdAt)}`),
  ).size;
  const createdEv = events.filter((e) => e.name === "Chamada criada").length;
  const confirmedEv = events.filter((e) => e.name === "Chamada confirmada").length;
  const discardedEv = events.filter((e) => e.name === "Chamada descartada").length;

  // ---- Indicadores ----
  const confirmTimes = sessions
    .filter((s) => s.status === "CONFIRMED" && s.confirmedAt)
    .map((s) => s.confirmedAt!.getTime() - s.createdAt.getTime())
    .sort((a, b) => a - b);
  const median = confirmTimes.length ? confirmTimes[Math.floor(confirmTimes.length / 2)]! : null;
  const byMethod = (m: string) => methods.find((x) => x.method === m)?._count ?? 0;
  const presentTotal = byMethod("FACIAL_AUTO") + byMethod("FACIAL_CONFIRMED") + byMethod("MANUAL");

  const named = <T extends { userId: string | null }>(e: T) => ({ ...e, userName: e.userId ? (userById.get(e.userId)?.name ?? "Usuário removido") : "Desconhecido" });

  return {
    since,
    trackingSince: firstEvent?.createdAt ?? null,
    truncated: events.length === MAX_EVENTS,
    users: users.map((u) => ({ id: u.id, name: u.name })),
    kpis: {
      activeUsers: perUser.filter((r) => r.lastSeen).length,
      totalUsers: users.length,
      confirmed: sessions.filter((s) => s.status === "CONFIRMED").length,
      medianConfirmMs: median,
      autoRate: presentTotal ? byMethod("FACIAL_AUTO") / presentTotal : null,
      presence: { auto: byMethod("FACIAL_AUTO"), confirmedByTeacher: byMethod("FACIAL_CONFIRMED"), manual: byMethod("MANUAL") },
      corrections: events.filter((e) => e.name === "Presença corrigida").length,
      errors: events.filter((e) => e.type === "error").length,
      events: events.length,
    },
    perUser,
    daily,
    pages: pages.slice(0, 15),
    clicks: clicks.slice(0, 20),
    funnel: { openedNew, created: createdEv, confirmed: confirmedEv, discarded: discardedEv },
    errors: events.filter((e) => e.type === "error").slice(-20).reverse().map(named),
    recent: events.slice(-60).reverse().map(named),
  };
}

export function formatDuration(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 1) return ms > 0 ? "< 1 min" : "0 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, "0")} min`;
}
