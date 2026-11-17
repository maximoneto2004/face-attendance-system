"use client";

import Link from "next/link";
import { useEffect } from "react";
import { EmptyState, buttonClass } from "@/components/ui";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon="alert"
      title="Algo deu errado ao carregar esta página"
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => retry()} className={buttonClass("primary")}>
            Tentar novamente
          </button>
          <Link href="/" className={buttonClass("secondary")}>
            Ir para o início
          </Link>
        </div>
      }
    >
      Verifique sua conexão com a internet e tente de novo. Se o problema continuar, avise o administrador do sistema.
    </EmptyState>
  );
}
