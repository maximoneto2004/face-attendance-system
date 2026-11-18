"use client";

import { useMemo, useState, useTransition } from "react";
import { confirmAttendanceSession } from "../actions";
import { Alert, Avatar, Card, ProgressBar, buttonClass, formatPercent, inputStyles, plural } from "@/components/ui";
import { Icon, Spinner } from "@/components/icons";

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
const SEARCH_THRESHOLD = 12;

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

  // Decisões explícitas do professor. Rostos sem decisão usam a sugestão do sistema
  // (assim, rostos de uma foto adicionada depois entram sem apagar o que já foi feito).
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [manualPresent, setManualPresent] = useState<Set<string>>(new Set());
  const [manualSearch, setManualSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setDecision = (faceId: string, decision: Decision) =>
    setDecisions((prev) => ({ ...prev, [faceId]: decision }));

  // Aluno -> rosto ao qual está atribuído (somente decisões confirmadas).
  // Primeiro as decisões explícitas; depois os reconhecimentos automáticos, que
  // cedem lugar se o professor já atribuiu o aluno a outro rosto.
  const assignedFaceByStudent = new Map<string, string>();
  const resolved = new Map<string, Decision>();
  for (const f of faces) {
    const d = decisions[f.id];
    if (!d) continue;
    resolved.set(f.id, d);
    if (d.decided && d.studentId) assignedFaceByStudent.set(d.studentId, f.id);
  }
  for (const f of faces) {
    if (resolved.has(f.id)) continue;
    if (f.status === "AUTO" && f.suggestedStudentId && !assignedFaceByStudent.has(f.suggestedStudentId)) {
      resolved.set(f.id, { studentId: f.suggestedStudentId, decided: true });
      assignedFaceByStudent.set(f.suggestedStudentId, f.id);
    } else {
      resolved.set(f.id, { studentId: f.status === "REVIEW" ? f.suggestedStudentId : null, decided: false });
    }
  }
  const decisionFor = (faceId: string) => resolved.get(faceId)!;
  const pendingCount = faces.filter((f) => !decisionFor(f.id).decided).length;
  const reviewedCount = faces.length - pendingCount;
  const notInPhoto = students.filter((s) => !assignedFaceByStudent.has(s.id));
  const presentCount = assignedFaceByStudent.size + [...manualPresent].filter((id) => !assignedFaceByStudent.has(id)).length;

  const counts = {
    auto: faces.filter((f) => f.status === "AUTO").length,
    review: faces.filter((f) => f.status === "REVIEW").length,
    unknown: faces.filter((f) => f.status === "UNKNOWN").length,
  };

  // Sugestões ainda abertas que podem ser aceitas em lote.
  const acceptable = faces.filter((f) => {
    const d = decisionFor(f.id);
    return (
      f.status === "REVIEW" &&
      !d.decided &&
      f.suggestedStudentId !== null &&
      d.studentId === f.suggestedStudentId &&
      !assignedFaceByStudent.has(f.suggestedStudentId)
    );
  });

  function acceptAllSuggestions() {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const f of acceptable) next[f.id] = { studentId: f.suggestedStudentId, decided: true };
      return next;
    });
  }

  function toggleManual(id: string) {
    setManualPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (
      pendingCount > 0 &&
      !window.confirm(
        `${plural(pendingCount, "rosto ainda não foi revisado e será ignorado", "rostos ainda não foram revisados e serão ignorados")}. Confirmar a chamada mesmo assim?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await confirmAttendanceSession({
        sessionId,
        faces: faces.map((f) => {
          const d = decisionFor(f.id);
          return { faceId: f.id, studentId: d.decided ? d.studentId : null };
        }),
        manualPresentIds: [...manualPresent].filter((id) => !assignedFaceByStudent.has(id)),
      });
      if (result?.error) setError(result.error);
    });
  }

  const normalizedSearch = manualSearch.trim().toLocaleLowerCase("pt-BR");
  const visibleNotInPhoto = normalizedSearch
    ? notInPhoto.filter((s) => s.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch))
    : notInPhoto;

  return (
    <div className="space-y-6">
      {/* Resumo e progresso */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">{plural(faces.length, "rosto detectado", "rostos detectados")}</p>
            <p className="text-sm text-slate-500">
              {pendingCount === 0
                ? "Todos os rostos foram revisados. Confira os ausentes e confirme."
                : `Revise ${plural(pendingCount, "rosto destacado", "rostos destacados")} em amarelo.`}
            </p>
          </div>
          {acceptable.length > 1 && (
            <button type="button" onClick={acceptAllSuggestions} className={buttonClass("secondary", "md")}>
              <Icon name="check" className="h-4 w-4" />
              Aceitar {acceptable.length} sugestões
            </button>
          )}
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-500">
            <span>Revisão</span>
            <span className="tabular-nums">
              {reviewedCount} de {faces.length}
            </span>
          </div>
          <ProgressBar value={reviewedCount} max={faces.length} tone={pendingCount === 0 ? "green" : "brand"} label="Rostos revisados" />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Count tone="green" icon="checkCircle" label={counts.auto === 1 ? "Reconhecido" : "Reconhecidos"} value={counts.auto} />
          <Count tone="amber" icon="help" label="Para confirmar" value={counts.review} />
          <Count tone="slate" icon="scan" label={counts.unknown === 1 ? "Desconhecido" : "Desconhecidos"} value={counts.unknown} />
        </dl>
      </Card>

      {counts.auto + counts.review === 0 && (
        <Alert tone="info" title="Nenhum rosto foi reconhecido — normal nas primeiras chamadas">
          Escolha o aluno de cada rosto abaixo. Ao confirmar, esses rostos serão cadastrados e reconhecidos
          automaticamente nas próximas chamadas.
        </Alert>
      )}

      {/* Rostos */}
      <section aria-label="Rostos detectados">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {orderedFaces.map((face) => {
            const d = decisionFor(face.id);
            const suggested = face.suggestedStudentId ? studentsById.get(face.suggestedStudentId) : undefined;
            const assigned = d.studentId ? studentsById.get(d.studentId) : undefined;
            const asking = face.status === "REVIEW" && !d.decided && d.studentId === face.suggestedStudentId && !!suggested;
            const suggestionTaken = !!face.suggestedStudentId && assignedFaceByStudent.has(face.suggestedStudentId);
            const state = !d.decided ? "pending" : d.studentId ? "assigned" : "ignored";
            const frame = {
              pending: "border-amber-300 ring-2 ring-amber-200",
              assigned: "border-emerald-300",
              ignored: "border-slate-200",
            }[state];

            return (
              <li key={face.id} className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-xs ${frame}`}>
                <div className="relative">
                  <FaceImage faceId={face.id} dimmed={state === "ignored"} />
                  <span className="absolute top-2 left-2">
                    <StateBadge state={state} status={face.status} />
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2.5 p-3">
                  {asking ? (
                    <div>
                      <p className="text-xs text-slate-500">Este é…</p>
                      <p className="truncate text-sm font-semibold text-slate-900">{suggested!.name}?</p>
                      <p className="text-xs text-slate-500">Semelhança: {formatPercent(face.similarity!)}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={suggestionTaken}
                          onClick={() => setDecision(face.id, { studentId: face.suggestedStudentId, decided: true })}
                          className={buttonClass("success", "sm", "px-2")}
                        >
                          <Icon name="check" className="h-4 w-4" />
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecision(face.id, { studentId: null, decided: false })}
                          className={buttonClass("secondary", "sm", "px-2")}
                        >
                          Não
                        </button>
                      </div>
                      {suggestionTaken && <p className="mt-1 text-xs text-amber-700">Aluno já atribuído a outro rosto.</p>}
                    </div>
                  ) : state === "assigned" ? (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{assigned?.name}</p>
                      <p className="text-xs text-slate-500">
                        {face.status === "AUTO" && d.studentId === face.suggestedStudentId
                          ? `Automático · ${formatPercent(face.similarity!)}`
                          : "Identificado por você"}
                      </p>
                    </div>
                  ) : state === "ignored" ? (
                    <p className="text-sm text-slate-500">Ignorado — não será contado.</p>
                  ) : (
                    <p className="text-sm font-medium text-slate-800">Quem é este aluno?</p>
                  )}

                  <select
                    aria-label="Aluno deste rosto"
                    className={`${inputStyles} mt-auto py-2 sm:text-sm`}
                    value={d.decided ? (d.studentId ?? "__ignore") : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") setDecision(face.id, { studentId: null, decided: false });
                      else if (value === "__ignore") setDecision(face.id, { studentId: null, decided: true });
                      else setDecision(face.id, { studentId: value, decided: true });
                    }}
                  >
                    {/* Rótulos curtos: no celular o cartão tem ~170px e textos longos eram cortados. */}
                    <option value="">{asking ? "Outro aluno" : "Escolher"}</option>
                    <option value="__ignore">Ignorar</option>
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
                  {state === "pending" && !asking && (
                    <button
                      type="button"
                      onClick={() => setDecision(face.id, { studentId: null, decided: true })}
                      className="h-8 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    >
                      Não é aluno desta turma
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Presença manual */}
      <Card>
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">Alunos que não aparecem na foto ({notInPhoto.length})</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Ficarão como ausentes. Toque em quem estava na aula mas ficou fora da foto para marcar presença manual.
          </p>
        </div>
        {notInPhoto.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <Icon name="checkCircle" className="h-4 w-4" />
            Todos os alunos da turma foram identificados na foto.
          </p>
        ) : (
          <>
            {notInPhoto.length > SEARCH_THRESHOLD && (
              <div className="relative mb-3">
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  placeholder="Buscar aluno"
                  aria-label="Buscar aluno"
                  className={`${inputStyles} pl-9`}
                />
              </div>
            )}
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibleNotInPhoto.map((s) => {
                const on = manualPresent.has(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      data-track={on ? "Desmarcar presença manual" : "Marcar presença manual"}
                      aria-pressed={on}
                      onClick={() => toggleManual(s.id)}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                        on ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <Avatar name={s.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{s.name}</span>
                      {on ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <Icon name="check" className="h-4 w-4" />
                          Presente
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Ausente</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {visibleNotInPhoto.length === 0 && <p className="text-sm text-slate-500">Nenhum aluno encontrado.</p>}
          </>
        )}
      </Card>

      {/* Barra de confirmação fixa (acima da navegação inferior no celular) */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        {error && <Alert tone="error" className="mb-2 shadow-lg">{error}</Alert>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:px-5">
          <div className="text-sm">
            <p>
              <strong className="text-base tabular-nums text-slate-900">{presentCount}</strong>
              <span className="text-slate-600">
                {" "}
                de {students.length} {presentCount === 1 ? "presente" : "presentes"}
              </span>
            </p>
            {pendingCount > 0 ? (
              <p className="text-xs font-medium text-amber-700">{plural(pendingCount, "rosto pendente", "rostos pendentes")}</p>
            ) : (
              <p className="text-xs text-emerald-700">Revisão completa</p>
            )}
          </div>
          <button type="button" onClick={submit} disabled={pending} aria-busy={pending} className={buttonClass("primary", "md", "flex-1 sm:flex-none sm:min-w-48")}>
            {pending ? <Spinner /> : <Icon name="check" className="h-4 w-4" />}
            {pending ? "Salvando..." : "Confirmar chamada"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Recorte do rosto com nova tentativa automática: em conexões móveis instáveis a
// imagem pode falhar, e um ícone quebrado deixaria o professor sem saber o que fazer.
const MAX_AUTO_RETRIES = 2;

function FaceImage({ faceId, dimmed }: { faceId: string; dimmed: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setAttempt((a) => a + 1);
        }}
        className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-slate-100 px-3 text-center text-xs text-slate-500 hover:bg-slate-200"
      >
        <Icon name="image" className="h-6 w-6 text-slate-400" />
        Imagem não carregou.
        <span className="font-semibold text-brand-700">Toque para recarregar</span>
      </button>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- recorte privado servido por rota autenticada
    <img
      src={`/api/faces/${faceId}/image${attempt > 0 ? `?tentativa=${attempt}` : ""}`}
      alt="Rosto detectado"
      onError={() => {
        if (attempt < MAX_AUTO_RETRIES) setTimeout(() => setAttempt((a) => a + 1), 600 * (attempt + 1));
        else setFailed(true);
      }}
      className={`aspect-square w-full bg-slate-100 object-cover ${dimmed ? "opacity-40 grayscale" : ""}`}
    />
  );
}

function Count({
  tone,
  icon,
  label,
  value,
}: {
  tone: "green" | "amber" | "slate";
  icon: "checkCircle" | "help" | "scan";
  label: string;
  value: number;
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className={`rounded-xl px-2 py-2.5 ${tones[tone]}`}>
      <dt className="flex items-center justify-center gap-1 text-xs font-medium">
        <Icon name={icon} className="hidden h-4 w-4 sm:block" />
        {label}
      </dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function StateBadge({ state, status }: { state: "pending" | "assigned" | "ignored"; status: FaceStatus }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm";
  if (state === "assigned") {
    return (
      <span className={`${base} bg-emerald-600 text-white`}>
        <Icon name="check" className="h-3.5 w-3.5" />
        {status === "AUTO" ? "Reconhecido" : "Presente"}
      </span>
    );
  }
  if (state === "ignored") return <span className={`${base} bg-slate-700 text-white`}>Ignorado</span>;
  return (
    <span className={`${base} bg-amber-400 text-amber-950`}>
      {status === "REVIEW" ? "Confirmar" : "Desconhecido"}
    </span>
  );
}
