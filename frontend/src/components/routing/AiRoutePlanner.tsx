import { useState } from "react";
import { Mic, MicOff, Sparkles, X } from "lucide-react";
import type { AiRouteIntent, Place } from "../../types/index.js";
import * as api from "../../services/api.js";
import { analyzeRouteRequest } from "../../services/ai.js";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition.js";
import { Button, ProgressBar } from "../ui.js";
import { SpotlightCard } from "../ui-kit/SpotlightCard.js";

export interface AiRouteApplyRequest {
  start: Place | null;
  end: Place | null;
  intent: AiRouteIntent;
  model: string;
}

function extractPhrases(query: string): { start: string | null; end: string | null } {
  const q = query.trim();
  const fromTo = q.match(/from\s+(.+?)\s+to\s+(.+)/i);
  if (fromTo) {
    return { start: fromTo[1]?.trim() ?? null, end: fromTo[2]?.trim() ?? null };
  }
  const from = q.match(/from\s+(.+)/i);
  if (from) {
    return { start: from?.[1]?.trim() ?? null, end: null };
  }
  const to = q.match(/(?:to|toward|heading to)\s+(.+)/i);
  if (to) {
    return { start: null, end: to[1]?.trim() ?? null };
  }
  return { start: null, end: q };
}

async function resolvePlace(phrase: string | null): Promise<Place | null> {
  if (!phrase || phrase.trim().length < 2) return null;
  const remote = await api.geocode(phrase).catch(() => ({ results: [] as Place[] }));
  return remote.results[0] ?? null;
}

function intentLabels(intent: AiRouteIntent): string[] {
  const labels: string[] = [];
  if (intent.avoidStairs) labels.push("Avoid stairs");
  if (intent.preferRamps) labels.push("Prefer ramps");
  if (intent.preferElevators) labels.push("Prefer elevators");
  if (intent.preferSmoothSurface) labels.push("Prefer smooth surfaces");
  if (intent.maxSlope !== "any") labels.push(`Max slope: ${intent.maxSlope}`);
  if (intent.mode === "fastest") labels.push("Optimize: fastest");
  if (intent.mode === "most_accessible") labels.push("Optimize: most accessible");
  return labels;
}

const EXAMPLE = "Try \"from SLC to Union Station avoiding stairs\"";

export function AiRoutePlanner({ onApply }: { onApply: (req: AiRouteApplyRequest) => void }) {
  const [query, setQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inferred, setInferred] = useState<string[]>([]);
  const [usedFallback, setUsedFallback] = useState(false);

  const {
    supported: speechSupported,
    listening,
    error: speechError,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition((text) => {
    setQuery((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    setError(null);
  });

  const handleSubmit = async () => {
    const text = query.trim();
    if (text.length < 3) {
      setError("Describe your route, e.g. \"from SLC to Union Station avoiding stairs\".");
      return;
    }
    setAnalyzing(true);
    setProgress(0);
    setStatus("Parsing your request...");
    setError(null);
    setInferred([]);
    try {
      const { intent, model } = await analyzeRouteRequest(text, (p, s) => {
        setProgress(p);
        setStatus(s);
      });
      const { start, end } = extractPhrases(text);
      const [startPlace, endPlace] = await Promise.all([resolvePlace(start), resolvePlace(end)]);
      setInferred(intentLabels(intent));
      setUsedFallback(model === "");
      onApply({ start: startPlace, end: endPlace, intent, model });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI could not parse the request. Try again with a shorter description.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <SpotlightCard className="rounded-card bg-charcoal p-6" color="rgba(174,82,199,0.12)">
      <div aria-label="AI route assistant">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-silk">
            <Sparkles className="h-4 w-4 text-fuchsia" aria-hidden="true" />
            Ask AI to plan a route
          </h3>
          {inferred.length > 0 && (
            <button
              onClick={() => {
                setInferred([]);
                setQuery("");
              }}
              className="rounded-full bg-smoke p-1.5 text-ash hover:text-silk"
              aria-label="Clear AI route request"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <label htmlFor="ai-route-query" className="sr-only">
          Describe your route in plain language
        </label>
        <div className="mt-3 flex gap-2">
          <textarea
            id="ai-route-query"
            rows={2}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            placeholder={EXAMPLE}
            className="flex-1 rounded-input border border-graphite bg-charcoal px-4 py-3 text-base text-silk placeholder:text-ash focus:border-link-blue"
          />
          {speechSupported && (
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              aria-pressed={listening}
              aria-label={listening ? "Stop voice input" : "Speak your route"}
              title={listening ? "Stop listening" : "Speak your route"}
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-input border transition ${
                listening
                  ? "border-status-accessible bg-status-accessible/15 text-status-accessible"
                  : "border-graphite bg-charcoal text-platinum hover:border-link-blue hover:text-link-blue"
              }`}
            >
              {listening ? (
                <MicOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Mic className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {listening && (
          <p className="mt-2 flex items-center gap-2 text-sm text-status-accessible" aria-live="polite">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-status-accessible" aria-hidden="true" />
            Listening… describe your route, then stop.
          </p>
        )}
        {speechError && !listening && (
          <p className="mt-2 text-sm text-status-inaccessible" role="alert">
            {speechError}
          </p>
        )}

        {analyzing && (
          <div className="mt-3 space-y-2" aria-live="polite">
            <ProgressBar value={progress} label={`AI: ${status}`} />
            <p className="text-xs text-ash">
              Parsing on your device — your request is never uploaded.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-card-sm border border-status-inaccessible/40 bg-status-inaccessible/10 px-4 py-3 text-sm text-status-inaccessible" role="alert">
            {error}
          </p>
        )}

        {inferred.length > 0 && !analyzing && (
          <div className="mt-3 space-y-2" aria-live="polite">
            <p className="text-sm text-silk">AI understood your request:</p>
            <ul className="flex flex-wrap gap-2">
              {inferred.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-fuchsia/40 bg-fuchsia/10 px-3 py-1 text-xs text-silk"
                >
                  {label}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ash">
              {usedFallback
                ? "AI model unavailable — used basic keyword matching. Preferences are still applied."
                : "Inferred on-device. You can fine-tune these in Preferences."}
            </p>
          </div>
        )}

        <Button className="mt-4 w-full" size="lg" onClick={handleSubmit} loading={analyzing}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Plan with AI
        </Button>
        <p className="mt-2 text-xs text-ash">{EXAMPLE}</p>
      </div>
    </SpotlightCard>
  );
}