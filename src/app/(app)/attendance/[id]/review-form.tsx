"use client";

import { useMemo, useState, useTransition } from "react";
import { confirmAttendanceSession } from "../actions";
import { Badge, Card, ErrorMessage, buttonStyles, formatPercent } from "@/components/ui";

type FaceStatus = "AUTO" | "REVIEW" | "UNKNOWN";

export type ReviewFace = {
  id: string;
  status: FaceStatus;
  suggestedStudentId: string | null;
  similarity: number | null;
};

export type ReviewStudent = { id: string; name: string; hasFace: boolean };

// decided = professor já decidiu (ou reconhecimento automático). Rostos não
// decididos são ignorados na confirmação.
type Decision = { studentId: string | null; decided: boolean };

const statusOrder: Record<FaceStatus, number> = { REVIEW: 0, UNKNOWN: 1, AUTO: 2 };

export function ReviewForm({
  sessionId,
  faces,
  students,
}: {
  sessionId: string;
  faces: ReviewFace[];
  students: ReviewStudent[];
}) {
  // Rostos que precisam de atenção primeiro. Ordem fixa para os cartões não "pularem".
  const orderedFaces = useMemo(
    () => [...faces].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]),
    [faces],
  );
  const studentsById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  // Alunos ainda sem rosto cadastrado são os candidatos mais prováveis para rostos desconhecidos.
  const studentGroups = useMemo(
    () => [
      { label: "Sem rosto cadastrado", students: students.filter((s) => !s.hasFace) },
      { label: "Com rosto cadastrado", students: students.filter((s) => s.hasFace) },
    ],
    [students],
  );

  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(
      faces.map((f) => [
        f.id,
        f.status === "AUTO"
          ? { studentId: f.suggestedStudentId, decided: true }
          : { studentId: f.status === "REVIEW" ? f.suggestedStudentId : null, decided: false },
      ]),
    ),
  );
  const [manualPresent, setManualPresent] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setDecision = (faceId: string, decision: Decision) =>
    setDecisions((prev) => ({ ...prev, [faceId]: decision }));

  // Aluno -> rosto ao qual está atribuído (somente decisões confirmadas).
  const assignedFaceByStudent = new Map<string, string>();
  for (const [faceId, d] of Object.entries(decisions)) {
    if (d.decided && d.studentId) assignedFaceByStudent.set(d.studentId, faceId);
  }
  const pendingCount = Object.values(decisions).filter((d) => !d.decided).length;
  const notInPhoto = students.filter((s) => !assignedFaceByStudent.has(s.id));
  const presentCount = assignedFaceByStudent.size + [...manualPresent].filter((id) => !assignedFaceByStudent.has(id)).length;

  const counts = {
    auto: faces.filter((f) => f.status === "AUTO").length,
    review: faces.filter((f) => f.status === "REVIEW").length,
    unknown: faces.filter((f) => f.status === "UNKNOWN").length,
  };

  function submit() {
    if (
      pendingCount > 0 &&
      !window.confirm(`${pendingCount} rosto(s) ainda não revisado(s) serão ignorados. Confirmar a chamada mesmo assim?`)
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await confirmAttendanceSession({
        sessionId,
        faces: faces.map((f) => {
          const d = decisions[f.id]!;
          return { faceId: f.id, studentId: d.decided ? d.studentId : null };
        }),
        manualPresentIds: [...manualPresent].filter((id) => !assignedFaceByStudent.has(id)),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-base font-semibold">{faces.length} rosto(s) detectado(s)</span>
        <span className="text-emerald-700">✅ {counts.auto} reconhecido(s)</span>
        <span className="text-amber-700">⚠️ {counts.review} para confirmar</span>
        <span className="text-slate-600">❓ {counts.unknown} desconhecido(s)</span>
      </Card>

      {counts.auto + counts.review === 0 && (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Nenhum rosto foi reconhecido — normal nas primeiras chamadas. Identifique cada rosto abaixo: ao confirmar, os
          rostos identificados serão cadastrados e reconhecidos automaticamente nas próximas chamadas.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orderedFaces.map((face) => {
          const d = decisions[face.id]!;
          const suggested = face.suggestedStudentId ? studentsById.get(face.suggestedStudentId) : undefined;
          const border = !d.decided
            ? "border-amber-300 ring-2 ring-amber-100"
            : d.studentId
              ? "border-emerald-300"
              : "border-slate-200 opacity-60";
          return (
            <div key={face.id} className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${border}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- recorte privado servido por rota autenticada */}
              <img
                src={`/api/faces/${face.id}/image`}
                alt="Rosto detectado"
                className="aspect-square w-full bg-slate-100 object-cover"
              />
              <div className="flex flex-1 flex-col gap-3 p-3">
                <FaceStatusLine face={face} suggestedName={suggested?.name} />

                {face.status === "REVIEW" && !d.decided && d.studentId === face.suggestedStudentId && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`${buttonStyles.primary} flex-1 px-2 py-1.5`}
                      disabled={assignedFaceByStudent.has(face.suggestedStudentId!)}
                      onClick={() => setDecision(face.id, { studentId: face.suggestedStudentId, decided: true })}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className={`${buttonStyles.secondary} flex-1 px-2 py-1.5`}
                      onClick={() => setDecision(face.id, { studentId: null, decided: false })}
                    >
                      Corrigir
                    </button>
                  </div>
                )}

                <select
                  aria-label="Aluno deste rosto"
                  className="mt-auto w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  value={d.decided ? (d.studentId ?? "__ignore") : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") setDecision(face.id, { studentId: null, decided: false });
                    else if (value === "__ignore") setDecision(face.id, { studentId: null, decided: true });
                    else setDecision(face.id, { studentId: value, decided: true });
                  }}
                >
                  <option value="">Selecionar aluno…</option>
                  <option value="__ignore">Ignorar (não é aluno / rosto ruim)</option>
                  {studentGroups.map((group) =>
                    group.students.length === 0 ? null : (
                      <optgroup key={group.label} label={group.label}>
                        {group.students.map((s) => {
                          const taken = assignedFaceByStudent.has(s.id) && assignedFaceByStudent.get(s.id) !== face.id;
                          return (
                            <option key={s.id} value={s.id} disabled={taken}>
                              {s.name}
                              {taken ? " (já atribuído)" : ""}
                            </option>
                          );
                        })}
                      </optgroup>
                    ),
                  )}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <h2 className="font-medium">Alunos não identificados na foto ({notInPhoto.length})</h2>
        <p className="mb-3 text-sm text-slate-500">
          Serão marcados como ausentes. Marque quem estava presente mas não aparece na foto.
        </p>
        {notInPhoto.length === 0 ? (
          <p className="text-sm text-slate-500">Todos os alunos da turma foram identificados.</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {notInPhoto.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={manualPresent.has(s.id)}
                  onChange={(e) =>
                    setManualPresent((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(s.id);
                      else next.delete(s.id);
                      return next;
                    })
                  }
                />
                {s.name}
                <span className="text-xs text-slate-400">— presente (manual)</span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="text-sm">
          <strong>{presentCount}</strong> de {students.length} presente(s)
          {pendingCount > 0 && <span className="ml-3 text-amber-700">{pendingCount} rosto(s) pendente(s)</span>}
        </div>
        <div className="flex items-center gap-3">
          <ErrorMessage message={error} />
          <button type="button" onClick={submit} disabled={pending} className={buttonStyles.primary}>
            {pending ? "Salvando..." : "Confirmar chamada"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FaceStatusLine({ face, suggestedName }: { face: ReviewFace; suggestedName?: string }) {
  if (face.status === "AUTO") {
    return (
      <div className="space-y-1">
        <Badge tone="green">Reconhecido</Badge>
        <p className="text-sm font-medium">{suggestedName}</p>
        <p className="text-xs text-slate-500">Similaridade: {formatPercent(face.similarity!)}</p>
      </div>
    );
  }
  if (face.status === "REVIEW") {
    return (
      <div className="space-y-1">
        <Badge tone="amber">Possível aluno</Badge>
        <p className="text-sm font-medium">{suggestedName}</p>
        <p className="text-xs text-slate-500">Similaridade: {formatPercent(face.similarity!)}</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Badge>Rosto desconhecido</Badge>
      <p className="text-xs text-slate-500">Selecione o aluno para cadastrar este rosto.</p>
    </div>
  );
}
