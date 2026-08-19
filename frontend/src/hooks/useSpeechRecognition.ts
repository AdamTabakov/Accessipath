import { useCallback, useRef, useState } from "react";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

function getSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Browser-native speech-to-text (Web Speech API). Everything stays on-device;
 * the final transcript is handed to the caller. Returns `supported: false` in
 * browsers without SpeechRecognition (Firefox/Safari), so the UI can hide it.
 */
export function useSpeechRecognition(
  onFinal: (text: string) => void,
): UseSpeechRecognitionResult {
  const [supported] = useState(() => getSpeechRecognition() !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const rec = getSpeechRecognition();
    if (!rec) {
      setError("Speech recognition isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    recognitionRef.current = rec;
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i]?.[0]?.transcript ?? "";
        if (text) finalText = text;
      }
    };
    rec.onerror = (event) => {
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was denied. Allow the microphone and try again."
          : `Speech recognition error: ${event.error ?? "unknown"}.`,
      );
    };
    rec.onend = () => {
      setListening(false);
      const text = finalText.trim();
      if (text) {
        setTranscript(text);
        onFinalRef.current(text);
      }
      recognitionRef.current = null;
    };
    setError(null);
    setTranscript("");
    setListening(true);
    rec.start();
  }, []);

  return { supported, listening, transcript, error, start, stop };
}