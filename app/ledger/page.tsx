"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  addLedgerEntry,
  deleteLedgerEntry,
  formatKRW,
  LEDGER_CATEGORIES,
  subscribeLedger,
  updateLedgerEntry,
  type LedgerEntry,
} from "@/lib/ledger";

export default function LedgerPage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-12

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (userDoc && userDoc.role !== "parent") router.replace("/");
  }, [loading, user, userDoc, router]);

  useEffect(() => {
    if (!user) return;
    return subscribeLedger(user.uid, setEntries);
  }, [user]);

  if (loading || !user || !userDoc || userDoc.role !== "parent") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  const monthPrefix = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const monthEntries = entries.filter((e) => e.date.startsWith(monthPrefix));
  const total = monthEntries.reduce((sum, e) => sum + e.amount, 0);

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 메인
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">내 가계부</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          🔒 비공개
        </span>
      </header>

      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 p-3">
          <button
            onClick={goPrevMonth}
            className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            ← 이전
          </button>
          <h2 className="font-semibold text-zinc-900">
            {viewYear}년 {viewMonth}월
          </h2>
          <button
            onClick={goNextMonth}
            className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            다음 →
          </button>
        </div>
        <div className="flex items-baseline justify-between p-4">
          <span className="text-sm text-zinc-500">이번 달 지출 합계</span>
          <span className="text-2xl font-bold text-zinc-900">
            {formatKRW(total)}
          </span>
        </div>
      </div>

      <AddEntryForm uid={user.uid} defaultMonth={monthPrefix} />

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white">
        {monthEntries.length === 0 ? (
          <p className="p-12 text-center text-sm text-zinc-400">
            이 달엔 지출 내역이 없어요.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {monthEntries.map((e) => (
              <LedgerItem key={e.id} entry={e} uid={user.uid} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function AddEntryForm({
  uid,
  defaultMonth,
}: {
  uid: string;
  defaultMonth: string; // YYYY-MM
}) {
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // If user is viewing a non-current month, default the date input to 1st of that month
  const defaultDate = todayStr.startsWith(defaultMonth)
    ? todayStr
    : `${defaultMonth}-01`;

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(LEDGER_CATEGORIES[0]);
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [submitting, setSubmitting] = useState(false);

  // Keep date input default in sync if the month changes while the form is closed.
  useEffect(() => {
    if (!showForm) setDate(defaultDate);
  }, [defaultDate, showForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    try {
      await addLedgerEntry(uid, {
        amount: amt,
        category,
        memo: memo.trim(),
        date,
      });
      setAmount("");
      setMemo("");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full rounded-lg border border-dashed border-zinc-300 bg-white py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
      >
        + 지출 추가
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
    >
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="금액"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <span className="self-center text-sm text-zinc-500">원</span>
      </div>
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          {LEDGER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <input
        type="text"
        placeholder="메모 (예: 마트 장보기)"
        maxLength={100}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setShowForm(false);
            setAmount("");
            setMemo("");
          }}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting || !amount}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? "등록 중..." : "등록"}
        </button>
      </div>
    </form>
  );
}

function LedgerItem({
  entry,
  uid,
}: {
  entry: LedgerEntry;
  uid: string;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(entry.amount));
  const [category, setCategory] = useState(entry.category);
  const [memo, setMemo] = useState(entry.memo);
  const [date, setDate] = useState(entry.date);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    try {
      await updateLedgerEntry(uid, entry.id, {
        amount: amt,
        category,
        memo: memo.trim(),
        date,
      });
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setAmount(String(entry.amount));
    setCategory(entry.category);
    setMemo(entry.memo);
    setDate(entry.date);
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="bg-zinc-50 p-3">
        <form onSubmit={handleSave} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              required
              value={amount}
              onChange={(ev) =>
                setAmount(ev.target.value.replace(/[^0-9]/g, ""))
              }
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <span className="self-center text-sm text-zinc-500">원</span>
          </div>
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(ev) => setCategory(ev.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            >
              {LEDGER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(ev) => setDate(ev.target.value)}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <input
            type="text"
            placeholder="메모"
            maxLength={100}
            value={memo}
            onChange={(ev) => setMemo(ev.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !amount}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-12 shrink-0 text-xs text-zinc-500">
        {entry.date.slice(5).replace("-", "/")}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-900">
            {formatKRW(entry.amount)}
          </span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
            {entry.category}
          </span>
        </div>
        {entry.memo && (
          <p className="mt-0.5 text-xs text-zinc-500">{entry.memo}</p>
        )}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => setEditing(true)}
          className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
        >
          수정
        </button>
        <button
          onClick={() => {
            if (confirm("이 지출을 삭제할까요?")) {
              void deleteLedgerEntry(uid, entry.id);
            }
          }}
          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
        >
          삭제
        </button>
      </div>
    </li>
  );
}
