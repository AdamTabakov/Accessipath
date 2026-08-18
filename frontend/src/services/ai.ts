import type { AiAnalysisResult, AiDetection } from "../types/index.js";

const MODEL_CANDIDATES = ["Xenova/mobileclip_s0", "Xenova/clip-vit-base-patch32"];

const LABELS = [
  "a staircase with steps",
  "a wheelchair ramp",
  "an elevator",
  "an obstacle blocking the path",
  "an accessible entrance with an automatic door",
  "a flat smooth paved walkway",
];

const FEATURE_MAP: Record<string, string> = {
  "a staircase with steps": "Stairs",
  "a wheelchair ramp": "Ramp",
  "an elevator": "Elevator",
  "an obstacle blocking the path": "Obstacle",
  "an accessible entrance with an automatic door": "Accessible entrance",
  "a flat smooth paved walkway": "Smooth walkway",
};

interface ProgressCallback {
  progress?: number;
  status?: string;
  file?: string;
}

interface ZeroShotClassifier {
  (
    image: string,
    labels: string[],
    opts?: { hypothesis_template?: string; topk?: number },
  ): Promise<Array<{ label: string; score: number }>>;
}

/**
 * On-device privacy-first vision analysis using transformers.js.
 * The photo never leaves the browser; the model runs locally.
 */
export async function analyzeImage(
  file: File,
  onProgress?: (progress: number, status: string) => void,
): Promise<AiAnalysisResult> {
  try {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    let classifier: ZeroShotClassifier | null = null;
    let modelId = "";
    let lastError: unknown = null;

    for (const candidate of MODEL_CANDIDATES) {
      try {
        onProgress?.(4, `Loading ${candidate.split("/")[1]}...`);
        const loaded = await pipeline("zero-shot-image-classification", candidate, {
          progress_callback: (p: ProgressCallback) => {
            if (typeof p.progress === "number") {
              onProgress?.(Math.round(4 + p.progress * 0.86), "Downloading model...");
            }
          },
        });
        classifier = loaded as ZeroShotClassifier;
        modelId = candidate;
        break;
      } catch (error) {
        lastError = error;
        onProgress?.(4, "Model unavailable, trying a fallback...");
      }
    }

    if (!classifier) {
      throw lastError ?? new Error("No AI model could be loaded.");
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      onProgress?.(94, "Analyzing on your device (nothing is uploaded)...");
      const output = await classifier(objectUrl, LABELS, {
        hypothesis_template: "a photo of {}",
        topk: LABELS.length,
      });
      const detections: AiDetection[] = output.map((o) => ({
        label: FEATURE_MAP[o.label] ?? o.label,
        score: Math.round(o.score * 100) / 100,
      }));
      const best = detections[0];
      onProgress?.(100, "Done");
      return {
        detections,
        feature: best?.label ?? "Unknown feature",
        confidence: best?.score ?? 0,
        modelVersion: modelId,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    return {
      detections: [],
      feature: "",
      confidence: 0,
      modelVersion: "",
      error:
        error instanceof Error
          ? error.message
          : "On-device analysis failed. You can still submit a manual report.",
    };
  }
}