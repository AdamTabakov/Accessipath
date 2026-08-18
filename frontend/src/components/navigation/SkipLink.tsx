export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[3000] focus:rounded-pill focus:bg-apple-blue focus:px-5 focus:py-3 focus:text-white"
    >
      Skip to main content
    </a>
  );
}