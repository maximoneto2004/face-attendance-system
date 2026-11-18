import Link from "next/link";
import { requireTech } from "@/lib/access";
import { purgeOldUsageEvents, USAGE_RETENTION_DAYS } from "@/lib/usage";
import { buildUsageReport, formatDuration } from "@/lib/usage-report";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  buttonClass,
  formatDate,
  formatDateTime,
  formatRelativeDateTime,
  inputStyles,
  plural,
} from "@/components/ui";
import { Icon } from "@/components/icons";

const PERIODS = [7, 30, 90] as const;
const roleLabel: Record<string, string> = { TECH: "Admin tech", ADMIN: "Coordenação", TEACHER: "Professor" };
const typeLabel: Record<string, { label: string; tone: "slate" | "indigo" | "green" | "red" }> = {
  page: { label: "Tela", tone: "slate" },
  click: { label: "Clique", tone: "indigo" },
  action: { label: "Ação", tone: "green" },
  error: { label: "Erro", tone: "red" },
};

export default async function UsagePage({ searchParams }: PageProps<"/usage">) {
  await requireTech();
  await purgeOldUsageEvents();
  const { dias, usuario } = await searchParams;
  const days = PERIODS.find((p) => String(p) === dias) ?? 30;
  const userId = typeof usuario === "string" && usuario ? usuario : undefined;
  const r = await buildUsageReport({ days, userId });
  const now = new Date();
  const selectedUser = userId ? r.users.find((u) => u.id === userId) : undefined;
  const qs = (next: { dias?: number; usuario?: string | null }) => {
    const p = new URLSearchParams();
    p.set("dias", String(next.dias ?? days));
    const u = next.usuario === undefined ? userId : next.usuario;
    if (u) p.set("usuario", u);
    return `/usage?${p}`;
  };
  const funnelMax = Math.max(r.funnel.openedNew, r.funnel.created, r.funnel.confirmed, 1);
  const dailyMax = Math.max(...r.daily.map((d) => d.value), 1);

  return (
    <>
      <PageHeader
        title="Uso do sistema"
        description={
          r.trackingSince
            ? `Registro ativo desde ${formatDate(r.trackingSince)}. Dados guardados por ${USAGE_RETENTION_DAYS} dias. Visível só para administradores tech.`
            : "O registro de uso começa agora: os dados aparecem conforme as pessoas usam o sistema."
        }
      />

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Período" className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={qs({ dias: p })}
              aria-current={p === days ? "true" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${p === days ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {p} dias
            </Link>
          ))}
        </div>
        <form action="/usage" className="flex flex-1 flex-wrap items-center gap-2 sm:flex-none">
          <input type="hidden" name="dias" value={days} />
          <select name="usuario" defaultValue={userId ?? ""} aria-label="Filtrar por usuário" className={`${inputStyles} h-10 py-1 sm:w-64`}>
            <option value="">Todos os usuários</option>
            {r.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClass("secondary", "sm")}>
            Filtrar
          </button>
          {selectedUser && (
            <Link href={qs({ usuario: null })} className={buttonClass("ghost", "sm")}>
              Limpar
            </Link>
          )}
        </form>
      </div>

      {r.truncated && (
        <Alert tone="warning" className="mb-6">
          Período com muitos registros: mostrando os primeiros 100 mil eventos. Use um período menor para ver tudo.
        </Alert>
      )}

      {/* Indicadores */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores de uso">
        <StatCard label="Usuários ativos" value={r.kpis.activeUsers} icon="users" hint={`de ${r.kpis.totalUsers} acessos`} />
        <StatCard label="Chamadas confirmadas" value={r.kpis.confirmed} icon="checkCircle" />
        <StatCard
          label="Tempo até confirmar"
          value={r.kpis.medianConfirmMs === null ? "—" : formatDuration(r.kpis.medianConfirmMs)}
          icon="clock"
          hint="mediana, da foto à confirmação"
        />
        <StatCard
          label="Reconhecimento automático"
          value={r.kpis.autoRate === null ? "—" : `${Math.round(r.kpis.autoRate * 100)}%`}
          icon="scan"
          hint={`${r.kpis.presence.auto} auto · ${r.kpis.presence.confirmedByTeacher} pelo professor · ${r.kpis.presence.manual} manual`}
        />
        <StatCard label="Correções após confirmar" value={r.kpis.corrections} icon="undo" />
        <StatCard label="Erros" value={r.kpis.errors} icon="alert" hint={plural(r.kpis.events, "evento registrado", "eventos registrados")} />
      </section>

      {/* Atividade por dia */}
      <Card className="mb-6">
        <CardHeader title="Usuários ativos por dia" description={`Últimos ${days} dias${selectedUser ? ` · ${selectedUser.name}` : ""}`} />
        <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={`Usuários ativos por dia nos últimos ${days} dias`}>
          {r.daily.map((d) => (
            <div key={d.key} className="group relative flex h-full flex-1 items-end" tabIndex={0}>
              <div
                className="w-full rounded-t-[4px] bg-brand-500 group-hover:bg-brand-700 group-focus:bg-brand-700"
                style={{ height: d.value ? `${Math.max(4, (d.value / dailyMax) * 100)}%` : "2px", opacity: d.value ? 1 : 0.25 }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus:block">
                {formatDate(d.date)} · {plural(d.value, "usuário", "usuários")}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>{formatDate(r.daily[0]!.date)}</span>
          <span>máx. {dailyMax}</span>
          <span>hoje</span>
        </div>
        <table className="sr-only">
          <caption>Usuários ativos por dia</caption>
          <tbody>
            {r.daily.map((d) => (
              <tr key={d.key}>
                <td>{formatDate(d.date)}</td>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Por usuário */}
      <Card className="mb-6 p-0">
        <div className="p-5 pb-3">
          <CardHeader title="Por usuário" description="Tempo de uso soma os intervalos entre ações (pausas de mais de 5 minutos não contam)." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Usuário</th>
                <th className="px-3 py-2.5">Último acesso</th>
                <th className="px-3 py-2.5 text-right">Dias ativos</th>
                <th className="px-3 py-2.5 text-right">Tempo de uso</th>
                <th className="px-3 py-2.5 text-right">Telas</th>
                <th className="px-3 py-2.5 text-right">Cliques</th>
                <th className="px-3 py-2.5 text-right">Chamadas</th>
                <th className="px-3 py-2.5 text-right">Descartadas</th>
                <th className="px-3 py-2.5 text-right">Correções</th>
                <th className="px-5 py-2.5 text-right">Erros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.perUser.map((u) => (
                <tr key={u.id} className={u.lastSeen ? "" : "text-slate-400"}>
                  <td className="px-5 py-2.5">
                    <Link href={qs({ usuario: u.id })} className="flex items-center gap-2.5 hover:text-brand-700">
                      <Avatar name={u.name} size="sm" />
                      <span>
                        <span className="block font-medium">{u.name}</span>
                        <span className="block text-xs text-slate-500">{roleLabel[u.role] ?? u.role}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {u.lastSeen ? formatRelativeDateTime(u.lastSeen, now) : <Badge tone="amber">Sem uso no período</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.activeDays}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatDuration(u.usageMs)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.pages}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.clicks}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    {u.confirmed}
                    <span className="text-slate-400">/{u.created}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.discarded}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.corrections}</td>
                  <td className={`px-5 py-2.5 text-right tabular-nums ${u.errors ? "font-semibold text-red-700" : ""}`}>{u.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-slate-500">Chamadas: confirmadas / criadas no período.</p>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Funil */}
        <Card>
          <CardHeader title="Funil da chamada" description="Quantas chamadas começadas chegam ao fim (a partir do registro de uso)." />
          <ol className="space-y-3">
            {[
              { label: "Abriram “Nova chamada”", value: r.funnel.openedNew },
              { label: "Processaram a foto", value: r.funnel.created },
              { label: "Confirmaram a chamada", value: r.funnel.confirmed },
            ].map((step, i, all) => (
              <li key={step.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-700">{step.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {step.value}
                    {i > 0 && all[0]!.value > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">({Math.round((step.value / all[0]!.value) * 100)}%)</span>
                    )}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${(step.value / funnelMax) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-slate-500">{plural(r.funnel.discarded, "chamada descartada", "chamadas descartadas")} no período.</p>
        </Card>

        {/* Telas */}
        <Card className="p-0">
          <div className="p-5 pb-2">
            <CardHeader title="Telas mais abertas" />
          </div>
          <RankList items={r.pages.map((p) => ({ key: p.name, label: screenName(p.name), sub: p.name, count: p.count, users: p.users }))} empty="Nenhuma tela registrada ainda." />
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Botões */}
        <Card className="p-0">
          <div className="p-5 pb-2">
            <CardHeader title="Botões mais usados" description="Botões que não aparecem aqui quase não são usados." />
          </div>
          <RankList
            items={r.clicks.map((c) => ({ key: c.name, label: c.name, sub: c.topPath ? `em ${screenName(c.topPath)}` : undefined, count: c.count, users: c.users }))}
            empty="Nenhum clique registrado ainda."
          />
        </Card>

        {/* Erros */}
        <Card className="p-0">
          <div className="p-5 pb-2">
            <CardHeader title="Erros recentes" description="O que deu errado para os usuários." />
          </div>
          {r.errors.length === 0 ? (
            <p className="flex items-center gap-2 px-5 pb-5 text-sm text-emerald-700">
              <Icon name="checkCircle" className="h-4 w-4" />
              Nenhum erro no período.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {r.errors.map((e) => (
                <li key={e.id} className="px-5 py-2.5 text-sm">
                  <p className="font-medium text-slate-800">{e.name}</p>
                  {messageOf(e.data) && <p className="text-slate-600">{messageOf(e.data)}</p>}
                  <p className="text-xs text-slate-500">
                    {e.userName} · {formatDateTime(e.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Atividade recente */}
      <Card className="p-0">
        <div className="p-5 pb-2">
          <CardHeader
            title={selectedUser ? `Linha do tempo — ${selectedUser.name}` : "Atividade recente"}
            description="Últimos 60 registros, do mais novo para o mais antigo."
          />
        </div>
        {r.recent.length === 0 ? (
          <div className="p-5 pt-0">
            <EmptyState icon="history" title="Nada registrado ainda">
              Assim que alguém usar o sistema, as telas abertas, cliques e ações aparecem aqui.
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {r.recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 text-sm">
                <span className="w-28 shrink-0 text-xs tabular-nums text-slate-500">{formatRelativeDateTime(e.createdAt, now)}</span>
                <Badge tone={typeLabel[e.type]?.tone ?? "slate"}>{typeLabel[e.type]?.label ?? e.type}</Badge>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                  {e.type === "page" ? screenName(e.name) : e.name}
                  {e.type === "click" && e.path && <span className="font-normal text-slate-500"> · {screenName(e.path)}</span>}
                </span>
                {!selectedUser && <span className="text-xs text-slate-500">{e.userName}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function RankList({
  items,
  empty,
}: {
  items: { key: string; label: string; sub?: string; count: number; users: number }[];
  empty: string;
}) {
  if (items.length === 0) return <p className="px-5 pb-5 text-sm text-slate-500">{empty}</p>;
  const max = items[0]!.count;
  return (
    <ul className="divide-y divide-slate-100 border-t border-slate-100">
      {items.map((i) => (
        <li key={i.key} className="px-5 py-2.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-slate-800">{i.label}</span>
            <span className="shrink-0 tabular-nums text-slate-900">
              {i.count}
              <span className="ml-1.5 text-xs text-slate-500">{plural(i.users, "pessoa", "pessoas")}</span>
            </span>
          </div>
          {i.sub && <p className="truncate text-xs text-slate-500">{i.sub}</p>}
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-brand-400" style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Nome amigável das rotas.
const SCREENS: [RegExp, string][] = [
  [/^\/$/, "Início"],
  [/^\/attendance\/new$/, "Nova chamada"],
  [/^\/attendance\/:id$/, "Chamada (revisão/detalhe)"],
  [/^\/attendance$/, "Histórico"],
  [/^\/classes\/:id$/, "Página da turma"],
  [/^\/classes$/, "Turmas"],
  [/^\/students\/:id$/, "Página do aluno"],
  [/^\/students$/, "Alunos"],
  [/^\/teachers$/, "Professores"],
  [/^\/usage$/, "Uso do sistema"],
];
function screenName(path: string) {
  return SCREENS.find(([re]) => re.test(path))?.[1] ?? path;
}

function messageOf(data: unknown) {
  return data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : null;
}
