"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Badge, Card, EmptyState, formatRate, inputStyles } from "@/components/ui";
import { Icon } from "@/components/icons";

export type DirectoryStudent = {
  id: string;
  name: string;
  active: boolean;
  faceCount: number;
  classrooms: string[];
  present: number;
  total: number;
};

const filters = [
  { key: "all", label: "Todos" },
  { key: "noFace", label: "Sem rosto" },
  { key: "inactive", label: "Inativos" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

// Remove acentos para que "joao" encontre "João".
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function StudentsDirectory({ students }: { students: DirectoryStudent[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts: Record<FilterKey, number> = {
    all: students.length,
    noFace: students.filter((s) => s.active && s.faceCount === 0).length,
    inactive: students.filter((s) => !s.active).length,
  };

  const q = normalize(query.trim());
  const visible = students.filter((s) => {
    if (filter === "noFace" && (!s.active || s.faceCount > 0)) return false;
    if (filter === "inactive" && s.active) return false;
    if (q && !normalize(s.name).includes(q) && !s.classrooms.some((c) => normalize(c).includes(q))) return false;
    return true;
  });

  if (students.length === 0) {
    return (
      <EmptyState icon="users" title="Nenhum aluno cadastrado ainda">
        Adicione alunos acima ou, para cadastrar vários de uma vez, abra uma turma e cole a lista de nomes.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou turma"
            aria-label="Buscar aluno"
            className={`${inputStyles} pl-9`}
          />
        </div>
        <div role="group" aria-label="Filtrar alunos" className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors sm:flex-none ${
                filter === f.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {f.label}
              <span className="ml-1.5 text-xs text-slate-400 tabular-nums">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="search" title="Nenhum aluno encontrado">
          Tente outro nome ou limpe os filtros.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-slate-100">
            {visible.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/students/${s.id}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5 ${s.active ? "" : "opacity-70"}`}
                >
                  <Avatar name={s.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{s.name}</p>
                    <p className="truncate text-sm text-slate-500">{s.classrooms.join(", ") || "Sem turma"}</p>
                  </div>
                  <div className="hidden w-24 text-right sm:block">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">{formatRate(s.present, s.total)}</p>
                    <p className="text-xs text-slate-500">presença</p>
                  </div>
                  <div className="flex w-28 shrink-0 flex-col items-end gap-1">
                    {!s.active ? (
                      <Badge>Inativo</Badge>
                    ) : s.faceCount > 0 ? (
                      <Badge tone="green" icon="scan">
                        Rosto ok
                      </Badge>
                    ) : (
                      <Badge tone="amber">Sem rosto</Badge>
                    )}
                  </div>
                  <Icon name="chevronRight" className="hidden h-5 w-5 text-slate-300 sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-slate-500">
        “Sem rosto” significa que o aluno ainda não foi identificado em nenhuma chamada. Basta identificá-lo na revisão
        da próxima chamada para que passe a ser reconhecido automaticamente.
      </p>
    </div>
  );
}
