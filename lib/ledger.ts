import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type LedgerEntry = {
  id: string;
  amount: number;
  category: string;
  memo: string;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
};

export const LEDGER_CATEGORIES = [
  "식비",
  "교통",
  "취미",
  "학용품",
  "쇼핑",
  "기타",
] as const;

const ledgerCol = (uid: string) => collection(db, "users", uid, "ledger");

export async function addLedgerEntry(
  uid: string,
  data: { amount: number; category: string; memo: string; date: string }
): Promise<void> {
  await addDoc(ledgerCol(uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateLedgerEntry(
  uid: string,
  entryId: string,
  data: { amount: number; category: string; memo: string; date: string }
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "ledger", entryId), data);
}

export async function deleteLedgerEntry(
  uid: string,
  entryId: string
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "ledger", entryId));
}

export function subscribeLedger(
  uid: string,
  callback: (entries: LedgerEntry[]) => void
): () => void {
  return onSnapshot(ledgerCol(uid), (snap) => {
    const entries: LedgerEntry[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<LedgerEntry, "id">),
    }));
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
