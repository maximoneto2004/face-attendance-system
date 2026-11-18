"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Registra telas abertas e cliques em botões/links para a tela "Uso do sistema".
// PRIVACIDADE: links para alunos/turmas/chamadas viram a rota (com ":id"), nunca o
// texto; botões que exibem nomes de alunos usam data-track com um rótulo genérico.

type ClientEvent = { type: "page" | "click" | "error"; name: string; path?: string; tab?: string; at: number; message?: string };

const ENDPOINT = "/api/events";
const FLUSH_MS = 5000;
const queue: ClientEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function tabId() {
  try {
    let id = sessionStorage.getItem("usage-tab");
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem("usage-tab", id);
    }
    return id;
  } catch {
    return undefined;
  }
}

function flush(useBeacon = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const batch = queue.splice(0, 50);
  const body = JSON.stringify(batch);
  try {
    if (useBeacon && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) {
      if (queue.length) flush(useBeacon);
      return;
    }
    fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } })
      .then((res) => {
        if (!res.ok && res.status !== 400 && res.status !== 401) retry(batch);
      })
      .catch(() => retry(batch));
  } catch {
    // registrar uso nunca pode atrapalhar o professor
  }
  if (queue.length) flush(useBeacon);
}

// Falha de rede/servidor: devolve o lote à fila e tenta de novo mais tarde.
const MAX_QUEUE = 200;
let retryDelay = FLUSH_MS;
function retry(batch: ClientEvent[]) {
  queue.unshift(...batch.slice(0, Math.max(0, MAX_QUEUE - queue.length)));
  retryDelay = Math.min(retryDelay * 2, 60_000);
  if (!timer) timer = setTimeout(() => flush(), retryDelay);
}

function push(event: Omit<ClientEvent, "at" | "tab" | "path"> & { path?: string }) {
  if (queue.length >= MAX_QUEUE) return;
  queue.push({ path: location.pathname, ...event, tab: tabId(), at: Date.now() });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(() => flush(), FLUSH_MS);
}

const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
// Rotas com id (aluno, turma, chamada) — nunca registrar o texto do link.
const hasId = (path: string) => path.split("/").some((seg) => /^c[a-z0-9]{20,}$/.test(seg));

function describe(el: Element): string | null {
  const tracked = el.closest<HTMLElement>("[data-track]");
  if (tracked?.dataset.track) return tracked.dataset.track;

  if (el instanceof HTMLAnchorElement) {
    const url = new URL(el.href, location.href);
    if (url.origin !== location.origin) return `Link externo`;
    const path = url.pathname.replace(/\/c[a-z0-9]{20,}/g, "/:id");
    if (hasId(url.pathname) || url.pathname.startsWith("/api/")) return `Abrir ${path}`;
    return clean(el.innerText) || clean(el.getAttribute("aria-label")) || `Abrir ${path}`;
  }
  return clean((el as HTMLElement).innerText) || clean(el.getAttribute("aria-label")) || null;
}

export function UsageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    push({ type: "page", name: pathname.replace(/\/c[a-z0-9]{20,}/g, "/:id"), path: pathname });
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target instanceof Element ? e.target : null;
      const el = target?.closest(
        "button, a[href], summary, [role=button], [data-track], label:has(input[type=file])",
      );
      if (!el) return;
      const name = describe(el);
      if (name) push({ type: "click", name });
    }
    function onError(e: ErrorEvent) {
      push({ type: "error", name: "Erro no navegador", message: clean(e.message) });
    }
    function onHide(e: Event) {
      if (e.type === "pagehide" || document.visibilityState === "hidden") flush(true);
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("error", onError);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return null;
}
