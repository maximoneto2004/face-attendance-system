// Manipulação de imagens da foto coletiva (normalização e recorte de rostos).
// As imagens ficam apenas em memória; nada é gravado em disco.

import sharp from "sharp";
import { faceConfig } from "@/lib/config";
import type { BoundingBox } from "@/lib/rekognition";

// Limite de bytes aceito pelo Rekognition para imagens enviadas diretamente.
const REKOGNITION_MAX_BYTES = 5 * 1024 * 1024;

export type NormalizedPhoto = { buffer: Buffer; width: number; height: number };

// Corrige a orientação (EXIF), reduz para no máximo maxPhotoSize e converte para JPEG.
// sharp descarta metadados (incl. GPS) por padrão.
export async function normalizePhoto(input: Buffer): Promise<NormalizedPhoto> {
  let quality = 90;
  for (;;) {
    const { data, info } = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({
        width: faceConfig.maxPhotoSize,
        height: faceConfig.maxPhotoSize,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toBuffer({ resolveWithObject: true });
    if (data.length <= REKOGNITION_MAX_BYTES || quality <= 60) {
      return { buffer: data, width: info.width, height: info.height };
    }
    quality -= 10;
  }
}

// Recorta um rosto com margem, ampliando rostos pequenos para melhorar a busca.
export async function cropFace(photo: NormalizedPhoto, box: BoundingBox): Promise<Buffer> {
  const padX = box.width * faceConfig.cropPadding;
  const padY = box.height * faceConfig.cropPadding;
  const left = Math.max(0, Math.floor((box.left - padX) * photo.width));
  const top = Math.max(0, Math.floor((box.top - padY) * photo.height));
  const right = Math.min(photo.width, Math.ceil((box.left + box.width + padX) * photo.width));
  const bottom = Math.min(photo.height, Math.ceil((box.top + box.height + padY) * photo.height));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  let pipeline = sharp(photo.buffer).extract({ left, top, width, height });
  if (Math.min(width, height) < faceConfig.minCropSize) {
    const scale = faceConfig.minCropSize / Math.min(width, height);
    pipeline = pipeline.resize(Math.round(width * scale), Math.round(height * scale));
  }
  return pipeline.jpeg({ quality: 90 }).toBuffer();
}
