import { useCallback, useRef, useState } from "react";
import type { AiAnalysisResult } from "../types/index.js";
import { analyzeImage } from "../services/ai.js";
import { MAX_REPORT_PHOTO_MB } from "../utils/constants.js";

export interface UseAiAnalysisResult {
  analyzing: boolean;
  progress: number;
  status: string;
  result: AiAnalysisResult | null;
  error: string | null;
  analyze: (file: File) => Promise<boolean>;
  clear: () => void;
}

export function useAiAnalysis(): UseAiAnalysisResult {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);

  const analyze = useCallback(async (file: File): Promise<boolean> => {
    if (active.current) return false;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPEG, PNG, WebP or GIF).");
      return false;
    }
    if (file.size > MAX_REPORT_PHOTO_MB * 1024 * 1024) {
      setError(`Photo is too large (max ${MAX_REPORT_PHOTO_MB} MB).`);
      return false;
    }

    active.current = true;
    setAnalyzing(true);
    setProgress(0);
    setStatus("Preparing...");
    setResult(null);
    setError(null);

    try {
      const outcome = await analyzeImage(file, (p, s) => {
        setProgress(p);
        setStatus(s);
      });
      setResult(outcome);
      if (outcome.error) setError(outcome.error);
      return Boolean(outcome.detections.length && !outcome.error);
    } finally {
      active.current = false;
      setAnalyzing(false);
    }
  }, []);

  const clear = useCallback(() => {
    active.current = false;
    setAnalyzing(false);
    setProgress(0);
    setStatus("");
    setResult(null);
    setError(null);
  }, []);

  return { analyzing, progress, status, result, error, analyze, clear };
}