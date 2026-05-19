"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  addLedgerEntry,
  deleteLedgerEntry,
  effectiveCategories,
  formatKRW,
  signedKRW,
  subscribeLedger,
  updateLedgerEntry,
  type EntryType,
  type LedgerEntry,
} from "@/lib/ledger";
import { setLedgerCategories } from "@/lib/user";
import type { UserDoc } from "@/lib/types";

type Tab = "entries" | "stats" | "categories";

export default function LedgerPage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [tab, setTab] = useState<Tab>("entries");

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

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 메인
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">내 가계부</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          🔒 비공개
        </span>
      </header>

      <nav className="mb-6 flex gap-1 rounded-lg bg-zinc-100 p-1">
        <TabButton active={tab === "entries"} onClick={() => setTab("entries")}>
          📒 내역
        </TabButton>
        <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
          📊 통계
        </TabButton>
        <TabButton
          active={tab === "categories"}
          onClick={() => setTab("categories")}
        >
          ⚙️ 카테고리
        </TabButton>
      </nav>

      {tab === "entries" && (
        <EntriesView uid={user.uid} userDoc={userDoc} entries={entries} />
      )}
      {tab === "stats" && <StatsView entries={entries} />}
      {tab === "categories" && (
        <CategoriesView uid={user.uid} userDoc={userDoc} />
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}

// ───────────────────────── Entries Tab ─────────────────────────

function EntriesView({
  uid,
  userDoc,
  entries,
}: {
  uid: string;
  userDoc: UserDoc;
  entries: LedgerEntry[];
}) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const monthPrefix = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const monthEntries = entries.filter((e) => e.date.startsWith(monthPrefix));

  const totalIncome = monthEntries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);
  const totalExpense = monthEntries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const net = totalIncome - totalExpense;

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
    <>
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
        <div className="grid grid-cols-3 divide-x divide-zinc-100 p-4 text-center">
          <div>
            <p className="text-xs text-zinc-500">수입</p>
            <p className="text-base font-bold text-green-600">
              +{formatKRW(totalIncome)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">지출</p>
            <p className="text-base font-bold text-red-500">
              −{formatKRW(totalExpense)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">차액</p>
            <p
              className={`text-base font-bold ${
                net >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {net >= 0 ? "+" : "−"}
              {formatKRW(Math.abs(net))}
            </p>
          </div>
        </div>
      </div>

      <AddEntryForm
        uid={uid}
        userDoc={userDoc}
        defaultMonth={monthPrefix}
      />

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white">
        {monthEntries.length === 0 ? (
          <p className="p-12 text-center text-sm text-zinc-400">
            이 달엔 내역이 없어요.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {monthEntries.map((e) => (
              <LedgerItem
                key={e.id}
                entry={e}
                uid={uid}
                userDoc={userDoc}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function TypeToggle({
  value,
  onChange,
}: {
  value: EntryType;
  onChange: (t: EntryType) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-zinc-200 p-1">
      <button
        type="button"
        onClick={() => onChange("expense")}
        className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
          value === "expense"
            ? "bg-white text-red-600 shadow-sm"
            : "text-zinc-600"
        }`}
      >
        − 지출
      </button>
      <button
        type="button"
        onClick={() => onChange("income")}
        className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
          value === "income"
            ? "bg-white text-green-600 shadow-sm"
            : "text-zinc-600"
        }`}
      >
        + 수입
      </button>
    </div>
  );
}

function AddEntryForm({
  uid,
  userDoc,
  defaultMonth,
}: {
  uid: string;
  userDoc: UserDoc;
  defaultMonth: string;
}) {
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const defaultDate = todayStr.startsWith(defaultMonth)
    ? todayStr
    : `${defaultMonth}-01`;

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<EntryType>("expense");
  const categories = effectiveCategories(type, userDoc);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(categories[0] ?? "기타");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cats = effectiveCategories(type, userDoc);
    setCategory(cats[0] ?? "기타");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    if (!showForm) setDate(defaultDate);
  }, [defaultDate, showForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await addLedgerEntry(uid, {
        type,
        amount: amt,
        category,
        memo: memo.trim(),
        date,
      });
      setAmount("");
      setMemo("");
      setShowForm(false);
      setType("expense");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "등록 실패";
      setError(
        msg.includes("permission") || msg.includes("Missing")
          ? "권한 오류 — Firestore 규칙 업데이트가 필요해요. (이전 안내 참고)"
          : msg
      );
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
        + 내역 추가
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
    >
      <TypeToggle value={type} onChange={setType} />
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
          {categories.map((c) => (
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
        placeholder={
          type === "income" ? "메모 (예: 5월 월급)" : "메모 (예: 마트 장보기)"
        }
        maxLength={100}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      />
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setShowForm(false);
            setAmount("");
            setMemo("");
            setType("expense");
            setError(null);
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
  userDoc,
}: {
  entry: LedgerEntry;
  uid: string;
  userDoc: UserDoc;
}) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<EntryType>(entry.type);
  const [amount, setAmount] = useState(String(entry.amount));
  const [category, setCategory] = useState(entry.category);
  const [memo, setMemo] = useState(entry.memo);
  const [date, setDate] = useState(entry.date);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryList = effectiveCategories(type, userDoc);

  useEffect(() => {
    if (editing) {
      const cats = effectiveCategories(type, userDoc);
      if (!cats.includes(category)) setCategory(cats[0] ?? "기타");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, editing]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateLedgerEntry(uid, entry.id, {
        type,
        amount: amt,
        category,
        memo: memo.trim(),
        date,
      });
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setType(entry.type);
    setAmount(String(entry.amount));
    setCategory(entry.category);
    setMemo(entry.memo);
    setDate(entry.date);
    setEditing(false);
    setError(null);
  };

  if (editing) {
    return (
      <li className="bg-zinc-50 p-3">
        <form onSubmit={handleSave} className="space-y-2">
          <TypeToggle value={type} onChange={setType} />
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
              {categoryList.map((c) => (
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
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {error}
            </p>
          )}
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

  const amountColor =
    entry.type === "income" ? "text-green-600" : "text-zinc-900";

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-12 shrink-0 text-xs text-zinc-500">
        {entry.date.slice(5).replace("-", "/")}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${amountColor}`}>
            {signedKRW(entry.type, entry.amount)}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${
              entry.type === "income"
                ? "bg-green-50 text-green-700"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
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
            if (confirm("이 내역을 삭제할까요?")) {
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

// ───────────────────────── Stats Tab ─────────────────────────

function StatsView({ entries }: { entries: LedgerEntry[] }) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());

  // Monthly totals for the year
  const monthlyData = useMemo(() => {
    const months: Array<{ month: number; income: number; expense: number }> =
      [];
    for (let m = 1; m <= 12; m++) {
      const prefix = `${year}-${String(m).padStart(2, "0")}`;
      const filtered = entries.filter((e) => e.date.startsWith(prefix));
      const income = filtered
        .filter((e) => e.type === "income")
        .reduce((s, e) => s + e.amount, 0);
      const expense = filtered
        .filter((e) => e.type === "expense")
        .reduce((s, e) => s + e.amount, 0);
      months.push({ month: m, income, expense });
    }
    return months;
  }, [entries, year]);

  const monthlyMax = Math.max(
    ...monthlyData.flatMap((d) => [d.income, d.expense]),
    1
  );

  const yearTotalIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  const yearTotalExpense = monthlyData.reduce((s, m) => s + m.expense, 0);

  // Category breakdown for current viewing year (all months)
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (e.type !== "expense") continue;
      if (!e.date.startsWith(`${year}-`)) continue;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries, year]);

  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (e.type !== "income") continue;
      if (!e.date.startsWith(`${year}-`)) continue;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries, year]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setYear(year - 1)}
          className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          ← {year - 1}
        </button>
        <h2 className="text-lg font-semibold text-zinc-900">{year}년</h2>
        <button
          onClick={() => setYear(year + 1)}
          className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          {year + 1} →
        </button>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">
          월별 수입·지출
        </h3>
        <div className="mb-4 grid grid-cols-3 divide-x divide-zinc-100 text-center">
          <div>
            <p className="text-xs text-zinc-500">연 수입</p>
            <p className="font-bold text-green-600">
              +{formatKRW(yearTotalIncome)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">연 지출</p>
            <p className="font-bold text-red-500">
              −{formatKRW(yearTotalExpense)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">연 차액</p>
            <p
              className={`font-bold ${
                yearTotalIncome - yearTotalExpense >= 0
                  ? "text-green-700"
                  : "text-red-700"
              }`}
            >
              {yearTotalIncome - yearTotalExpense >= 0 ? "+" : "−"}
              {formatKRW(Math.abs(yearTotalIncome - yearTotalExpense))}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {monthlyData.map((m) => (
            <div key={m.month} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-xs text-zinc-500">
                {m.month}월
              </span>
              <div className="flex-1 space-y-1">
                <BarRow
                  amount={m.income}
                  max={monthlyMax}
                  color="bg-green-500"
                  prefix="+"
                />
                <BarRow
                  amount={m.expense}
                  max={monthlyMax}
                  color="bg-red-400"
                  prefix="−"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">
          카테고리별 지출 ({year}년)
        </h3>
        {expenseByCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">
            지출 내역이 없어요.
          </p>
        ) : (
          <CategoryBars
            data={expenseByCategory}
            color="bg-red-400"
            sign="−"
            total={yearTotalExpense}
          />
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">
          카테고리별 수입 ({year}년)
        </h3>
        {incomeByCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">
            수입 내역이 없어요.
          </p>
        ) : (
          <CategoryBars
            data={incomeByCategory}
            color="bg-green-500"
            sign="+"
            total={yearTotalIncome}
          />
        )}
      </section>
    </div>
  );
}

function BarRow({
  amount,
  max,
  color,
  prefix,
}: {
  amount: number;
  max: number;
  color: string;
  prefix: string;
}) {
  const widthPct = max > 0 ? (amount / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded bg-zinc-100">
        <div className={`h-full ${color}`} style={{ width: `${widthPct}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-[10px] text-zinc-600 tabular-nums">
        {amount > 0 ? `${prefix}${formatKRW(amount)}` : "-"}
      </span>
    </div>
  );
}

function CategoryBars({
  data,
  color,
  sign,
  total,
}: {
  data: Array<[string, number]>;
  color: string;
  sign: string;
  total: number;
}) {
  const max = Math.max(...data.map(([, v]) => v), 1);
  return (
    <div className="space-y-2">
      {data.map(([cat, amount]) => {
        const widthPct = (amount / max) * 100;
        const sharePct = total > 0 ? (amount / total) * 100 : 0;
        return (
          <div key={cat} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-700">{cat}</span>
              <span className="text-zinc-600 tabular-nums">
                {sign}
                {formatKRW(amount)}{" "}
                <span className="text-zinc-400">({sharePct.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-zinc-100">
              <div
                className={`h-full ${color}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────── Categories Tab ─────────────────────────

function CategoriesView({
  uid,
  userDoc,
}: {
  uid: string;
  userDoc: UserDoc;
}) {
  return (
    <div className="space-y-6">
      <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        삭제해도 기존 내역의 카테고리는 그대로 유지됩니다 (드롭다운에서만
        사라짐).
      </p>
      <CategoryListEditor
        title="지출 카테고리"
        uid={uid}
        type="expense"
        categories={effectiveCategories("expense", userDoc)}
      />
      <CategoryListEditor
        title="수입 카테고리"
        uid={uid}
        type="income"
        categories={effectiveCategories("income", userDoc)}
      />
    </div>
  );
}

function CategoryListEditor({
  title,
  uid,
  type,
  categories,
}: {
  title: string;
  uid: string;
  type: EntryType;
  categories: string[];
}) {
  const [adding, setAdding] = useState("");
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = async (next: string[]) => {
    setError(null);
    try {
      await setLedgerCategories(uid, type, next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "저장 실패. 권한을 확인해주세요."
      );
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = adding.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setError("이미 같은 이름의 카테고리가 있어요.");
      return;
    }
    await save([...categories, trimmed]);
    setAdding("");
  };

  const handleDelete = async (idx: number) => {
    if (!confirm(`"${categories[idx]}" 카테고리를 삭제할까요?`)) return;
    const next = categories.filter((_, i) => i !== idx);
    await save(next);
  };

  const startRename = (idx: number) => {
    setRenamingIdx(idx);
    setRenameValue(categories[idx]);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renamingIdx === null) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    if (
      categories.some(
        (c, i) => i !== renamingIdx && c === trimmed
      )
    ) {
      setError("이미 같은 이름의 카테고리가 있어요.");
      return;
    }
    const next = categories.map((c, i) => (i === renamingIdx ? trimmed : c));
    await save(next);
    setRenamingIdx(null);
    setRenameValue("");
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-900">{title}</h3>
      <ul className="mb-3 space-y-1.5">
        {categories.map((cat, idx) => (
          <li
            key={cat + idx}
            className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2"
          >
            {renamingIdx === idx ? (
              <form onSubmit={handleRename} className="flex flex-1 gap-2">
                <input
                  type="text"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-2 py-1 text-xs text-white"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingIdx(null);
                    setRenameValue("");
                  }}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                >
                  취소
                </button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-sm text-zinc-800">{cat}</span>
                <button
                  onClick={() => startRename(idx)}
                  className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(idx)}
                  className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="새 카테고리 이름"
          maxLength={20}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!adding.trim()}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          + 추가
        </button>
      </form>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
