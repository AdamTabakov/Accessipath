import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, MapPin, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import type { AccessibilityReport, Coordinates, ReportStatus, VoteDirection } from "../types/index.js";
import { useProfile } from "../hooks/useProfile.js";
import { useAuth } from "../hooks/useAuth.js";
import * as api from "../services/api.js";
import { MapCanvas } from "../components/map/MapCanvas.js";
import { ReportPanel } from "../components/report/ReportPanel.js";
import { TORONTO_CENTER } from "../utils/constants.js";
import { formatDate } from "../utils/format.js";

const STATUS_META: Record<ReportStatus, { label: string; className: string }> = {
  verified: {
    label: "Community verified",
    className: "bg-status-accessible/15 text-status-accessible",
  },
  pending: {
    label: "Pending verification",
    className: "bg-status-warning/15 text-status-warning",
  },
  rejected: {
    label: "Rejected by community",
    className: "bg-status-inaccessible/15 text-status-inaccessible",
  },
  expired: {
    label: "Expired",
    className: "bg-smoke text-ash",
  },
};

function StatusPill({ status }: { status: ReportStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}
    >
      {status === "verified" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {status === "pending" && <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
      {status === "rejected" && <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
      {status === "expired" && <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
      {meta.label}
    </span>
  );
}

function VoteControls({
  report,
  authed,
  voting,
  disabled,
  onVote,
}: {
  report: AccessibilityReport;
  authed: boolean;
  voting: boolean;
  disabled: boolean;
  onVote: (direction: VoteDirection) => void;
}) {
  const upActive = report.myVote === "up";
  const downActive = report.myVote === "down";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1" role="group" aria-label="Vote on this report">
        <button
          onClick={() => onVote("up")}
          disabled={disabled}
          aria-pressed={upActive}
          aria-label={`Upvote (${report.upvotes})`}
          title={authed ? "Upvote if this report is accurate" : "Sign in to vote"}
          className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
            upActive
              ? "border-status-accessible/50 bg-status-accessible/15 text-status-accessible"
              : "border-graphite text-platinum hover:border-platinum"
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
          {report.upvotes}
        </button>
        <button
          onClick={() => onVote("down")}
          disabled={disabled}
          aria-pressed={downActive}
          aria-label={`Downvote (${report.downvotes})`}
          title={authed ? "Downvote if this report is wrong or outdated" : "Sign in to vote"}
          className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
            downActive
              ? "border-status-inaccessible/50 bg-status-inaccessible/15 text-status-inaccessible"
              : "border-graphite text-platinum hover:border-platinum"
          }`}
        >
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
          {report.downvotes}
        </button>
      </div>
      {voting && <span className="text-xs text-ash">…</span>}
    </div>
  );
}

export function ReportPage() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [pickedLocation, setPickedLocation] = useState<Coordinates | null>(null);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [reports, setReports] = useState<AccessibilityReport[]>([]);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  const refreshReports = useCallback(() => {
    api.getReports().then(({ reports }) => setReports(reports)).catch(() => {});
  }, []);

  useEffect(refreshReports, [refreshReports]);

  const mapStart = { latitude: TORONTO_CENTER.latitude, longitude: TORONTO_CENTER.longitude, label: "Toronto" };

  const handleVote = async (report: AccessibilityReport, direction: VoteDirection) => {
    if (!user) return;
    setVotingId(report.id);
    setVoteError(null);
    try {
      const { report: updated } = await api.voteReport(report.id, direction);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : "Could not submit your vote.");
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-5xl">
        Report an accessibility issue
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-platinum">
        A broken elevator, a blocked ramp, construction, or a missing curb ramp. Reports affect route
        scoring immediately. Reports are community-verified: <strong className="text-silk">3 upvotes</strong>{" "}
        (with a 2:1 up:down ratio) mark them verified; <strong className="text-silk">3 downvotes</strong> hide
        them. Verified reports decay back to pending after 90 days unless re-confirmed.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="min-h-[380px]">
            <MapCanvas
              routes={[]}
              selectedRouteId={null}
              onSelectRoute={() => {}}
              start={mapStart}
              end={null}
              evidence={[]}
              unknownCoordinates={[]}
              showUnknown={false}
              reports={reports}
              pickingLocation={pickingLocation}
              pickedLocation={pickedLocation}
              onPickLocation={(c) => {
                setPickedLocation(c);
                setPickingLocation(false);
              }}
            />
          </div>
          <p className="text-sm text-ash">
            Profile: {profile.mobilityProfile}. Reports are shown as markers; reports near a route are
            used in scoring.
          </p>
        </div>

        <ReportPanel
          pickedLocation={pickedLocation}
          pickingLocation={pickingLocation}
          onRequestPick={() => setPickingLocation(true)}
          onCancelPick={() => setPickingLocation(false)}
          onSubmitted={refreshReports}
          onClose={() => setPickingLocation(false)}
        />
      </div>

      {voteError && (
        <p className="mt-6 rounded-card-sm border border-status-inaccessible/40 bg-status-inaccessible/10 px-4 py-3 text-sm text-status-inaccessible" role="alert">
          {voteError}
        </p>
      )}

      <section aria-label="Recent reports" className="mt-14">
        <h2 className="text-2xl font-semibold text-silk">Recent reports</h2>
        {reports.length === 0 ? (
          <p className="mt-4 text-sm text-ash">No reports yet. Be the first to help the community.</p>
        ) : (
          <>
            <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {reports.slice(0, 9).map((r) => (
                <li key={r.id} className="flex flex-col gap-3 rounded-card bg-charcoal p-5">
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill status={r.status} />
                    <span className="text-xs text-ash">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-silk">{r.description}</p>
                  <p className="flex items-center gap-1.5 text-xs text-ash">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-graphite pt-3">
                    <VoteControls
                      report={r}
                      authed={user !== null}
                      voting={votingId === r.id}
                      disabled={user === null || votingId !== null}
                      onVote={(direction) => handleVote(r, direction)}
                    />
                    {r.status === "verified" && r.verifiedAt && (
                      <span className="text-[11px] text-ash">
                        Verified {formatDate(r.verifiedAt)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {user === null && (
              <p className="mt-4 text-sm text-ash">
                Sign in to upvote or downvote reports — one vote per account.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}