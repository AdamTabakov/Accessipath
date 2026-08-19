import type {
  AiAnalysisResult,
  AiDetection,
  AiRouteIntent,
  ReportType,
  RouteMode,
} from "../types/index.js";

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

const TEXT_MODEL_ID = "Xenova/all-MiniLM-L6-v2";

const TEXT_LABELS = [
  "avoid stairs",
  "prefer ramps",
  "prefer elevators",
  "prefer smooth surfaces",
  "steep slopes are acceptable",
  "shortest possible distance",
  "most accessible route",
  "no preference",
] as const;

const TEXT_INTENT_MAP: Record<string, (intent: AiRouteIntent) => void> = {
  "avoid stairs": (i) => {
    i.avoidStairs = true;
  },
  "prefer ramps": (i) => {
    i.preferRamps = true;
  },
  "prefer elevators": (i) => {
    i.preferElevators = true;
  },
  "prefer smooth surfaces": (i) => {
    i.preferSmoothSurface = true;
  },
  "steep slopes are acceptable": (i) => {
    i.maxSlope = "steep";
  },
  "shortest possible distance": (i) => {
    i.mode = "fastest";
  },
  "most accessible route": (i) => {
    i.mode = "most_accessible";
  },
};

function keywordIntent(text: string): AiRouteIntent {
  const q = text.toLowerCase();
  const intent: AiRouteIntent = {
    avoidStairs: false,
    preferRamps: false,
    preferElevators: false,
    preferSmoothSurface: false,
    maxSlope: "any",
    mode: null,
  };
  if (/\bstairs?\b/.test(q)) intent.avoidStairs = true;
  if (/\bramps?\b/.test(q)) intent.preferRamps = true;
  if (/\belevators?\b|\blifts?\b/.test(q)) intent.preferElevators = true;
  if (/\bsmooth\b|\bpaved\b/.test(q)) intent.preferSmoothSurface = true;
  if (/\bsteep\b|\bhills?\b/.test(q)) intent.maxSlope = "steep";
  if (/\bshortest\b|\bfastest\b/.test(q)) intent.mode = "fastest";
  if (/\bmost accessible\b/.test(q)) intent.mode = "most_accessible";
  return intent;
}

interface TextZeroShotResult {
  labels: string[];
  scores: number[];
}

interface TextClassifier {
  (
    text: string,
    labels: string[],
    opts?: { hypothesis_template?: string },
  ): Promise<TextZeroShotResult>;
}

/**
 * Understand a natural-language route request like
 * "from SLC to Union Station avoiding stairs" and infer accessibility
 * preferences. Runs on-device via transformers.js (nothing is uploaded).
 * If the AI text model cannot load, falls back to transparent keyword
 * matching — `model` reports which path was used.
 */
export async function analyzeRouteRequest(
  text: string,
  onProgress?: (progress: number, status: string) => void,
): Promise<{ intent: AiRouteIntent; model: string }> {
  try {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    onProgress?.(5, "Loading AI text model...");
    const loadedClassifier: unknown = await pipeline("zero-shot-classification", TEXT_MODEL_ID, {
      progress_callback: (p: ProgressCallback) => {
        if (typeof p.progress === "number") {
          onProgress?.(Math.round(5 + p.progress * 0.85), "Downloading AI model...");
        }
      },
    });
    const classifier = loadedClassifier as TextClassifier;

    onProgress?.(90, "Understanding your request (on-device)...");
    const out = await classifier(text, [...TEXT_LABELS], {
      hypothesis_template: "This route request: {}",
    });

    const scores = out.labels.map((label, index) => ({ label, score: out.scores[index] ?? 0 }));
    const noPreference = scores.find((s) => s.label === "no preference")?.score ?? 0;
    const intent: AiRouteIntent = {
      avoidStairs: false,
      preferRamps: false,
      preferElevators: false,
      preferSmoothSurface: false,
      maxSlope: "any",
      mode: null,
    };
    for (const s of scores) {
      if (s.label === "no preference") continue;
      if (s.score >= 0.5 && s.score >= noPreference) {
        TEXT_INTENT_MAP[s.label]?.(intent);
      }
    }
    onProgress?.(100, "Done");
    return { intent, model: TEXT_MODEL_ID };
  } catch (error) {
    onProgress?.(100, "Used basic keyword matching");
    return { intent: keywordIntent(text), model: "" };
  }
}

const DETECTION_TO_REPORT_TYPE: Record<string, ReportType> = {
  Stairs: "stairs",
  Ramp: "blocked_ramp",
  Elevator: "broken_elevator",
  Obstacle: "obstacle",
};

/**
 * Suggest a report type from the top on-device photo detection, or null when
 * the model is not confident enough (>= 55%) or the feature maps to no type.
 */
export function suggestReportType(detections: AiDetection[]): ReportType | null {
  const best = detections[0];
  if (!best || best.score < 0.55) return null;
  return DETECTION_TO_REPORT_TYPE[best.label] ?? null;
}

export function routeModeFromIntent(intent: AiRouteIntent): RouteMode | null {
  return intent.mode;
}