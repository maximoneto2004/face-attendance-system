import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin, sessionScope } from "@/lib/access";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const reviewCount = await db.attendanceSession.count({ where: { status: "REVIEW", ...sessionScope(user) } });

  return (
    <div className="min-h-screen">
      <AppNav userName={user.name} reviewCount={reviewCount} isAdmin={isAdmin(user)} />
      {/* pb extra no celular: espaço para a barra de navegação inferior */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-10 lg:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
