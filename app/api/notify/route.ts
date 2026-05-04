import { NextRequest, NextResponse } from "next/server";
import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  getMessaging,
  type MulticastMessage,
} from "firebase-admin/messaging";

let cached: App | undefined;

function getAdminApp(): App {
  if (cached) return cached;
  if (getApps().length > 0) {
    cached = getApps()[0];
    return cached!;
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON env var is not set");
  }
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(json) as ServiceAccount;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  cached = initializeApp({ credential: cert(sa) });
  return cached;
}

type EventType =
  | "safety_late"
  | "safety_arrived"
  | "safety_location_shared"
  | "safety_location_requested"
  | "board_new_post"
  | "allowance_submitted"
  | "allowance_paid";

type Body = {
  type: EventType;
  familyId: string;
  childUid?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

type FamilyMember = { role: "parent" | "child" };
type FamilyDoc = { members: Record<string, FamilyMember> };

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!idToken) {
      return NextResponse.json({ error: "missing token" }, { status: 401 });
    }

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    const senderUid = decoded.uid;

    const payload = (await req.json()) as Body;
    if (!payload?.familyId || !payload?.type || !payload?.title) {
      return NextResponse.json({ error: "bad payload" }, { status: 400 });
    }

    const adb = getFirestore(app);
    const familySnap = await adb
      .collection("families")
      .doc(payload.familyId)
      .get();
    if (!familySnap.exists) {
      return NextResponse.json({ error: "family not found" }, { status: 404 });
    }
    const family = familySnap.data() as FamilyDoc;
    if (!family.members?.[senderUid]) {
      return NextResponse.json({ error: "not a member" }, { status: 403 });
    }

    // Determine target uids
    const targetUids: string[] = [];
    if (payload.type === "safety_location_requested" && payload.childUid) {
      if (payload.childUid !== senderUid) targetUids.push(payload.childUid);
    } else if (payload.type.startsWith("safety_")) {
      // Notify all parents (other than sender)
      for (const [uid, m] of Object.entries(family.members)) {
        if (m.role === "parent" && uid !== senderUid) targetUids.push(uid);
      }
    } else if (payload.type === "allowance_paid") {
      // Notify the child
      if (payload.childUid && payload.childUid !== senderUid) {
        targetUids.push(payload.childUid);
      }
    } else {
      // Default: notify all family members except sender
      for (const uid of Object.keys(family.members)) {
        if (uid !== senderUid) targetUids.push(uid);
      }
    }

    if (targetUids.length === 0) {
      return NextResponse.json({ sent: 0, skipped: "no targets" });
    }

    // Collect FCM tokens
    const tokens: string[] = [];
    for (const uid of targetUids) {
      const userSnap = await adb.collection("users").doc(uid).get();
      const data = userSnap.data() as { fcmTokens?: string[] } | undefined;
      if (data?.fcmTokens && Array.isArray(data.fcmTokens)) {
        tokens.push(...data.fcmTokens);
      }
    }

    if (tokens.length === 0) {
      return NextResponse.json({ sent: 0, skipped: "no tokens" });
    }

    const message: MulticastMessage = {
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      webpush: {
        notification: { icon: "/icon.svg", tag: "ttogachi-fcm" },
        fcmOptions: { link: "/" },
      },
    };

    const messaging = getMessaging(app);
    const result = await messaging.sendEachForMulticast(message);

    // Clean up invalid tokens (best-effort)
    const dead: string[] = [];
    result.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          dead.push(tokens[i]);
        }
      }
    });
    if (dead.length > 0) {
      // Remove dead tokens from any user that has them
      const userSnaps = await Promise.all(
        targetUids.map((u) => adb.collection("users").doc(u).get())
      );
      await Promise.all(
        userSnaps.map(async (snap, idx) => {
          const data = snap.data() as { fcmTokens?: string[] } | undefined;
          if (!data?.fcmTokens) return;
          const cleaned = data.fcmTokens.filter((t) => !dead.includes(t));
          if (cleaned.length !== data.fcmTokens.length) {
            await adb
              .collection("users")
              .doc(targetUids[idx])
              .update({ fcmTokens: cleaned });
          }
        })
      );
    }

    return NextResponse.json({
      sent: result.successCount,
      failed: result.failureCount,
      cleaned: dead.length,
    });
  } catch (e) {
    console.error("/api/notify error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
