"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, Field, inputStyles } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/app-nav";

const highlights = [
  { icon: "camera" as const, text: "Uma foto da turma registra a presença de todos" },
  { icon: "sparkles" as const, text: "O reconhecimento melhora a cada chamada confirmada" },
  { icon: "shield" as const, text: "A foto não é armazenada; recortes são apagados após a confirmação" },
];

export default function LoginPage() {
  const [state, formAction] = useActionState(login, undefined);
  // Controlado para não perder o e-mail digitado quando a senha está errada
  // (o React 19 limpa campos não controlados após a action).
  const [email, setEmail] = useState("");

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand-950 p-12 text-white lg:flex">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Icon name="scan" className="h-5 w-5" />
          </span>
          <span className="font-semibold">Chamada Facial</span>
        </span>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Menos tempo com a lista de chamada, mais tempo com os alunos.
          </h2>
          <ul className="mt-8 space-y-4">
            {highlights.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-brand-100">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <Icon name={h.icon} className="h-5 w-5" />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-brand-200/70">Acesso restrito à equipe do projeto.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-slate-500">Use o e-mail e a senha fornecidos pela coordenação.</p>
          <form action={formAction} className="mt-8 space-y-5">
            <Field label="E-mail">
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                required
                className={inputStyles}
              />
            </Field>
            <Field label="Senha">
              <input name="password" type="password" autoComplete="current-password" required className={inputStyles} />
            </Field>
            <ErrorMessage message={state?.error} />
            <SubmitButton pendingText="Entrando..." size="lg" className="w-full">
              Entrar
            </SubmitButton>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">Esqueceu a senha? Fale com o administrador do sistema.</p>
        </div>
      </section>
    </main>
  );
}
