import Link from "next/link";
import { Badge, Card, EmptyState, formatDateTime } from "./ui";

export type SessionRow = {
  id: string;
  takenAt: Date;
  status: "REVIEW" | "CONFIRMED";
  facesDetected: number;
  recognizedCount: number;
  classroom: { name: string };
  _count: { attendances: number };
  presentCount: number;
};

export function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  if (sessions.length === 0) return <EmptyState>Nenhuma chamada realizada ainda.</EmptyState>;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">Data</th>
            <th className="px-5 py-3 font-medium">Turma</th>
            <th className="px-5 py-3 font-medium">Presença</th>
            <th className="px-5 py-3 font-medium">Rostos</th>
            <th className="px-5 py-3 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sessions.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-5 py-3">
                <Link href={`/attendance/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                  {formatDateTime(s.takenAt)}
                </Link>
              </td>
              <td className="px-5 py-3">{s.classroom.name}</td>
              <td className="px-5 py-3">
                {s.status === "CONFIRMED" ? `${s.presentCount} / ${s._count.attendances}` : "—"}
              </td>
              <td className="px-5 py-3 text-slate-600">
                {s.facesDetected} ({s.recognizedCount} automático{s.recognizedCount === 1 ? "" : "s"})
              </td>
              <td className="px-5 py-3">
                {s.status === "CONFIRMED" ? <Badge tone="green">Confirmada</Badge> : <Badge tone="amber">Em revisão</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
