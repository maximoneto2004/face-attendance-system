"use client";

import { useActionState } from "react";
import { removeFaceIdentity, updateStudent } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, inputStyles } from "@/components/ui";

export function EditStudentForm({ student }: { student: { id: string; name: string; active: boolean } }) {
  const [state, formAction] = useActionState(updateStudent, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={student.id} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Nome</span>
        <input name="name" defaultValue={student.name} required className={inputStyles} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={student.active} className="h-4 w-4" />
        Aluno ativo (inativos não aparecem nas chamadas)
      </label>
      <ErrorMessage message={state?.error} />
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}

export function RemoveFaceIdentityForm({ studentId }: { studentId: string }) {
  const [state, formAction] = useActionState(removeFaceIdentity, undefined);
  return (
    <form action={formAction} className="mt-4 space-y-2">
      <input type="hidden" name="id" value={studentId} />
      <ErrorMessage message={state?.error} />
      <SubmitButton
        variant="danger"
        pendingText="Excluindo..."
        confirmMessage="Excluir todos os dados faciais deste aluno? Ele deixará de ser reconhecido automaticamente."
      >
        Excluir identidade facial
      </SubmitButton>
    </form>
  );
}
