// Configuração central do reconhecimento facial. Os limiares podem ser
// ajustados por variável de ambiente sem alterar código.

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} deve ser um número entre 0 e 100 (recebido: "${raw}").`);
  }
  return value;
}

export const faceConfig = {
  // Similaridade (%) a partir da qual o aluno é marcado automaticamente.
  autoAcceptThreshold: numberFromEnv("FACE_AUTO_ACCEPT_THRESHOLD", 95),
  // Similaridade (%) mínima para sugerir um aluno ao professor. Abaixo disso: desconhecido.
  reviewThreshold: numberFromEnv("FACE_REVIEW_THRESHOLD", 85),
  // Confiança mínima (%) de que a região detectada é realmente um rosto.
  minDetectionConfidence: 90,
  // Margem adicionada em volta da bounding box ao recortar (fração do tamanho do rosto).
  cropPadding: 0.4,
  // Lado mínimo (px) do recorte enviado ao Rekognition; rostos pequenos são ampliados.
  minCropSize: 200,
  // Maior lado (px) da foto coletiva após normalização.
  maxPhotoSize: 3000,
  // Limite de rostos indexados por aluno (evita crescimento sem controle da Collection).
  maxFacesPerStudent: 10,
} as const;

if (faceConfig.reviewThreshold > faceConfig.autoAcceptThreshold) {
  throw new Error("FACE_REVIEW_THRESHOLD não pode ser maior que FACE_AUTO_ACCEPT_THRESHOLD.");
}
