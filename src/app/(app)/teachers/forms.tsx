"use client";

import { useActionState, useRef } from "react";
import { createTeacher, disconnectTeacher, resetTeacherPassword, updateTeacherRole } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, Field, SuccessMessage, buttonClass, inputStyles } from "@/components/ui";
import { Icon } from "@/components/icons";

// Senha fácil de ditar/digitar no celular (ex.: "lua-verde-4821").
const WORDS = ["sol", "lua", "mar", "rio", "luz", "flor", "bola", "gato", "casa", "vento", "pedra", "nuvem", "verde", "azul", "forte", "leve"];
function easyPassword() {
  const n = new Uint32Array(3);
  crypto.getRandomValues(n);
  return `${WORDS[n[0]! % WORDS.length]}-${WORDS[n[1]! % WORDS.length]}-${1000 + (n[2]! % 9000)}`;
}

function PasswordInput({ id }: { id: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-2">
      <input
        ref={ref}
        id={id}
        name="password"
        type="text"
        autoComplete="new-password"
        required
        minLength={6}
        className={inputStyles}
      />
      <button
        type="button"
        onClick={() => {
          if (ref.current) ref.current.value = easyPassword();
        }}
        className={buttonClass("secondary", "md", "shrink-0")}
      >
        <Icon name="sparkles" className="h-4 w-4" />
        Gerar
      </button>
    </div>
  );
}

type Role = "ADMIN" | "TEACHER" | "TECH";

function RoleOptions({ allowTech }: { allowTech: boolean }) {
  return (
    <>
      <option value="TEACHER">Professor — vê só as próprias turmas</option>
      <option value="ADMIN">Coordenação — vê e gerencia tudo</option>
      {allowTech && <option value="TECH">Administrador tech — tudo + uso do sistema</option>}
    </>
  );
}

export function CreateTeacherForm({ allowTech }: { allowTech: boolean }) {
  const [state, formAction] = useActionState(createTeacher, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" hint="Ex.: Judô — Prof. Carlos">
          <input name="name" required minLength={2} className={inputStyles} />
        </Field>
        <Field label="E-mail (usado para entrar)">
          <input name="email" type="email" inputMode="email" autoCapitalize="none" required className={inputStyles} />
        </Field>
        <div>
          <label htmlFor="new-teacher-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Senha
          </label>
          <PasswordInput id="new-teacher-password" />
          <p className="mt-1.5 text-xs text-slate-500">Use “Gerar” para uma senha fácil de passar ao professor.</p>
        </div>
        <Field label="Perfil">
          <select name="role" defaultValue="TEACHER" className={inputStyles}>
            <RoleOptions allowTech={allowTech} />
          </select>
        </Field>
      </div>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton icon="userPlus" pendingText="Criando...">
        Criar acesso
      </SubmitButton>
    </form>
  );
}

export function ManageTeacherForms({
  user,
  isSelf,
  allowTech,
}: {
  user: { id: string; name: string; role: Role };
  isSelf: boolean;
  allowTech: boolean;
}) {
  const [pwState, pwAction] = useActionState(resetTeacherPassword, undefined);
  const [roleState, roleAction] = useActionState(updateTeacherRole, undefined);
  const [dcState, dcAction] = useActionState(disconnectTeacher, undefined);

  return (
    <div className="grid gap-5 md:grid-cols-3">
      <form action={pwAction} className="space-y-2">
        <input type="hidden" name="userId" value={user.id} />
        <label htmlFor={`pw-${user.id}`} className="block text-sm font-medium text-slate-700">
          Nova senha
        </label>
        <PasswordInput id={`pw-${user.id}`} />
        <ErrorMessage message={pwState?.error} />
        <SuccessMessage message={pwState?.success} />
        <SubmitButton size="sm" variant="secondary" pendingText="Salvando...">
          Redefinir senha
        </SubmitButton>
      </form>

      <form action={roleAction} className="space-y-2">
        <input type="hidden" name="userId" value={user.id} />
        <label htmlFor={`role-${user.id}`} className="block text-sm font-medium text-slate-700">
          Perfil
        </label>
        <select id={`role-${user.id}`} name="role" defaultValue={user.role} disabled={isSelf} className={inputStyles}>
          <RoleOptions allowTech={allowTech || user.role === "TECH"} />
        </select>
        <ErrorMessage message={roleState?.error} />
        <SuccessMessage message={roleState?.success} />
        {!isSelf && (
          <SubmitButton size="sm" variant="secondary" pendingText="Salvando...">
            Salvar perfil
          </SubmitButton>
        )}
      </form>

      {!isSelf && (
        <form action={dcAction} className="space-y-2">
          <input type="hidden" name="userId" value={user.id} />
          <p className="text-sm font-medium text-slate-700">Aparelhos</p>
          <p className="text-xs text-slate-500">
            O acesso fica salvo no aparelho. Use se um celular foi perdido ou trocado.
          </p>
          <ErrorMessage message={dcState?.error} />
          <SuccessMessage message={dcState?.success} />
          <SubmitButton
            size="sm"
            variant="danger"
            icon="logout"
            pendingText="Desconectando..."
            confirmMessage={`Desconectar ${user.name} de todos os aparelhos?`}
          >
            Desconectar aparelhos
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
