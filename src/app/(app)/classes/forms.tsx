"use client";

import { useActionState, useEffect, useRef } from "react";
import { addStudentsToClassroom, createClassroom, createStudentsInClassroom, updateClassroom } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, inputStyles } from "@/components/ui";
import type { FormState } from "@/lib/form";

// Limpa o formulário após uma submissão bem-sucedida.
function useResetOnSuccess(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);
  return ref;
}

export function CreateClassroomForm() {
  const [state, formAction] = useActionState(createClassroom, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input name="name" placeholder="Nome da turma" required className={inputStyles} />
        <input name="description" placeholder="Descrição (opcional)" className={inputStyles} />
        <SubmitButton pendingText="Criando...">Criar turma</SubmitButton>
      </div>
      <ErrorMessage message={state?.error} />
    </form>
  );
}

export function EditClassroomForm({
  classroom,
}: {
  classroom: { id: string; name: string; description: string | null; active: boolean };
}) {
  const [state, formAction] = useActionState(updateClassroom, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={classroom.id} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Nome</span>
        <input name="name" defaultValue={classroom.name} required className={inputStyles} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Descrição</span>
        <input name="description" defaultValue={classroom.description ?? ""} className={inputStyles} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={classroom.active} className="h-4 w-4" />
        Turma ativa
      </label>
      <ErrorMessage message={state?.error} />
      {state && !state.error && <p className="text-sm text-emerald-700">Salvo.</p>}
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}

export function AddStudentsForm({
  classroomId,
  students,
}: {
  classroomId: string;
  students: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(addStudentsToClassroom, undefined);
  const ref = useResetOnSuccess(state);
  if (students.length === 0) {
    return <p className="text-sm text-slate-500">Todos os alunos ativos já estão nesta turma.</p>;
  }
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="classroomId" value={classroomId} />
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {students.map((s) => (
          <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
            <input type="checkbox" name="studentIds" value={s.id} className="h-4 w-4" />
            {s.name}
          </label>
        ))}
      </div>
      <ErrorMessage message={state?.error} />
      <SubmitButton pendingText="Adicionando...">Adicionar selecionados</SubmitButton>
    </form>
  );
}

export function CreateStudentsForm({ classroomId }: { classroomId: string }) {
  const [state, formAction] = useActionState(createStudentsInClassroom, undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="classroomId" value={classroomId} />
      <textarea
        name="names"
        rows={6}
        placeholder={"Um nome por linha\nJoão Silva\nMaria Souza"}
        required
        className={inputStyles}
      />
      <ErrorMessage message={state?.error} />
      <SubmitButton pendingText="Cadastrando...">Cadastrar e adicionar à turma</SubmitButton>
    </form>
  );
}
