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

export type EntryType = "expense" | "income";

export type LedgerEntry = {
  id: string;
  type: EntryType;
  amount: number;
  category: string;
  memo: string;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
};

export const EXPENSE_CATEGORIES = [
  "식비",
  "교통",
  "취미",
  "학용품",
  "쇼핑",
  "기타",
] as const;

export const INCOME_CATEGORIES = [
  "월급",
  "부수입",
  "용돈",
  "이자",
  "기타",
] as const;

export function categoriesFor(type: EntryType): readonly string[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/** Resolve which category list to show — user-customised if present, else default. */
export function effectiveCategories(
  type: EntryType,
  userDoc: {
    ledgerExpenseCategories?: string[];
    ledgerIncomeCategories?: string[];
  } | null
): string[] {
  if (!userDoc) return [...categoriesFor(type)];
  const list =
    type === "income"
      ? userDoc.ledgerIncomeCategories
      : userDoc.ledgerExpenseCategories;
  if (list && list.length > 0) return list;
  return [...categoriesFor(type)];
}

const ledgerCol = (uid: string) => collection(db, "users", uid, "ledger");

export async function addLedgerEntry(
  uid: string,
  data: {
    type: EntryType;
    amount: number;
    category: string;
    memo: string;
    date: string;
  }
): Promise<void> {
  await addDoc(ledgerCol(uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateLedgerEntry(
  uid: string,
  entryId: string,
  data: {
    type: EntryType;
    amount: number;
    category: string;
    memo: string;
    date: string;
  }
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
    const entries: LedgerEntry[] = snap.docs.map((d) => {
      const data = d.data() as Omit<LedgerEntry, "id" | "type"> & {
        type?: EntryType;
      };
      // Default older entries (created before income support) to "expense".
      return {
        id: d.id,
        ...data,
        type: data.type ?? "expense",
      };
    });
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

export function signedKRW(type: EntryType, amount: number): string {
  const sign = type === "income" ? "+" : "−";
  return `${sign}${amount.toLocaleString("ko-KR")}원`;
}
