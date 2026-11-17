"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LAST_CLASSROOM_COOKIE } from "@/lib/preferences";
import { addAttendancePhoto, createAttendanceSession } from "../actions";
import { Alert, Card, buttonClass, plural } from "@/components/ui";
import { Icon, Spinner } from "@/components/icons";
import { downscale } from "./downscale";

type Classroom = { id: string; name: string; studentCount: number; withFaceCount: number };
type Photo = { file: File; url: string };
// preparing/analyzing: andamento da foto `current` de `total`.
type Progress = { phase: "idle" } | { phase: "preparing" | "analyzing"; current: number; total: number };

// Turmas grandes podem ser fotografadas em partes; o sistema junta os rostos.
const MAX_PHOTOS = 5;

const tips = [
  "Todos de frente e com o rosto visível",
  "Boa iluminação, sem luz forte atrás dos alunos",
  "Sem bonés, óculos escuros ou mãos no rosto",
  "Turma grande? Tire 2 ou 3 fotos de partes da turma — o sistema junta tudo e não repete ninguém",
];

export function UploadPhotoForm({
  classrooms,
  defaultClassroomId,
}: {
  classrooms: Classroom[];
  defaultClassroomId?: string;
}) {
  const router = useRouter();
  const [classroomId, setClassroomId] = useState(
    classrooms.some((c) => c.id === defaultClassroomId) ? defaultClassroomId! : classrooms[0]!.id,
  );
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const photoSectionRef = useRef<HTMLDivElement>(null);

  // Libera as pré-visualizações ao sair da página.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function addFiles(list: FileList | File[] | null | undefined) {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    if (files.some((f) => !f.type.startsWith("image/") && f.type !== "")) {
      setError("O arquivo escolhido não é uma imagem. Escolha uma foto (JPEG, PNG ou HEIC).");
      return;
    }
    setError(null);
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length;
      if (files.length > room) setError(`Use no máximo ${MAX_PHOTOS} fotos por chamada.`);
      return [...prev, ...files.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))];
    });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index]!.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function chooseClassroom(id: string) {
    setClassroomId(id);
    // No celular, leva o professor direto para o próximo passo.
    if (photos.length === 0 && window.matchMedia("(max-width: 1023px)").matches) {
      photoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (photos.length === 0) return setError("Tire ou escolha uma foto da turma.");
    setError(null);
    // Lembra a turma para a próxima chamada já vir com ela selecionada.
    document.cookie = `${LAST_CLASSROOM_COOKIE}=${encodeURIComponent(classroomId)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    const total = photos.length;
    startTransition(async () => {
      // 1ª foto cria a chamada; as demais são acrescentadas a ela.
      setProgress({ phase: "preparing", current: 1, total });
      const first = new FormData();
      first.set("classroomId", classroomId);
      first.set("photo", await downscale(photos[0]!.file), "turma.jpg");
      setProgress({ phase: "analyzing", current: 1, total });
      const created = await createAttendanceSession(first);
      if ("error" in created) {
        setError(total > 1 ? `Foto 1: ${created.error}` : created.error);
        setProgress({ phase: "idle" });
        return;
      }

      let failed = 0;
      let duplicates = 0;
      for (let i = 1; i < total; i++) {
        setProgress({ phase: "preparing", current: i + 1, total });
        const extra = new FormData();
        extra.set("sessionId", created.sessionId);
        extra.set("photo", await downscale(photos[i]!.file), "turma.jpg");
        setProgress({ phase: "analyzing", current: i + 1, total });
        const result = await addAttendancePhoto(extra);
        if ("error" in result) failed++;
        else duplicates += result.duplicates;
      }

      const params = new URLSearchParams();
      if (failed) params.set("fotosComErro", String(failed));
      if (duplicates) params.set("repetidos", String(duplicates));
      const query = params.size ? `?${params}` : "";
      router.push(`/attendance/${created.sessionId}${query}`);
    });
  }

  const selected = classrooms.find((c) => c.id === classroomId)!;
  const noStudents = selected.studentCount === 0;
  const busy = pending || progress.phase !== "idle";
  const canAddMore = photos.length < MAX_PHOTOS;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {/* Passo 1 — turma */}
        <Card>
          <StepTitle step={1} title="Escolha a turma" />
          <fieldset disabled={busy}>
            <legend className="sr-only">Turma</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {classrooms.map((c) => {
                const checked = c.id === classroomId;
                return (
                  <label
                    key={c.id}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-brand-500 ${
                      checked ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="classroom"
                      value={c.id}
                      checked={checked}
                      onChange={() => chooseClassroom(c.id)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        checked ? "border-brand-600 bg-brand-600" : "border-slate-300"
                      }`}
                    >
                      {checked && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{c.name}</span>
                      <span className="block text-xs text-slate-500">
                        {c.studentCount === 0 ? "Sem alunos ativos" : plural(c.studentCount, "aluno", "alunos")}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {noStudents && (
            <Alert
              tone="warning"
              className="mt-4"
              action={
                <Link href={`/classes/${selected.id}`} className={buttonClass("secondary", "sm")}>
                  Adicionar alunos
                </Link>
              }
            >
              Esta turma ainda não tem alunos ativos.
            </Alert>
          )}
          {!noStudents && selected.withFaceCount === 0 && (
            <Alert tone="info" className="mt-4" title="Primeira chamada desta turma?">
              Ninguém tem rosto cadastrado ainda, então você vai identificar cada aluno na próxima tela. Nas chamadas
              seguintes, o reconhecimento passa a ser automático.
            </Alert>
          )}
        </Card>

        {/* Passo 2 — fotos */}
        <Card className="scroll-mt-20">
          <div ref={photoSectionRef} className="scroll-mt-20">
            <StepTitle step={2} title="Foto da turma" />
          </div>

          {photos.length > 0 ? (
            <div className="space-y-3">
              {photos.length === 1 ? (
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:) */}
                  <img src={photos[0]!.url} alt="Pré-visualização da foto" className="mx-auto max-h-[420px] w-auto object-contain" />
                  <RemoveButton disabled={busy} onClick={() => removePhoto(0)} label="Remover foto" />
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((p, i) => (
                    <li key={p.url} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:) */}
                      <img
                        src={p.url}
                        alt={i === 0 ? "Pré-visualização da foto" : `Pré-visualização da foto ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                        Foto {i + 1}
                      </span>
                      <RemoveButton disabled={busy} onClick={() => removePhoto(i)} label={`Remover foto ${i + 1}`} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                  <Icon name="checkCircle" className="h-4 w-4" />
                  {photos.length === 1 ? "Foto pronta para análise" : `${photos.length} fotos prontas para análise`}
                </p>
                {canAddMore && (
                  <div className="flex flex-wrap gap-2">
                    <label className={`${buttonClass("secondary", "sm")} lg:hidden ${busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
                      <Icon name="camera" className="h-4 w-4" />
                      Tirar outra
                      <input
                        type="file"
                        name="photo-camera"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => {
                          addFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <label className={`${buttonClass("secondary", "sm")} ${busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
                      <Icon name="plus" className="h-4 w-4" />
                      Adicionar foto
                      <input
                        type="file"
                        name="photo"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => {
                          addFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
              {photos.length === 1 && (
                <p className="text-xs text-slate-500">
                  Alguém ficou de fora? Adicione outra foto: o sistema junta os rostos e não repete ninguém.
                </p>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:py-10 ${
                dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/50"
              }`}
            >
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <Icon name="camera" className="h-7 w-7" />
              </span>
              <p className="font-semibold text-slate-900">Fotografe a turma inteira</p>
              <p className="mt-1 text-sm text-slate-500">
                <span className="lg:hidden">Use a câmera do celular ou escolha fotos da galeria.</span>
                <span className="hidden lg:inline">Arraste as fotos para cá ou escolha os arquivos.</span>
              </p>
              <div className="mt-5 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
                <label className={`${buttonClass("primary", "lg")} cursor-pointer lg:hidden`}>
                  <Icon name="camera" className="h-5 w-5" />
                  Tirar foto
                  <input
                    type="file"
                    name="photo-camera"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label
                  className={`${buttonClass("secondary", "lg")} cursor-pointer lg:border-transparent lg:bg-brand-600 lg:text-white lg:hover:bg-brand-700`}
                >
                  <Icon name="image" className="h-5 w-5" />
                  <span className="lg:hidden">Galeria</span>
                  <span className="hidden lg:inline">Escolher arquivo</span>
                  <input
                    type="file"
                    name="photo"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="mt-4 text-xs text-slate-500">Turma grande? Você pode usar até {MAX_PHOTOS} fotos.</p>
            </div>
          )}
        </Card>

        {error && (
          <Alert tone="error" title="Não foi possível processar a foto">
            {error}
          </Alert>
        )}

        {progress.phase !== "idle" && <ProcessingStatus progress={progress} />}

        <div className="space-y-2">
          <button
            type="submit"
            disabled={busy || photos.length === 0 || noStudents}
            aria-busy={busy}
            className={buttonClass("primary", "lg", "w-full sm:w-auto sm:min-w-64")}
          >
            {busy ? <Spinner className="h-5 w-5" /> : <Icon name="scan" className="h-5 w-5" />}
            {busy ? "Detectando e reconhecendo rostos..." : photos.length > 1 ? `Processar ${photos.length} fotos` : "Processar foto"}
          </button>
          {photos.length === 0 && !noStudents && <p className="text-xs text-slate-500">Adicione a foto para continuar.</p>}
        </div>
      </div>

      {/* Lateral: orientações e privacidade */}
      <aside className="space-y-4 lg:sticky lg:top-10 lg:self-start">
        <Card className="bg-slate-50/60">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Icon name="sparkles" className="h-4 w-4 text-brand-600" />
            Dicas para uma boa foto
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-600">
            {tips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {tip}
              </li>
            ))}
          </ul>
        </Card>
        <p className="flex gap-2 px-1 text-xs leading-relaxed text-slate-500">
          <Icon name="shield" className="h-4 w-4 shrink-0 text-slate-400" />
          As fotos são processadas e descartadas. Apenas os recortes dos rostos ficam guardados até a chamada ser confirmada.
        </p>
      </aside>
    </form>
  );
}

function RemoveButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="absolute top-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-50"
    >
      <Icon name="x" className="h-4 w-4" />
    </button>
  );
}

function StepTitle({ step, title }: { step: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-semibold text-slate-900">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
        {step}
      </span>
      {title}
    </h2>
  );
}

function ProcessingStatus({ progress }: { progress: Exclude<Progress, { phase: "idle" }> }) {
  const steps = [
    { key: "preparing", label: "Preparando a foto" },
    { key: "analyzing", label: "Encontrando e reconhecendo os rostos" },
  ] as const;
  const current = steps.findIndex((s) => s.key === progress.phase);
  return (
    <Card className="border-brand-200 bg-brand-50/50" aria-live="polite">
      {progress.total > 1 && (
        <p className="mb-3 text-sm font-semibold text-brand-900">
          Foto {progress.current} de {progress.total}
        </p>
      )}
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.key} className={`flex items-center gap-3 text-sm ${active ? "font-semibold text-brand-900" : done ? "text-slate-600" : "text-slate-400"}`}>
              {done ? (
                <Icon name="checkCircle" className="h-5 w-5 text-emerald-600" />
              ) : active ? (
                <Spinner className="h-5 w-5 text-brand-600" />
              ) : (
                <span className="h-5 w-5 rounded-full border-2 border-slate-300" />
              )}
              {s.label}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-slate-500">Isso pode levar até um minuto por foto em turmas grandes. Não feche esta página.</p>
    </Card>
  );
}
