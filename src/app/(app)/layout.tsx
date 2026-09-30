import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

const navItems = [
  { href: "/", label: "Início" },
  { href: "/attendance/new", label: "Nova chamada" },
  { href: "/attendance", label: "Histórico" },
  { href: "/classes", label: "Turmas" },
  { href: "/students", label: "Alunos" },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold text-indigo-600">
            Chamada Facial
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-slate-600">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-slate-900">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span>{user.name}</span>
            <form action={logout}>
              <button type="submit" className="text-slate-500 hover:text-slate-900">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
