import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listSessions } from "@/lib/sessions";
import { PageHeader, buttonStyles } from "@/components/ui";
import { SessionsTable } from "@/components/sessions-table";

export default async function AttendanceHistoryPage() {
  await requireUser();
  const sessions = await listSessions(200);

  return (
    <>
      <PageHeader
        title="Histórico de chamadas"
        actions={
          <Link href="/attendance/new" className={buttonStyles.primary}>
            Nova chamada
          </Link>
        }
      />
      <SessionsTable sessions={sessions} />
    </>
  );
}
