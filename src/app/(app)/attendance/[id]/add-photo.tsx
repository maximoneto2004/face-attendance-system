"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addAttendancePhoto } from "../actions";
import { downscale } from "../new/downscale";
import { Alert, buttonClass, plural } from "@/components/ui";
import { Icon, Spinner } from "@/components/icons";

// Acrescenta outra foto à chamada em revisão (alguém ficou de fora da primeira).
export function AddPhoto({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function send(files: FileList | null) {
    const list = [...(files ?? [])];
    if (list.length === 0) return;
    setMessage(null);
    startTransition(async () => {
      let added = 0;
      let duplicates = 0;
      const errors: string[] = [];
      for (const file of list) {
        const data = new FormData();
        data.set("sessionId", sessionId);
        data.set("photo", await downscale(file), "turma.jpg");
        const result = await addAttendancePhoto(data);
        if ("error" in result) errors.push(result.error);
        else {
          added += result.added;
          duplicates += result.duplicates;
        }
      }
      if (errors.length && added === 0) {
        setMessage({ tone: "error", text: errors[0]! });
      } else {
        const parts = [added === 0 ? "Nenhum rosto novo encontrado" : `${plural(added, "rosto novo adicionado", "rostos novos adicionados")} abaixo`];
        if (duplicates) parts.push(`${plural(duplicates, "aluno já estava", "alunos já estavam")} na chamada`);
        if (errors.length) parts.push(`${plural(errors.length, "foto não pôde", "fotos não puderam")} ser analisada${errors.length > 1 ? "s" : ""}`);
        setMessage({ tone: "success", text: `${parts.join(" · ")}.` });
      }
      router.refresh();
    });
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          {pending ? "Analisando a nova foto..." : "Alguém ficou de fora da foto?"}
        </p>
        <label className={`${buttonClass("secondary", "sm")} lg:hidden ${pending ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
          {pending ? <Spinner className="h-4 w-4" /> : <Icon name="camera" className="h-4 w-4" />}
          Tirar outra foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={pending}
            aria-label="Tirar outra foto"
            onChange={(e) => {
              send(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className={`${buttonClass("secondary", "sm")} ${pending ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
          {pending ? <Spinner className="h-4 w-4" /> : <Icon name="plus" className="h-4 w-4" />}
          Adicionar foto
          <input
            type="file"
            name="extra-photo"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={pending}
            aria-label="Adicionar outra foto à chamada"
            onChange={(e) => {
              send(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {message && (
        <Alert tone={message.tone} title={message.tone === "error" ? "Não foi possível usar a foto" : undefined}>
          {message.text}
        </Alert>
      )}
    </div>
  );
}
