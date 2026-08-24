type NotificationKind = "error" | "success" | "info";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
}

export const NOTIFICATION_EVENT = "accessipath:notify";

export function notify(input: Omit<AppNotification, "id">) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AppNotification>(NOTIFICATION_EVENT, {
      detail: { ...input, id: crypto.randomUUID() },
    }),
  );
}
