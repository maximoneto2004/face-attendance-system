"use client";

import { useState, useTransition } from "react";
import { createAttendanceSession } from "../actions";
import { Card, ErrorMessage, buttonStyles, inputStyles } from "@/components/ui";

// Reduz a foto no navegador antes do envio: upload mais rápido no celular e
// conversão automática de formatos como HEIC para JPEG.
const MAX_SIDE = 2400;

async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function UploadPhotoForm({
  classrooms,
  defaultClassroomId,
}: {
  classrooms: { id: string; name: string; studentCount: number }[];
  defaultClassroomId?: string;
}) {
  const [classroomId, setClassroomId] = useState(
    classrooms.some((c) => c.id === defaultClassroomId) ? defaultClassroomId! : classrooms[0]!.id,
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function selectFile(selected: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Selecione ou tire uma foto da turma.");
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("classroomId", classroomId);
      formData.set("photo", await downscale(file), "turma.jpg");
      const result = await createAttendanceSession(formData);
      if (result?.error) setError(result.error);
    });
  }

  const selected = classrooms.find((c) => c.id === classroomId);

  return (
    <Card className="max-w-2xl">
      <form onSubmit={submit} className="space-y-5">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Turma</span>
          <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)} className={inputStyles}>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.studentCount} alunos)
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium">Foto da turma</span>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-indigo-400">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:)
              <img src={preview} alt="Pré-visualização da foto" className="max-h-80 rounded-lg object-contain" />
            ) : (
              <>
                <span className="text-sm font-medium text-indigo-600">Tirar foto ou escolher arquivo</span>
                <span className="text-xs text-slate-500">Todos os alunos de frente, com boa iluminação.</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <ErrorMessage message={error} />

        <button type="submit" disabled={pending || !file || selected?.studentCount === 0} className={buttonStyles.primary}>
          {pending ? "Detectando e reconhecendo rostos..." : "Processar foto"}
        </button>
        {selected?.studentCount === 0 && (
          <p className="text-sm text-amber-700">Esta turma não possui alunos ativos.</p>
        )}
        <p className="text-xs text-slate-500">
          A foto é processada e descartada — apenas os recortes dos rostos ficam guardados até a chamada ser
          confirmada.
        </p>
      </form>
    </Card>
  );
}
