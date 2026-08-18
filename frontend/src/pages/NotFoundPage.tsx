import { Compass, MapPin } from "lucide-react";
import { MapBackground } from "../components/background/MapBackground.js";
import {
  MagneticLink,
  ShimmerLink,
  ShinyText,
  TextGenerateEffect,
} from "../components/ui-kit/index.js";

export function NotFoundPage() {
  return (
    <section className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden bg-true-black">
      <MapBackground opacity="opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-true-black/40 via-transparent to-true-black" />

      <div className="relative mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
        <div className="relative mx-auto mb-8 inline-grid h-24 w-24 place-items-center rounded-full border border-graphite bg-charcoal">
          <Compass className="h-11 w-11 text-link-blue" aria-hidden="true" />
          <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-apple-blue text-xs font-bold text-white">
            ?
          </span>
        </div>

        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-link-blue">
          <ShinyText>No route found</ShinyText>
        </p>

        <h1 className="font-display text-7xl font-semibold tracking-tight text-silk md:text-9xl">
          404
        </h1>

        <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-platinum">
          <TextGenerateEffect words="This page took a wrong turn. There's no accessible route to it." />
        </p>

        <p className="mt-3 text-sm text-ash">
          Maybe it's an inaccessible page, or it moved to a different address.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <ShimmerLink to="/map" className="px-8 py-4 text-lg">
            <MapPin className="h-5 w-5" aria-hidden="true" />
            Plan a route
          </ShimmerLink>
          <MagneticLink to="/" className="rounded-pill bg-transparent px-8 py-4 text-lg font-medium text-silk transition hover:bg-charcoal">
              Back home
            </MagneticLink>
        </div>
      </div>
    </section>
  );
}