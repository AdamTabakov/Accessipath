import { useState } from "react";
import { Check } from "lucide-react";
import type { MobilityProfile } from "../types/index.js";
import { PROFILE_LABELS } from "../utils/constants.js";
import { useProfile } from "../hooks/useProfile.js";
import { Button, Select, Toggle } from "../components/ui.js";
import { SpotlightCard } from "../components/ui-kit/SpotlightCard.js";

const PROFILES: MobilityProfile[] = [
  "wheelchair",
  "walker",
  "cane",
  "limited_mobility",
  "custom",
];

export function PreferencesPage() {
  const { profile, updateProfile, persistProfile } = useProfile();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    persistProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-5xl">
        Preferences
      </h1>
      <p className="mt-3 text-lg text-platinum">
        Routes are scored against these preferences. Stored locally and synced to your profile —
        never shared.
      </p>

      <section aria-label="Mobility profile" className="mt-10">
        <h2 className="text-2xl font-semibold text-silk">Mobility profile</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROFILES.map((p) => {
            const meta = PROFILE_LABELS[p];
            const selected = profile.mobilityProfile === p;
            return (
              <SpotlightCard
                key={p}
                className="rounded-card"
                color="rgba(41,151,255,0.12)"
              >
                <button
                  onClick={() => updateProfile({ mobilityProfile: p })}
                  aria-pressed={selected}
                  className={`w-full rounded-card p-5 text-left transition-colors ${
                    selected
                      ? "border border-link-blue bg-link-blue/15"
                      : "border border-graphite bg-charcoal hover:border-platinum"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-silk">{meta.label}</span>
                    {selected && (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-apple-blue text-white">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ash">{meta.hint}</p>
                </button>
              </SpotlightCard>
            );
          })}
        </div>
      </section>

      <section aria-label="Route preferences" className="mt-10">
        <SpotlightCard className="rounded-card bg-charcoal p-6">
          <h2 className="text-xl font-semibold text-silk">Route preferences</h2>
          <div className="mt-6 flex flex-col gap-6">
            <Toggle
              checked={profile.avoidStairs}
              onChange={(avoidStairs) => updateProfile({ avoidStairs })}
              label="Avoid stairs"
              description="Step-free routes whenever possible."
            />
            <Toggle
              checked={profile.preferRamps}
              onChange={(preferRamps) => updateProfile({ preferRamps })}
              label="Prefer ramps"
              description="Reward routes with ramp access."
            />
            <Toggle
              checked={profile.preferElevators}
              onChange={(preferElevators) => updateProfile({ preferElevators })}
              label="Prefer elevators"
              description="Reward routes with elevator access."
            />
            <Toggle
              checked={profile.preferSmoothSurface}
              onChange={(preferSmoothSurface) => updateProfile({ preferSmoothSurface })}
              label="Prefer smooth surfaces"
              description="Avoid rough, uneven terrain."
            />
            <Select
              label="Maximum slope"
              value={profile.maxSlope}
              onChange={(e) =>
                updateProfile({ maxSlope: e.target.value as typeof profile.maxSlope })
              }
            >
              <option value="flat">Flat only</option>
              <option value="moderate">Moderate</option>
              <option value="steep">Steep allowed</option>
              <option value="any">Any</option>
            </Select>
            <div>
              <label htmlFor="max-walk" className="mb-1.5 block text-sm font-medium text-silk">
                Preferred maximum walking distance: {profile.maxWalkDistanceMeters} m
              </label>
              <input
                id="max-walk"
                type="range"
                min={100}
                max={5000}
                step={100}
                value={profile.maxWalkDistanceMeters}
                onChange={(e) =>
                  updateProfile({ maxWalkDistanceMeters: Number(e.target.value) })
                }
                className="w-full accent-[#0071e3]"
              />
            </div>
          </div>
        </SpotlightCard>
      </section>

      <div className="mt-8 flex items-center gap-4">
        <Button onClick={handleSave}>Save preferences</Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-status-accessible" role="status">
            <Check className="h-4 w-4" aria-hidden="true" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}