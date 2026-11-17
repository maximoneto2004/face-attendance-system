"use client";

import { useActionState } from "react";
import { removeFaceIdentity, updateStudent } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, Field, SuccessMessage, checkboxStyles, inputStyles } from "@/components/ui";

export function EditStudentForm({ student }: { student: { id: string; name: string; active: boolean } }) {
  const [state, formAction] = useActionState(updateStudent, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={student.id} />
      <Field label="Nome">
        <input name="name" defaultValue={student.name} required minLength={2} className={inputStyles} />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
        <input type="checkbox" name="active" defaultChecked={student.active} className={`${checkboxStyles} mt-0.5`} />
        <span>
          <span className="block text-sm font-medium text-slate-800">Aluno ativo</span>
          <span className="block text-xs text-slate-500">Alunos inativos não aparecem nas chamadas. O histórico é mantido.</span>
        </span>
      </label>
      <ErrorMessage message={state?.error} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Salvar alterações</SubmitButton>
        <SuccessMessage message={state?.success} />
      </div>
    </form>
  );
}

export function RemoveFaceIdentityForm({ studentId }: { studentId: string }) {
  const [state, formAction] = useActionState(removeFaceIdentity, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={studentId} />
      <ErrorMessage message={state?.error} />
      <SubmitButton
        variant="danger"
        icon="trash"
        pendingText="Excluindo..."
        confirmMessage="Excluir todos os dados faciais deste aluno? Ele deixará de ser reconhecido automaticamente até ser identificado de novo em uma chamada."
      >
        Excluir identidade facial
      </SubmitButton>
      <SuccessMessage message={state?.success} />
    </form>
  );
}
