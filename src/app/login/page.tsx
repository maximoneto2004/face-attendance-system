"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, inputStyles } from "@/components/ui";

export default function LoginPage() {
  const [state, formAction] = useActionState(login, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Chamada Facial</h1>
          <p className="text-sm text-slate-500">Entre com sua conta de professor.</p>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">E-mail</span>
          <input name="email" type="email" autoComplete="email" required className={inputStyles} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Senha</span>
          <input name="password" type="password" autoComplete="current-password" required className={inputStyles} />
        </label>
        <ErrorMessage message={state?.error} />
        <div className="[&>button]:w-full">
          <SubmitButton pendingText="Entrando...">Entrar</SubmitButton>
        </div>
      </form>
    </main>
  );
}
