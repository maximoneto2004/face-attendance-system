"use client";

import { useActionState, useEffect, useRef } from "react";
import { createStudent } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, inputStyles } from "@/components/ui";

export function CreateStudentForm() {
  const [state, formAction] = useActionState(createStudent, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <input name="name" placeholder="Nome do aluno" required className={inputStyles} />
        <SubmitButton pendingText="Adicionando...">Adicionar</SubmitButton>
      </div>
      <ErrorMessage message={state?.error} />
    </form>
  );
}
