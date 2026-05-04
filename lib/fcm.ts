import { getApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from "firebase/messaging";
import {
  arrayRemove,
  arrayUnion,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let messagingInstance: Messaging | null = null;

async function getMessagingSafe(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (messagingInstance) return messagingInstance;
  if (!(await isSupported())) return null;
  messagingInstance = getMessaging(getApp());
  return messagingInstance;
}

/**
 * Request push permission, register the SW, fetch an FCM token,
 * and store it in the user's Firestore doc. Returns the token, or
 * null if the browser doesn't support push (e.g., iOS Safari without PWA install).
 */
export async function registerForPush(): Promise<string | null> {
  if (!VAPID_KEY) {
    console.warn("VAPID key is not configured");
    return null;
  }
  const messaging = await getMessagingSafe();
  if (!messaging) return null;

  if (!("serviceWorker" in navigator)) return null;

  const registration =
    (await navigator.serviceWorker.getRegistration("/sw.js")) ??
    (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;

  let token: string;
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (err) {
    console.warn("getToken failed:", err);
    return null;
  }

  if (!token) return null;

  if (auth.currentUser) {
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      fcmTokens: arrayUnion(token),
    }).catch((err) => console.warn("token save failed:", err));
  }

  return token;
}

/** Unregister this device's token (e.g., on logout). */
export async function unregisterPushToken(token: string): Promise<void> {
  if (!auth.currentUser) return;
  await updateDoc(doc(db, "users", auth.currentUser.uid), {
    fcmTokens: arrayRemove(token),
  }).catch((err) => console.warn("token remove failed:", err));
}

/** Subscribe to foreground FCM messages (when app is open). */
export async function onForegroundMessage(
  callback: (payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }) => void
): Promise<() => void> {
  const messaging = await getMessagingSafe();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "따로또같이";
    const body = payload.notification?.body ?? "";
    callback({ title, body, data: payload.data });
  });
}

/**
 * Server-trigger a notification via the /api/notify route.
 * Fire-and-forget: failures are logged but not thrown so local actions
 * (Firestore writes) aren't held back by network/server hiccups.
 */
export async function callNotify(payload: {
  type:
    | "safety_late"
    | "safety_arrived"
    | "safety_location_shared"
    | "safety_location_requested"
    | "board_new_post"
    | "allowance_submitted"
    | "allowance_paid";
  familyId: string;
  childUid?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const idToken = await auth.currentUser.getIdToken();
    await fetch("/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("notify call failed:", err);
  }
}
