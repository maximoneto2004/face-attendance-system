"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { Icon, type IconName } from "./icons";
import { Avatar } from "./ui";

type NavItem = { href: string; label: string; icon: IconName; badge?: number };

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/attendance") return pathname === "/attendance" || /^\/attendance\/(?!new)[^/]+/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
        <Icon name="scan" className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold text-slate-900">Chamada Facial</span>
          <span className="block text-xs text-slate-500">Controle de presença</span>
        </span>
      )}
    </span>
  );
}

function LogoutButton({ className }: { className: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={className}>
        <Icon name="logout" className="h-4 w-4" />
        Sair
      </button>
    </form>
  );
}

export function AppNav({
  userName,
  reviewCount,
  isAdmin = false,
  isTech = false,
}: {
  userName: string;
  reviewCount: number;
  isAdmin?: boolean;
  isTech?: boolean;
}) {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: "/", label: "Início", icon: "home" },
    { href: "/attendance", label: "Histórico", icon: "history", badge: reviewCount },
    { href: "/classes", label: "Turmas", icon: "layers" },
    { href: "/students", label: "Alunos", icon: "users" },
  ];
  // Só a coordenação gerencia professores (no celular fica no menu da conta).
  const adminItem: NavItem = { href: "/teachers", label: "Professores", icon: "shield" };
  const techItem: NavItem = { href: "/usage", label: "Uso do sistema", icon: "sparkles" };
  const extraItems = [...(isAdmin ? [adminItem] : []), ...(isTech ? [techItem] : [])];
  const sidebarItems = [...items, ...extraItems];
  const newActive = pathname.startsWith("/attendance/new");

  return (
    <>
      {/* Desktop: barra lateral */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5">
          <Link href="/" className="rounded-lg">
            <Logo />
          </Link>
        </div>
        <div className="px-4">
          <Link
            href="/attendance/new"
            aria-current={newActive ? "page" : undefined}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Icon name="camera" className="h-5 w-5" />
            Nova chamada
          </Link>
        </div>
        <nav aria-label="Navegação principal" className="mt-6 flex-1 space-y-1 px-3">
          {sidebarItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon name={item.icon} className={`h-5 w-5 ${active ? "text-brand-600" : "text-slate-400"}`} />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
                    title={`${item.badge} chamada(s) aguardando revisão`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar name={userName} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{userName}</span>
          </div>
          <LogoutButton className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900" />
        </div>
      </aside>

      {/* Celular/tablet: barra superior */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="rounded-lg">
            <Logo />
          </Link>
          <details className="relative">
            <summary
              aria-label="Menu da conta"
              className="flex h-10 cursor-pointer list-none items-center rounded-full [&::-webkit-details-marker]:hidden"
            >
              <Avatar name={userName} size="sm" />
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <p className="truncate px-3 py-2 text-sm font-medium text-slate-700">{userName}</p>
              {extraItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
              <LogoutButton className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100" />
            </div>
          </details>
        </div>
      </header>

      {/* Celular/tablet: barra inferior com a ação principal no centro */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {[items[0]!, items[1]!, null, items[2]!, items[3]!].map((item) => {
            if (!item) {
              return (
                <Link
                  key="new"
                  href="/attendance/new"
                  aria-current={newActive ? "page" : undefined}
                  className="flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-white">
                    <Icon name="camera" className="h-6 w-6" />
                  </span>
                  <span className={`text-[11px] font-semibold ${newActive ? "text-brand-700" : "text-slate-700"}`}>Chamada</span>
                </Link>
              );
            }
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  active ? "text-brand-700" : "text-slate-500"
                }`}
              >
                <Icon name={item.icon} className="h-6 w-6" />
                {item.label}
                {item.badge ? (
                  <span className="absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-amber-500 px-1 text-center text-[10px] font-bold leading-5 text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
