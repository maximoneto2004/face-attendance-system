"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { Icon } from "@/components/icons";

// Compartilha a lista de presença como texto (ex.: grupo de WhatsApp da coordenação).
// No celular usa o menu nativo de compartilhar; no computador copia o texto.
export function ShareAttendance({
  classroomName,
  dateLabel,
  present,
  absent,
}: {
  classroomName: string;
  dateLabel: string;
  present: string[];
  absent: string[];
}) {
  const [copied, setCopied] = useState(false);

  const text = [
    `Chamada — ${classroomName}`,
    dateLabel,
    "",
    `✅ Presentes (${present.length}):`,
    ...(present.length ? present.map((n) => `• ${n}`) : ["—"]),
    "",
    `❌ Ausentes (${absent.length}):`,
    ...(absent.length ? absent.map((n) => `• ${n}`) : ["—"]),
  ].join("\n");

  async function share() {
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: `Chamada — ${classroomName}`, text });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return; // usuário fechou o menu
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie a lista abaixo:", text);
    }
  }

  return (
    <button type="button" onClick={share} className={buttonClass("secondary")} aria-live="polite">
      <Icon name={copied ? "check" : "share"} className="h-4 w-4" />
      {copied ? "Lista copiada" : "Compartilhar lista"}
    </button>
  );
}
