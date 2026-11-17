import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  shouldRefreshSession,
  verifySessionToken,
} from "@/lib/auth/session-token";

// Redireciona visitantes sem sessão válida para /login.
// Checagem otimista: páginas, actions e rotas também chamam requireUser().
export function proxy(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    const response = NextResponse.next();
    // Sessão deslizante: renova o cookie para o professor nunca precisar entrar de novo.
    if (shouldRefreshSession(session)) {
      response.cookies.set(SESSION_COOKIE, createSessionToken(session.userId, session.v ?? 0), sessionCookieOptions());
    }
    return response;
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Arquivos públicos do app instalável (manifesto e ícones) não exigem login.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|icon.png|apple-icon.png).*)"],
};
