// Camada única de acesso ao AWS Rekognition. Nenhum outro módulo deve importar
// o SDK da AWS diretamente.
//
// DADOS BIOMÉTRICOS: as imagens enviadas aqui são rostos de alunos (possivelmente
// menores). Não logue imagens, respostas completas nem IDs de rosto.

import {
  CreateCollectionCommand,
  DeleteFacesCommand,
  DescribeCollectionCommand,
  DetectFacesCommand,
  IndexFacesCommand,
  RekognitionClient,
  RekognitionServiceException,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";
import { faceConfig } from "@/lib/config";

export type BoundingBox = { left: number; top: number; width: number; height: number };

export type DetectedFaceBox = { boundingBox: BoundingBox; confidence: number };

export type FaceMatch = { faceId: string; similarity: number };

export class FaceServiceError extends Error {}

let client: RekognitionClient | undefined;

function getClient(): RekognitionClient {
  if (!client) {
    const region = process.env.AWS_REGION;
    if (!region) throw new FaceServiceError("AWS_REGION não configurada. Veja .env.example.");
    // Credenciais: cadeia padrão do SDK (variáveis AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY,
    // perfil ~/.aws, ou IAM Role em produção).
    client = new RekognitionClient({ region, maxAttempts: 5, retryMode: "adaptive" });
  }
  return client;
}

function getCollectionId(): string {
  const id = process.env.AWS_REKOGNITION_COLLECTION_ID;
  if (!id) {
    throw new FaceServiceError("AWS_REKOGNITION_COLLECTION_ID não configurada. Veja .env.example.");
  }
  return id;
}

// Converte erros do SDK em mensagens compreensíveis, sem vazar detalhes sensíveis.
function toFaceServiceError(error: unknown): FaceServiceError {
  if (error instanceof FaceServiceError) return error;
  const name = error instanceof Error ? error.name : "";
  const messages: Record<string, string> = {
    CredentialsProviderError:
      "Credenciais AWS não encontradas. Configure AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no .env.",
    UnrecognizedClientException: "Credenciais AWS inválidas (Access Key não reconhecida).",
    InvalidSignatureException: "Credenciais AWS inválidas (Secret Key incorreta).",
    AccessDeniedException: "O usuário AWS não tem permissão para usar o Rekognition. Veja a policy no README.",
    ThrottlingException: "Limite de requisições do Rekognition atingido. Tente novamente em instantes.",
    ProvisionedThroughputExceededException:
      "Limite de requisições do Rekognition atingido. Tente novamente em instantes.",
    ImageTooLargeException: "Imagem grande demais para o Rekognition.",
    InvalidImageFormatException: "Formato de imagem não suportado. Envie JPEG ou PNG.",
  };
  const message = messages[name] ?? "Falha ao comunicar com o serviço de reconhecimento facial.";
  // Loga apenas o tipo do erro, nunca a imagem ou a resposta.
  console.error(`[rekognition] ${name || "UnknownError"}`);
  return new FaceServiceError(message);
}

async function send<T>(fn: (client: RekognitionClient) => Promise<T>): Promise<T> {
  try {
    return await fn(getClient());
  } catch (error) {
    throw toFaceServiceError(error);
  }
}

function toBoundingBox(box: { Left?: number; Top?: number; Width?: number; Height?: number }): BoundingBox {
  return { left: box.Left ?? 0, top: box.Top ?? 0, width: box.Width ?? 0, height: box.Height ?? 0 };
}

let collectionReady: Promise<void> | undefined;

// Garante que a Collection exista (cria na primeira utilização). Cacheado por processo.
export function ensureCollection(): Promise<void> {
  collectionReady ??= (async () => {
    const CollectionId = getCollectionId();
    try {
      await getClient().send(new DescribeCollectionCommand({ CollectionId }));
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) throw error;
      try {
        await getClient().send(new CreateCollectionCommand({ CollectionId }));
      } catch (createError) {
        if (!(createError instanceof ResourceAlreadyExistsException)) throw createError;
      }
    }
  })().catch((error) => {
    collectionReady = undefined;
    throw toFaceServiceError(error);
  });
  return collectionReady;
}

// Detecta todos os rostos de uma foto (até 100). Uma única chamada à AWS.
export async function detectFaces(image: Uint8Array): Promise<DetectedFaceBox[]> {
  const result = await send((c) => c.send(new DetectFacesCommand({ Image: { Bytes: image } })));
  return (result.FaceDetails ?? [])
    .filter((face) => face.BoundingBox)
    .map((face) => ({ boundingBox: toBoundingBox(face.BoundingBox!), confidence: face.Confidence ?? 0 }));
}

// Procura na Collection o maior rosto da imagem (use com o recorte de UM rosto).
// Retorna null se o Rekognition não encontrar rosto no recorte.
export async function searchFace(faceImage: Uint8Array): Promise<FaceMatch[] | null> {
  await ensureCollection();
  try {
    const result = await getClient().send(
      new SearchFacesByImageCommand({
        CollectionId: getCollectionId(),
        Image: { Bytes: faceImage },
        MaxFaces: 10,
        FaceMatchThreshold: faceConfig.reviewThreshold,
        QualityFilter: "NONE",
      }),
    );
    return (result.FaceMatches ?? [])
      .filter((m) => m.Face?.FaceId)
      .map((m) => ({ faceId: m.Face!.FaceId!, similarity: m.Similarity ?? 0 }));
  } catch (error) {
    // "There are no faces in the image" — recorte sem rosto utilizável.
    if (error instanceof RekognitionServiceException && error.name === "InvalidParameterException") {
      return null;
    }
    throw toFaceServiceError(error);
  }
}

// Indexa (cadastra) o rosto de UM aluno na Collection. Só deve ser chamado após
// confirmação manual. Retorna null se o rosto não tiver qualidade suficiente.
export async function indexFace(
  faceImage: Uint8Array,
  studentId: string,
): Promise<{ faceId: string; confidence: number } | null> {
  await ensureCollection();
  const result = await send((c) =>
    c.send(
      new IndexFacesCommand({
        CollectionId: getCollectionId(),
        Image: { Bytes: faceImage },
        ExternalImageId: studentId,
        MaxFaces: 1,
        QualityFilter: "AUTO",
        DetectionAttributes: ["DEFAULT"],
      }),
    ),
  );
  const face = result.FaceRecords?.[0]?.Face;
  if (!face?.FaceId) return null;
  return { faceId: face.FaceId, confidence: face.Confidence ?? 0 };
}

// Remove rostos da Collection (exclusão de identidade facial).
export async function deleteFaces(faceIds: string[]): Promise<void> {
  if (faceIds.length === 0) return;
  const CollectionId = getCollectionId();
  for (let i = 0; i < faceIds.length; i += 1000) {
    const FaceIds = faceIds.slice(i, i + 1000);
    await send((c) => c.send(new DeleteFacesCommand({ CollectionId, FaceIds })));
  }
}
