import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/access";
import { Alert, Avatar, Badge, Card, CardHeader, PageHeader, plural } from "@/components/ui";
import { Icon } from "@/components/icons";
import { CreateTeacherForm, ManageTeacherForms } from "./forms";

export default async function TeachersPage() {
  const me = await requireAdmin();
  const [users, unassigned] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        classrooms: { orderBy: { name: "asc" }, select: { id: true, name: true, active: true } },
      },
    }),
    db.classroom.findMany({
      where: { teacherId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Professores"
        description="Cada professor entra com o próprio acesso e vê apenas as turmas pelas quais é responsável."
      />

      {unassigned.length > 0 && (
        <Alert tone="warning" className="mb-6" title={`${plural(unassigned.length, "turma sem", "turmas sem")} professor responsável`}>
          <span className="block">Elas só aparecem para a coordenação. Abra cada uma e escolha o professor em “Configurações da turma”:</span>
          <span className="mt-2 flex flex-wrap gap-2">
            {unassigned.map((c) => (
              <Link
                key={c.id}
                href={`/classes/${c.id}`}
                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                {c.name}
              </Link>
            ))}
          </span>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader icon="userPlus" title="Novo acesso" description="Crie um acesso para cada professor ou modalidade." />
        <CreateTeacherForm />
      </Card>

      <ul className="space-y-4">
        {users.map((u) => (
          <li key={u.id}>
            <Card className="p-0">
              <div className="flex flex-wrap items-start gap-3 p-4 sm:p-5">
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    {u.name}
                    {u.role === "ADMIN" ? <Badge tone="indigo" icon="shield">Coordenação</Badge> : <Badge>Professor</Badge>}
                    {u.id === me.id && <Badge tone="green">Você</Badge>}
                  </p>
                  <p className="truncate text-sm text-slate-500">{u.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {u.role === "ADMIN" ? (
                      <span className="text-xs text-slate-500">Vê todas as turmas.</span>
                    ) : u.classrooms.length === 0 ? (
                      <span className="text-xs text-amber-700">Nenhuma turma ainda — escolha este professor na configuração da turma.</span>
                    ) : (
                      u.classrooms.map((c) => (
                        <Link
                          key={c.id}
                          href={`/classes/${c.id}`}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium hover:bg-brand-100 ${
                            c.active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {c.name}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <details className="group border-t border-slate-100">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    <Icon name="settings" className="h-4 w-4 text-slate-400" />
                    Senha, perfil e aparelhos
                  </span>
                  <Icon name="chevronDown" className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-slate-100 p-4 sm:p-5">
                  <ManageTeacherForms user={u} isSelf={u.id === me.id} />
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
