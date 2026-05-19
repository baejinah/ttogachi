import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import type { UserDoc } from "./types";

export async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const data: Omit<UserDoc, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    uid: user.uid,
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "이름없음",
    email: user.email ?? "",
    photoURL: user.photoURL ?? null,
    familyId: null,
    role: null,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
}

export async function setGoogleCalendarId(
  uid: string,
  calendarId: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { googleCalendarId: calendarId });
}

export async function setGoogleSyncToken(
  uid: string,
  token: string | null
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { googleSyncToken: token });
}

export async function setLedgerCategories(
  uid: string,
  type: "expense" | "income",
  categories: string[]
): Promise<void> {
  const field =
    type === "income" ? "ledgerIncomeCategories" : "ledgerExpenseCategories";
  await updateDoc(doc(db, "users", uid), { [field]: categories });
}
