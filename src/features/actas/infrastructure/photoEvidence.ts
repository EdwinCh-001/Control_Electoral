import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import jpeg from "jpeg-js";

export interface PhotoAssessment {
  sharpnessScore: number;
  configuredThreshold: number | null;
  accepted: boolean;
  photoUri: string | null;
  cleanupWarning: string | null;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function calculateLaplacianVariance(
  jpegData: Uint8Array,
): number {
  const image = jpeg.decode(jpegData, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: 1,
  });
  if (image.width < 3 || image.height < 3) {
    throw new Error("La fotografía no tiene resolución suficiente para analizarse.");
  }

  let sum = 0;
  let squaredSum = 0;
  let sampleCount = 0;
  const luminanceAt = (x: number, y: number) => {
    const offset = (y * image.width + x) * 4;
    return (
      image.data[offset] * 0.299 +
      image.data[offset + 1] * 0.587 +
      image.data[offset + 2] * 0.114
    );
  };

  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      const laplacian =
        luminanceAt(x - 1, y) +
        luminanceAt(x + 1, y) +
        luminanceAt(x, y - 1) +
        luminanceAt(x, y + 1) -
        4 * luminanceAt(x, y);
      sum += laplacian;
      squaredSum += laplacian * laplacian;
      sampleCount += 1;
    }
  }

  const mean = sum / sampleCount;
  return squaredSum / sampleCount - mean * mean;
}

function getConfiguredThreshold(): number | null {
  const rawThreshold =
    process.env.EXPO_PUBLIC_IMAGE_SHARPNESS_THRESHOLD?.trim() ?? "";
  if (!rawThreshold) {
    return null;
  }
  const threshold = Number(rawThreshold);
  return Number.isFinite(threshold) && threshold > 0 ? threshold : null;
}

export async function assessAndStoreCameraPhoto(
  sourceUri: string,
  actaId: string,
  previousUri: string | null,
): Promise<PhotoAssessment> {
  const analysisImage = await manipulateAsync(
    sourceUri,
    [{ resize: { width: 512 } }],
    { base64: true, compress: 1, format: SaveFormat.JPEG },
  );
  if (!analysisImage.base64) {
    throw new Error("No se pudo analizar la nitidez de la fotografía.");
  }

  const sharpnessScore = calculateLaplacianVariance(
    decodeBase64(analysisImage.base64),
  );
  const configuredThreshold = getConfiguredThreshold();
  if (configuredThreshold === null) {
    return {
      sharpnessScore,
      configuredThreshold: null,
      accepted: false,
      photoUri: null,
      cleanupWarning: null,
    };
  }
  if (sharpnessScore < configuredThreshold) {
    return {
      sharpnessScore,
      configuredThreshold,
      accepted: false,
      photoUri: null,
      cleanupWarning: null,
    };
  }

  const storedImage = await manipulateAsync(
    sourceUri,
    [{ resize: { width: 1600 } }],
    { compress: 0.82, format: SaveFormat.JPEG },
  );
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    throw new Error("No está disponible el almacenamiento local para la fotografía.");
  }

  const evidenceDirectory = `${documentDirectory}acta-evidence/${actaId}/`;
  const directoryInfo = await FileSystem.getInfoAsync(evidenceDirectory);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(evidenceDirectory, {
      intermediates: true,
    });
  }
  const photoUri = `${evidenceDirectory}${Crypto.randomUUID()}.jpg`;
  await FileSystem.copyAsync({ from: storedImage.uri, to: photoUri });

  let cleanupWarning: string | null = null;
  if (previousUri && previousUri !== photoUri) {
    try {
      await FileSystem.deleteAsync(previousUri, { idempotent: true });
    } catch {
      cleanupWarning = "No se pudo retirar una copia anterior de la fotografía.";
    }
  }

  return {
    sharpnessScore,
    configuredThreshold,
    accepted: true,
    photoUri,
    cleanupWarning,
  };
}
