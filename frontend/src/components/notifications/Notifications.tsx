import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { NOTIFICATION_EVENT, type AppNotification } from "./events.js";

type NotificationKind = AppNotification["kind"];

function iconFor(kind: NotificationKind) {
  if (kind === "success") return <CheckCircle2 className="h-5 w-5 text-status-accessible" aria-hidden="true" />;
  if (kind === "error") return <AlertTriangle className="h-5 w-5 text-status-inaccessible" aria-hidden="true" />;
  return <Info className="h-5 w-5 text-link-blue" aria-hidden="true" />;
}

export function NotificationViewport() {
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    const handleNotify = (event: Event) => {
      const notification = (event as CustomEvent<AppNotification>).detail;
      setItems((current) => [notification, ...current].slice(0, 4));
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== notification.id));
      }, notification.kind === "error" ? 7000 : 4500);
    };
    window.addEventListener(NOTIFICATION_EVENT, handleNotify);
    return () => window.removeEventListener(NOTIFICATION_EVENT, handleNotify);
  }, []);

  return (
    <div
      className="fixed right-4 top-4 z-[3000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-card-sm border border-graphite bg-charcoal/95 p-4 text-silk shadow-xl shadow-black/30 backdrop-blur"
          role={item.kind === "error" ? "alert" : "status"}
        >
          <div className="flex items-start gap-3">
            {iconFor(item.kind)}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.message && <p className="mt-1 text-sm text-platinum">{item.message}</p>}
            </div>
            <button
              type="button"
              className="rounded-full p-1 text-ash hover:bg-smoke hover:text-silk"
              aria-label="Dismiss notification"
              onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
