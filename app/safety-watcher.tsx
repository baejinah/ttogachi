"use client";

import { useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { subscribeSafety, type SafetyDoc } from "@/lib/safety";
import { showNotification } from "@/lib/notifications";
import type { Family } from "@/lib/types";

/**
 * Global watcher: subscribes to family safety docs and fires browser
 * notifications on relevant changes. Mounted at the app root so notifications
 * fire even when the user is on another page.
 */
export default function SafetyWatcher() {
  const { user, userDoc } = useAuth();
  const subscribedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!user || !userDoc?.familyId || !userDoc.role) return;
    const familyId = userDoc.familyId;
    const myUid = user.uid;
    const myRole = userDoc.role;
    subscribedAtRef.current = Date.now();

    const safetyUnsubs = new Map<string, () => void>();
    const lastDocs = new Map<string, SafetyDoc>();

    const unsubFamily = onSnapshot(
      doc(db, "families", familyId),
      (snap) => {
        if (!snap.exists()) return;
        const family = {
          id: snap.id,
          ...(snap.data() as Omit<Family, "id">),
        } as Family;

        const targetUids: string[] =
          myRole === "child"
            ? [myUid]
            : Object.entries(family.members)
                .filter(([, m]) => m.role === "child")
                .map(([uid]) => uid);

        // Add new
        for (const uid of targetUids) {
          if (safetyUnsubs.has(uid)) continue;
          const memberName =
            family.members[uid]?.displayName ?? "자녀";
          const unsub = subscribeSafety(familyId, uid, (sdoc) => {
            if (!sdoc) return;
            const prev = lastDocs.get(uid);
            lastDocs.set(uid, sdoc);

            const ts = sdoc.updatedAt?.toMillis() ?? 0;
            // Skip events from before we subscribed (initial load)
            if (ts < subscribedAtRef.current + 1500) return;

            // Parent: status changes + location shares
            if (myRole === "parent") {
              if (
                prev?.status === "normal" &&
                sdoc.status === "out_late"
              ) {
                showNotification(
                  `${memberName} 늦어요`,
                  sdoc.message || "오늘 늦게 들어와요"
                );
              }
              if (
                prev?.status === "out_late" &&
                sdoc.status === "normal" &&
                sdoc.arrivedAt
              ) {
                showNotification(
                  `${memberName} 귀가 완료`,
                  "안전하게 도착했어요"
                );
              }
              const prevLoc =
                prev?.lastLocation?.timestamp?.toMillis() ?? 0;
              const newLoc =
                sdoc.lastLocation?.timestamp?.toMillis() ?? 0;
              if (newLoc > prevLoc) {
                showNotification(
                  `${memberName} 위치 공유`,
                  "지도에서 확인해보세요"
                );
              }
            }

            // Child: location request from parent
            if (myRole === "child" && uid === myUid) {
              const prevReq =
                prev?.locationRequest?.requestedAt?.toMillis() ?? 0;
              const newReq =
                sdoc.locationRequest?.requestedAt?.toMillis() ?? 0;
              if (
                newReq > prevReq &&
                sdoc.locationRequest?.requestedBy !== myUid
              ) {
                showNotification(
                  "📍 위치 요청",
                  "부모님이 지금 어디 있는지 궁금해해요"
                );
              }
            }
          });
          safetyUnsubs.set(uid, unsub);
        }

        // Remove gone
        for (const [uid, unsub] of safetyUnsubs.entries()) {
          if (!targetUids.includes(uid)) {
            unsub();
            safetyUnsubs.delete(uid);
            lastDocs.delete(uid);
          }
        }
      }
    );

    return () => {
      unsubFamily();
      for (const unsub of safetyUnsubs.values()) unsub();
    };
  }, [user, userDoc?.familyId, userDoc?.role, user?.uid]);

  return null;
}
