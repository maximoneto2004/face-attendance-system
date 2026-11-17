"use client";

import { useActionState, useEffect, useRef } from "react";
import { createStudent } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, SuccessMessage, inputStyles } from "@/components/ui";

// classroomRequired: professores sempre cadastram o aluno em uma das suas turmas.
export function CreateStudentForm({
  classrooms,
  classroomRequired,
}: {
  classrooms: { id: string; name: string }[];
  classroomRequired: boolean;
}) {
  const [state, formAction] = useActionState(createStudent, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state && !state.error) {
      formRef.current?.reset();
      inputRef.current?.focus(); // permite cadastrar vários em sequência
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Nome completo do aluno</span>
          <input
            ref={inputRef}
            name="name"
            placeholder="Nome completo do aluno"
            autoComplete="off"
            required
            minLength={2}
            className={inputStyles}
          />
        </label>
        {(classrooms.length > 0 || !classroomRequired) && (
          <label className="sm:w-56">
            <span className="sr-only">Turma do aluno</span>
            <select
              name="classroomId"
              aria-label="Turma do aluno"
              defaultValue={classroomRequired ? classrooms[0]?.id : ""}
              required={classroomRequired}
              className={inputStyles}
            >
              {!classroomRequired && <option value="">Sem turma</option>}
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <SubmitButton pendingText="Adicionando..." icon="plus">
          Adicionar
        </SubmitButton>
      </div>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
    </form>
  );
}
