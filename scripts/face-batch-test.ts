import "dotenv/config";

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cropFace, normalizePhoto } from "@/lib/face-images";
import { detectFaces, ensureCollection } from "@/lib/rekognition";
import { faceConfig } from "@/lib/config";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function main() {
  const args = process.argv.slice(2);
  const writeCrops = args.includes("--crops");
  const inputArg = args.find((arg) => !arg.startsWith("--")) ?? "fotos";
  const inputDir = path.resolve(inputArg);
  const cropRoot = path.resolve("tmp", "face-crops");

  const files = (await readdir(inputDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  if (files.length === 0) throw new Error(`Nenhuma imagem encontrada em ${inputArg}.`);

  await ensureCollection();
  if (writeCrops) await mkdir(cropRoot, { recursive: true });

  console.log(`[face:batch] collection ready region=${process.env.AWS_REGION}`);
  console.log(`[face:batch] images=${files.length} crops=${writeCrops ? "enabled" : "disabled"}`);

  let totalFaces = 0;
  for (const [fileIndex, fileName] of files.entries()) {
    const absolutePath = path.join(inputDir, fileName);
    const photo = await normalizePhoto(await readFile(absolutePath));
    const faces = (await detectFaces(photo.buffer))
      .filter((face) => face.confidence >= faceConfig.minDetectionConfidence)
      .sort((a, b) => a.boundingBox.left - b.boundingBox.left);
    totalFaces += faces.length;

    console.log(`\n[face:batch] ${fileIndex + 1}/${files.length} file=${fileName}`);
    console.log(`[face:batch] faces=${faces.length} image=${photo.width}x${photo.height}`);

    const cropDir = path.join(cropRoot, path.parse(fileName).name);
    if (writeCrops) await mkdir(cropDir, { recursive: true });

    for (const [faceIndex, face] of faces.entries()) {
      const box = face.boundingBox;
      const widthPx = Math.round(box.width * photo.width);
      const heightPx = Math.round(box.height * photo.height);
      console.log(
        `[face:batch] face=${String(faceIndex + 1).padStart(3, "0")} ` +
          `confidence=${face.confidence.toFixed(1)}% size=${widthPx}x${heightPx}px ` +
          `box=${JSON.stringify(box)}`,
      );
      if (writeCrops) {
        const crop = await cropFace(photo, box);
        await writeFile(path.join(cropDir, `face-${String(faceIndex + 1).padStart(3, "0")}.jpg`), crop);
      }
    }
  }

  console.log(`\n[face:batch] complete images=${files.length} totalFaces=${totalFaces}`);
  if (writeCrops) console.log(`[face:batch] crops=${cropRoot}`);
}

main().catch((error: unknown) => {
  console.error(`[face:batch] error=${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
