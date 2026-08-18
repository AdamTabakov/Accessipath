import type { ReactNode } from "react";
import { TextGenerateEffect } from "../ui-kit/TextGenerateEffect.js";

export function LegalLayout({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-link-blue">{eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-silk md:text-5xl">
        <TextGenerateEffect words={title} />
      </h1>
      <p className="mt-4 text-sm text-ash">Last updated: {updated}</p>
      <div className="mt-12 space-y-8">{children}</div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card bg-charcoal p-7 sm:p-8">
      <h2 className="text-xl font-semibold text-silk">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-platinum">{children}</div>
    </section>
  );
}