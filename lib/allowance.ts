import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type PeriodStatus = "open" | "submitted" | "paid";

export type AllowancePeriod = {
  id: string;
  year: number;
  month: number; // 1-12
  childUid: string;
  status: PeriodStatus;
  submittedAt: Timestamp | null;
  paidAt: Timestamp | null;
  paidAmount: number | null;
  parentFeedback: string | null;
};

export type AllowanceEntry = {
  id: string;
  periodId: string;
  childUid: string;
  amount: number;
  category: string;
  memo: string;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
};

export const CATEGORIES = [
  "식비",
  "교통",
  "취미",
  "학용품",
  "쇼핑",
  "기타",
] as const;

export function periodId(
  childUid: string,
  year: number,
  month: number
): string {
  return `${childUid}__${year}-${String(month).padStart(2, "0")}`;
}

export function currentPeriodId(childUid: string, now = new Date()): string {
  return periodId(childUid, now.getFullYear(), now.getMonth() + 1);
}

const periodsCol = (familyId: string) =>
  collection(db, "families", familyId, "allowance_periods");

const entriesCol = (familyId: string) =>
  collection(db, "families", familyId, "allowance_entries");

/** Add an entry. Auto-creates the period if it doesn't exist. */
export async function addEntry(
  familyId: string,
  data: {
    childUid: string;
    amount: number;
    category: string;
    memo: string;
    date: string; // YYYY-MM-DD
  }
): Promise<void> {
  const [yearStr, monthStr] = data.date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const pid = periodId(data.childUid, year, month);

  // Ensure period exists
  const periodRef = doc(periodsCol(familyId), pid);
  const periodSnap = await getDoc(periodRef);
  if (!periodSnap.exists()) {
    await setDoc(periodRef, {
      year,
      month,
      childUid: data.childUid,
      status: "open" as PeriodStatus,
      submittedAt: null,
      paidAt: null,
      paidAmount: null,
      parentFeedback: null,
      createdAt: serverTimestamp(),
    });
  }

  await addDoc(entriesCol(familyId), {
    periodId: pid,
    childUid: data.childUid,
    amount: data.amount,
    category: data.category,
    memo: data.memo,
    date: data.date,
    createdAt: serverTimestamp(),
  });
}

export async function deleteEntry(
  familyId: string,
  entryId: string
): Promise<void> {
  await deleteDoc(doc(db, "families", familyId, "allowance_entries", entryId));
}

export async function updateEntry(
  familyId: string,
  entryId: string,
  data: {
    amount: number;
    category: string;
    memo: string;
    date: string;
  }
): Promise<void> {
  await updateDoc(doc(db, "families", familyId, "allowance_entries", entryId), {
    amount: data.amount,
    category: data.category,
    memo: data.memo,
    date: data.date,
  });
}

export async function submitPeriod(
  familyId: string,
  pid: string
): Promise<void> {
  await updateDoc(doc(periodsCol(familyId), pid), {
    status: "submitted" as PeriodStatus,
    submittedAt: serverTimestamp(),
  });
}

export async function payPeriod(
  familyId: string,
  pid: string,
  paidAmount: number,
  parentFeedback: string
): Promise<void> {
  await updateDoc(doc(periodsCol(familyId), pid), {
    status: "paid" as PeriodStatus,
    paidAt: serverTimestamp(),
    paidAmount,
    parentFeedback,
  });
}

export function subscribePeriod(
  familyId: string,
  pid: string,
  callback: (period: AllowancePeriod | null) => void
): () => void {
  return onSnapshot(doc(periodsCol(familyId), pid), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...(snap.data() as Omit<AllowancePeriod, "id">) });
  });
}

export function subscribeEntries(
  familyId: string,
  pid: string,
  callback: (entries: AllowanceEntry[]) => void
): () => void {
  const q = query(entriesCol(familyId), where("periodId", "==", pid));
  return onSnapshot(q, (snap) => {
    const entries: AllowanceEntry[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AllowanceEntry, "id">),
    }));
    // Sort: newest date first, then newest createdAt first
    entries.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const at = a.createdAt?.toMillis() ?? 0;
      const bt = b.createdAt?.toMillis() ?? 0;
      return bt - at;
    });
    callback(entries);
  });
}

export function formatKRW(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}
