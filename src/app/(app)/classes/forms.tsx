"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addStudentsToClassroom, createClassroom, createStudentsInClassroom, updateClassroom } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, Field, SuccessMessage, checkboxStyles, inputStyles } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { FormState } from "@/lib/form";

// Limpa o formulário após uma submissão bem-sucedida.
function useResetOnSuccess(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);
  return ref;
}

export type TeacherOption = { id: string; name: string };

// Somente para a coordenação: escolhe quem é o professor responsável pela turma.
function TeacherSelect({ teachers, defaultValue }: { teachers: TeacherOption[]; defaultValue?: string | null }) {
  return (
    <Field label="Professor responsável" hint="Só o professor responsável (e a coordenação) vê esta turma.">
      <select name="teacherId" defaultValue={defaultValue ?? ""} className={inputStyles}>
        <option value="">Sem professor (só a coordenação vê)</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CreateClassroomForm({ teachers }: { teachers?: TeacherOption[] }) {
  const [state, formAction] = useActionState(createClassroom, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr]">
        <Field label="Nome da turma" hint="Ex.: Ballet Infantil — Seg/Qua 14h">
          <input name="name" required minLength={2} autoFocus className={inputStyles} />
        </Field>
        <Field label="Descrição (opcional)" hint="Modalidade, horário ou local">
          <input name="description" className={inputStyles} />
        </Field>
      </div>
      {teachers && <TeacherSelect teachers={teachers} />}
      <ErrorMessage message={state?.error} />
      <SubmitButton pendingText="Criando..." icon="plus">
        Criar turma
      </SubmitButton>
    </form>
  );
}

export function EditClassroomForm({
  classroom,
  teachers,
}: {
  classroom: { id: string; name: string; description: string | null; active: boolean; teacherId: string | null };
  teachers?: TeacherOption[];
}) {
  const [state, formAction] = useActionState(updateClassroom, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={classroom.id} />
      <Field label="Nome">
        <input name="name" defaultValue={classroom.name} required minLength={2} className={inputStyles} />
      </Field>
      <Field label="Descrição">
        <input name="description" defaultValue={classroom.description ?? ""} className={inputStyles} />
      </Field>
      {teachers && <TeacherSelect teachers={teachers} defaultValue={classroom.teacherId} />}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
        <input type="checkbox" name="active" defaultChecked={classroom.active} className={`${checkboxStyles} mt-0.5`} />
        <span>
          <span className="block text-sm font-medium text-slate-800">Turma ativa</span>
          <span className="block text-xs text-slate-500">Turmas inativas não aparecem em “Nova chamada”. O histórico é mantido.</span>
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

// Uma única área para incluir alunos, com duas formas de fazer isso.
export function AddStudentsPanel({
  classroomId,
  students,
}: {
  classroomId: string;
  students: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<"new" | "existing">("new");
  const tabs = [
    { key: "new" as const, label: "Novos alunos" },
    { key: "existing" as const, label: `Já cadastrados (${students.length})` },
  ];
  return (
    <div>
      <div role="tablist" aria-label="Como adicionar alunos" className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`h-9 flex-1 rounded-lg px-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "new" ? (
          <CreateStudentsForm classroomId={classroomId} />
        ) : (
          <AddStudentsForm classroomId={classroomId} students={students} />
        )}
      </div>
    </div>
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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Limpa a seleção quando chega um novo resultado de sucesso (ajuste durante o render).
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && !state.error) setSelected(new Set());
  }

  if (students.length === 0) {
    return (
      <div className="space-y-2">
        <SuccessMessage message={state?.success} />
        <p className="text-sm text-slate-500">Todos os alunos ativos já estão nesta turma.</p>
      </div>
    );
  }
  const q = query.trim().toLocaleLowerCase("pt-BR");
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="classroomId" value={classroomId} />
      {students.length > 8 && (
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar aluno"
            aria-label="Buscar aluno"
            className={`${inputStyles} pl-9`}
          />
        </div>
      )}
      <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
        {students.map((s) => (
          // Itens filtrados ficam ocultos (não removidos) para manter a seleção no envio.
          <label
            key={s.id}
            hidden={!!q && !s.name.toLocaleLowerCase("pt-BR").includes(q)}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm hover:bg-slate-50"
          >
            <input
              type="checkbox"
              name="studentIds"
              value={s.id}
              checked={selected.has(s.id)}
              onChange={(e) => toggle(s.id, e.target.checked)}
              className={checkboxStyles}
            />
            {s.name}
          </label>
        ))}
      </div>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton pendingText="Adicionando..." icon="plus">
        {selected.size > 0 ? `Adicionar ${selected.size} selecionado${selected.size === 1 ? "" : "s"}` : "Adicionar selecionados"}
      </SubmitButton>
    </form>
  );
}

export function CreateStudentsForm({ classroomId }: { classroomId: string }) {
  const [state, formAction] = useActionState(createStudentsInClassroom, undefined);
  const ref = useResetOnSuccess(state);
  const [count, setCount] = useState(0);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && !state.error) setCount(0);
  }

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="classroomId" value={classroomId} />
      <Field label="Nomes completos" hint="Um aluno por linha. Você pode colar uma lista inteira de uma planilha.">
        <textarea
          name="names"
          rows={6}
          placeholder={"João Silva\nMaria Souza\nAna Oliveira"}
          required
          onChange={(e) => setCount(e.target.value.split(/\r?\n/).filter((l) => l.trim()).length)}
          className={inputStyles}
        />
      </Field>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton pendingText="Cadastrando..." icon="userPlus">
        {count > 1 ? `Cadastrar ${count} alunos` : "Cadastrar e adicionar à turma"}
      </SubmitButton>
    </form>
  );
}
