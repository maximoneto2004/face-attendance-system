import { createHmac, timingSafeEqual } from "node:crypto";

// Token de sessão assinado (HMAC-SHA256), sem estado no servidor.
// Formato: base64url(JSON payload).base64url(assinatura)
// Usado tanto pelo proxy quanto pelo código de servidor.

export const SESSION_COOKIE = "session";
// Login "para sempre": o cookie dura o máximo aceito pelos navegadores (400 dias)
// e é renovado automaticamente pelo proxy a cada uso. Quem usa o sistema ao menos
// uma vez por ano nunca precisa entrar de novo. Para desconectar um aparelho,
// a coordenação incrementa User.sessionVersion (ex.: ao redefinir a senha).
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;
// Renova o cookie quando ele tiver sido emitido há mais de 1 dia.
const REFRESH_AFTER_SECONDS = 60 * 60 * 24;

// v = versão da sessão do usuário (tokens antigos, sem v, equivalem a 0).
export type SessionPayload = { userId: string; v?: number; exp: number };

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres). Veja .env.example.");
  }
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionToken(userId: string, version = 0): string {
  const payload: SessionPayload = {
    userId,
    v: version,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (typeof payload.userId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.v !== undefined && typeof payload.v !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Token válido, mas emitido há mais de um dia: o proxy emite um novo (sessão deslizante).
export function shouldRefreshSession(payload: SessionPayload): boolean {
  const issuedAt = payload.exp - SESSION_MAX_AGE_SECONDS;
  return Math.floor(Date.now() / 1000) - issuedAt > REFRESH_AFTER_SECONDS;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
