export type NotifPerm = "default" | "granted" | "denied" | "unsupported";

export function getPermission(): NotifPerm {
  if (typeof window === "undefined") return "default";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission as NotifPerm;
}

export async function requestPermission(): Promise<NotifPerm> {
  if (typeof window === "undefined") return "default";
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result as NotifPerm;
}

export function showNotification(title: string, body: string): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "ttogachi-safety",
      requireInteraction: false,
    });
    setTimeout(() => n.close(), 8000);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (e) {
    console.warn("Notification failed:", e);
  }
}
