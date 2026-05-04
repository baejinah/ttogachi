"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { onForegroundMessage, registerForPush } from "@/lib/fcm";
import { showNotification } from "@/lib/notifications";

/**
 * Global watcher mounted at the app root.
 *
 *   1. Auto-registers an FCM token on every login (if user has already
 *      granted notification permission earlier — never auto-prompts).
 *   2. Listens for foreground FCM messages and surfaces them as
 *      browser notifications. Background messages are handled by sw.js.
 */
export default function SafetyWatcher() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    void registerForPush();
  }, [user]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const u = await onForegroundMessage(({ title, body }) => {
        showNotification(title, body);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return null;
}
