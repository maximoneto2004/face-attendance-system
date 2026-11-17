import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { classroomScope } from "@/lib/access";

// Planilha de frequência da turma (CSV que abre direto no Excel/Google Planilhas).
// Somente leitura. ?mes=AAAA-MM limita a um mês; sem parâmetro, traz todas as chamadas confirmadas.
const TIME_ZONE = "America/Sao_Paulo";

function csvCell(value: string | number) {
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function monthRange(mes: string | null) {
  if (!mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return null;
  const [year, month] = mes.split("-").map(Number);
  // Brasília não tem horário de verão desde 2019: UTC-3 fixo.
  const start = new Date(Date.UTC(year, month - 1, 1, 3));
  const end = new Date(Date.UTC(year, month, 1, 3));
  return { start, end };
}

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: Request, { params }: RouteContext<"/api/classes/[id]/frequencia">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const mes = new URL(request.url).searchParams.get("mes");
  const range = monthRange(mes);

  const classroom = await db.classroom.findFirst({
    where: { id, ...classroomScope(user) },
    select: {
      name: true,
      students: { where: { student: { active: true } }, select: { student: { select: { id: true, name: true } } } },
      attendanceSessions: {
        where: { status: "CONFIRMED", ...(range ? { takenAt: { gte: range.start, lt: range.end } } : {}) },
        orderBy: { takenAt: "asc" },
        select: {
          takenAt: true,
          attendances: { select: { studentId: true, present: true, student: { select: { name: true } } } },
        },
      },
    },
  });
  if (!classroom) return Response.json({ error: "Turma não encontrada." }, { status: 404 });

  // Alunos: membros ativos + quem aparece em alguma chamada do período (mesmo se saiu da turma).
  const names = new Map(classroom.students.map(({ student }) => [student.id, student.name]));
  for (const s of classroom.attendanceSessions) for (const a of s.attendances) names.set(a.studentId, a.student.name);
  const students = [...names.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

  const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE });
  const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
  const sessionDays = classroom.attendanceSessions.map((s) => dateFmt.format(s.takenAt));
  const header = classroom.attendanceSessions.map((s, i) =>
    // Duas chamadas no mesmo dia: inclui a hora para diferenciar.
    sessionDays.filter((d) => d === sessionDays[i]).length > 1 ? `${sessionDays[i]} ${timeFmt.format(s.takenAt)}` : sessionDays[i],
  );

  const lines = [["Aluno", ...header, "Presenças", "Faltas", "Frequência"].map(csvCell).join(";")];
  for (const [studentId, name] of students) {
    let present = 0;
    let total = 0;
    const cells = classroom.attendanceSessions.map((s) => {
      const record = s.attendances.find((a) => a.studentId === studentId);
      if (!record) return ""; // aluno não estava na turma nessa data
      total++;
      if (record.present) present++;
      return record.present ? "P" : "F";
    });
    const rate = total === 0 ? "" : `${Math.round((present / total) * 100)}%`;
    lines.push([name, ...cells, present, total - present, rate].map(csvCell).join(";"));
  }
  lines.push("");
  lines.push(csvCell("P = presente · F = falta · vazio = aluno ainda não estava na turma"));

  const filename = `frequencia-${slug(classroom.name) || "turma"}-${range ? mes : "completa"}.csv`;
  // BOM para o Excel reconhecer UTF-8 (acentos); ";" é o separador padrão do Excel em português.
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
