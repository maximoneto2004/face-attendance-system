import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// DADO BIOMÉTRICO: serve o recorte de um rosto detectado apenas para usuários
// autenticados, sem cache. O recorte deixa de existir quando a chamada é confirmada.
export async function GET(_request: Request, { params }: RouteContext<"/api/faces/[id]/image">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const face = await db.detectedFace.findUnique({ where: { id }, select: { cropImage: true } });
  if (!face?.cropImage) return Response.json({ error: "Imagem indisponível." }, { status: 404 });

  return new Response(new Uint8Array(face.cropImage), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
