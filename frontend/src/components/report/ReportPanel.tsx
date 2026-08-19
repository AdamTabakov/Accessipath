import { useMemo, useState } from "react";
import { MapPin, Upload, X } from "lucide-react";
import type {
  AccessibilityReport,
  AiObservation,
  Coordinates,
  ReportType,
} from "../../types/index.js";
import { REPORT_TYPE_LABELS, MAX_REPORT_PHOTO_MB } from "../../utils/constants.js";
import { useAiAnalysis } from "../../hooks/useAiAnalysis.js";
import * as api from "../../services/api.js";
import { Button, ProgressBar, Select, TextArea, Spinner } from "../ui.js";
import { SpotlightCard } from "../ui-kit/SpotlightCard.js";
import FileUpload from "../kokonutui/file-upload.js";

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AIConfidenceBars({ detections }: { detections: Array<{ label: string; score: number }> }) {
  const best = detections[0]?.score ?? 0;
  return (
    <ul className="space-y-2">
      {detections.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className={d.score === best ? "font-semibold text-silk" : "text-platinum"}>
              {d.label}
            </span>
            <span className="text-ash">{Math.round(d.score * 100)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(d.score * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={d.label}
            className="h-1.5 w-full overflow-hidden rounded-full bg-smoke"
          >
            <div
              className={`h-full rounded-full ${
                d.score === best ? "bg-status-accessible" : "bg-graphite"
              }`}
              style={{ width: `${Math.round(d.score * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface ReportPanelProps {
  pickedLocation: Coordinates | null;
  pickingLocation: boolean;
  onRequestPick: () => void;
  onCancelPick: () => void;
  onSubmitted: (report: AccessibilityReport) => void;
  onClose: () => void;
}

export function ReportPanel({
  pickedLocation,
  pickingLocation,
  onRequestPick,
  onCancelPick,
  onSubmitted,
  onClose,
}: ReportPanelProps) {
  const [type, setType] = useState<ReportType>("blocked_ramp");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [attachAi, setAttachAi] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const ai = useAiAnalysis();

  const hasLocation = pickedLocation !== null;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    void ai.analyze(file);
  };

  const aiObservation: AiObservation | undefined = useMemo(() => {
    if (!attachAi || !ai.result || ai.result.error) return undefined;
    return {
      feature: ai.result.feature,
      confidence: ai.result.confidence,
      modelVersion: ai.result.modelVersion,
      createdAt: new Date().toISOString(),
      allDetections: ai.result.detections,
    };
  }, [attachAi, ai.result]);

  const handleSubmit = async () => {
    if (!pickedLocation) {
      setSubmitError("Pick a location on the map first.");
      return;
    }
    if (description.trim().length < 3) {
      setSubmitError("Please describe the issue (at least 3 characters).");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const photoData = photo ? await toDataUrl(photo) : undefined;
      const { report } = await api.createReport({
        type,
        description: description.trim(),
        latitude: pickedLocation.latitude,
        longitude: pickedLocation.longitude,
        photo: photoData,
        aiObservation,
      });
      setDone(true);
      onSubmitted(report);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not submit the report.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-card bg-charcoal p-6" role="status" aria-live="polite">
        <h3 className="text-xl font-semibold text-silk">Report submitted</h3>
        <p className="mt-2 text-sm text-platinum">
          Thank you. Your report is <strong className="text-status-warning">pending verification</strong>{" "}
          and will appear on nearby routes immediately. Institutional information is never overwritten
          by reports — both are shown side by side.
        </p>
        {pickedLocation && (
          <p className="mt-2 text-xs text-ash">
            Location: {pickedLocation.latitude.toFixed(5)}, {pickedLocation.longitude.toFixed(5)}
          </p>
        )}
        {photoPreview && (
          <img
            src={photoPreview}
            alt="Your submitted photo"
            className="mt-3 max-h-48 w-full rounded-card-sm border border-graphite object-cover"
          />
        )}
        <Button className="mt-4" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <SpotlightCard className="rounded-card bg-charcoal p-6" color="rgba(41,151,255,0.1)">
      <div aria-label="Report an accessibility issue">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-xl font-semibold text-silk">Report an issue</h3>
        <button
          onClick={onClose}
          className="rounded-full bg-smoke p-2 text-ash hover:text-silk"
          aria-label="Close report panel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-5">
        <Select label="What's the issue?" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
          {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((t) => (
            <option key={t} value={t}>
              {REPORT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>

        <div>
          <p className="mb-1.5 text-sm font-medium text-silk">Location</p>
          {hasLocation ? (
            <div className="flex items-center gap-2 rounded-input border border-status-accessible/40 bg-status-accessible/10 px-4 py-2.5 text-sm text-silk">
              <MapPin className="h-4 w-4 text-status-accessible" aria-hidden="true" />
              {pickedLocation.latitude.toFixed(5)}, {pickedLocation.longitude.toFixed(5)}
              <button
                onClick={onRequestPick}
                className="ml-auto text-xs font-medium text-link-blue hover:underline"
              >
                Change
              </button>
            </div>
          ) : pickingLocation ? (
            <div className="flex items-center gap-2 rounded-input bg-link-blue/15 px-4 py-2.5 text-sm text-link-blue">
              <Spinner label="Tap the map to set the location..." />
              <button
                onClick={onCancelPick}
                className="ml-auto text-xs font-medium hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onRequestPick}>
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Pick on map
            </Button>
          )}
        </div>

        <TextArea
          label="Describe what you saw"
          hint="Temporary conditions, blockages, broken equipment, or missing accessibility features."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          placeholder="e.g. The ramp is blocked by delivery crates."
        />

        <div>
          <p className="mb-1.5 text-sm font-medium text-silk">Photo (optional)</p>
          <FileUpload
            acceptedFileTypes={["image/png", "image/jpeg"]}
            maxFileSize={MAX_REPORT_PHOTO_MB * 1024 * 1024}
            uploadDelay={0}
            onUploadSuccess={(f) => handleFile(f)}
            onFileRemove={() => {
              setPhoto(null);
              setPhotoPreview(null);
              ai.clear();
            }}
            className="max-w-none"
          />

          {photo && photoPreview && (
            <div className="mt-3 overflow-hidden rounded-card-sm border border-graphite">
              <img
                src={photoPreview}
                alt="Preview of the issue you are reporting"
                className="max-h-48 w-full object-cover"
              />
              <div className="flex items-center justify-between gap-2 bg-smoke px-4 py-2">
                <span className="truncate text-xs text-platinum">
                  {photo.name} · {(photo.size / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                    ai.clear();
                  }}
                  className="text-xs text-ash hover:text-silk"
                  aria-label="Remove photo"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {photo && ai.analyzing && (
            <div className="mt-3 space-y-2">
              <ProgressBar value={ai.progress} label={`AI: ${ai.status}`} />
              <p className="text-xs text-ash">
                Analyzing on your device — the photo never leaves your browser.
              </p>
            </div>
          )}

          {photo && ai.error && !ai.analyzing && (
            <p className="mt-2 text-sm text-status-inaccessible" role="alert">
              {ai.error}
            </p>
          )}

          {photo && ai.result && !ai.analyzing && !ai.error && (
            <div className="mt-3 rounded-card-sm border border-graphite p-4">
              <p className="mb-2 text-sm font-semibold text-silk">
                AI observation (on-device)
              </p>
              <AIConfidenceBars detections={ai.result.detections} />
              <label className="mt-3 flex items-center gap-2 text-sm text-platinum">
                <input
                  type="checkbox"
                  checked={attachAi}
                  onChange={(e) => setAttachAi(e.target.checked)}
                  className="h-4 w-4 accent-[#0071e3]"
                />
                Attach this observation to the report
              </label>
            </div>
          )}

          {photo && (
            <p className="mt-2 text-xs text-ash">
              Max {MAX_REPORT_PHOTO_MB} MB · PNG or JPEG only. Photos are analyzed on your device and
              never uploaded.
            </p>
          )}
        </div>

        {submitError && (
          <p className="rounded-card-sm border border-status-inaccessible/40 bg-status-inaccessible/10 px-4 py-3 text-sm text-status-inaccessible" role="alert">
            {submitError}
          </p>
        )}

        <Button className="w-full" size="lg" onClick={handleSubmit} loading={submitting}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Submit report
        </Button>
      </div>
      </div>
    </SpotlightCard>
  );
}