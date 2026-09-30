// Teste rápido da integração com o AWS Rekognition, sem banco e sem interface.
//
//   npm run face:test -- <foto-A> <foto-B>
//
// 1. Cadastra (indexa) o maior rosto da foto A na Collection.
// 2. Detecta todos os rostos da foto B, recorta cada um e busca na Collection.
// 3. Mostra quais rostos da foto B correspondem à pessoa da foto A.
// 4. Remove da Collection o rosto cadastrado no passo 1.
//
// A foto B pode ser uma foto de grupo contendo a pessoa da foto A.

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { cropFace, normalizePhoto } from "@/lib/face-images";
import { deleteFaces, detectFaces, ensureCollection, indexFace, searchFace } from "@/lib/rekognition";
import { faceConfig } from "@/lib/config";

async function main() {
  const [pathA, pathB] = process.argv.slice(2);
  if (!pathA || !pathB) {
    console.error("Uso: npm run face:test -- <foto-A> <foto-B>");
    process.exit(1);
  }

  console.log(`Collection: ${process.env.AWS_REKOGNITION_COLLECTION_ID} (${process.env.AWS_REGION})`);
  await ensureCollection();

  const photoA = await normalizePhoto(await readFile(pathA));
  const indexed = await indexFace(photoA.buffer, "smoke-test");
  if (!indexed) throw new Error("Nenhum rosto com qualidade suficiente na foto A.");
  console.log(`Foto A: rosto cadastrado (confiança de detecção ${indexed.confidence.toFixed(1)}%)`);

  try {
    const photoB = await normalizePhoto(await readFile(pathB));
    const faces = (await detectFaces(photoB.buffer)).filter(
      (f) => f.confidence >= faceConfig.minDetectionConfidence,
    );
    console.log(`Foto B: ${faces.length} rosto(s) detectado(s)`);

    let found = false;
    for (const [i, face] of faces.entries()) {
      const matches = await searchFace(await cropFace(photoB, face.boundingBox));
      const match = matches?.find((m) => m.faceId === indexed.faceId);
      if (match) found = true;
      const label = matches === null ? "recorte sem rosto utilizável" : match
        ? `CORRESPONDE à foto A — similaridade ${match.similarity.toFixed(1)}%`
        : "sem correspondência";
      console.log(`  rosto ${i + 1}: ${label}`);
    }
    console.log(found ? "\nOK: a pessoa da foto A foi reconhecida na foto B." : "\nA pessoa da foto A NÃO foi reconhecida na foto B.");
  } finally {
    await deleteFaces([indexed.faceId]);
    console.log("Rosto de teste removido da Collection.");
  }
}

main().catch((error: unknown) => {
  console.error(`Erro: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
