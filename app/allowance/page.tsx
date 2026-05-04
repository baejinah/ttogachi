"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  addEntry,
  CATEGORIES,
  currentPeriodId,
  deleteEntry,
  formatKRW,
  payPeriod,
  submitPeriod,
  subscribeEntries,
  subscribePeriod,
  updateEntry,
  type AllowanceEntry,
  type AllowancePeriod,
} from "@/lib/allowance";
import type { Family, FamilyMember } from "@/lib/types";

export default function AllowancePage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();
  const [family, setFamily] = useState<Family | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (userDoc && !userDoc.familyId) router.replace("/onboarding");
  }, [loading, user, userDoc, router]);

  useEffect(() => {
    if (!userDoc?.familyId) return;
    return onSnapshot(doc(db, "families", userDoc.familyId), (snap) => {
      if (snap.exists()) {
        setFamily({ id: snap.id, ...(snap.data() as Omit<Family, "id">) });
      }
    });
  }, [userDoc?.familyId]);

  if (loading || !user || !userDoc || !userDoc.familyId || !family) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  const myRole = userDoc.role;
  const childMembers = Object.entries(family.members).filter(
    ([, m]) => m.role === "child"
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 메인
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">용돈 기입장</h1>
      </header>

      {childMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">
            가족에 자녀 역할의 멤버가 없어요.
          </p>
        </div>
      ) : myRole === "child" ? (
        <ChildSection
          familyId={userDoc.familyId}
          childUid={user.uid}
          childMember={family.members[user.uid]}
          isMe={true}
        />
      ) : (
        <div className="space-y-6">
          {childMembers.map(([uid, m]) => (
            <ChildSection
              key={uid}
              familyId={userDoc.familyId!}
              childUid={uid}
              childMember={m}
              isMe={uid === user.uid}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ChildSection({
  familyId,
  childUid,
  childMember,
  isMe,
}: {
  familyId: string;
  childUid: string;
  childMember: FamilyMember;
  isMe: boolean;
}) {
  const { userDoc } = useAuth();
  const isParent = userDoc?.role === "parent";

  const pid = useMemo(() => currentPeriodId(childUid), [childUid]);
  const [period, setPeriod] = useState<AllowancePeriod | null>(null);
  const [entries, setEntries] = useState<AllowanceEntry[]>([]);

  useEffect(() => {
    return subscribePeriod(familyId, pid, setPeriod);
  }, [familyId, pid]);

  useEffect(() => {
    return subscribeEntries(familyId, pid, setEntries);
  }, [familyId, pid]);

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  const now = new Date();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  const status: "open" | "submitted" | "paid" = period?.status ?? "open";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 p-4">
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: childMember.color }}
          />
          <div>
            <h2 className="font-semibold text-zinc-900">
              {childMember.displayName}의 용돈
            </h2>
            <p className="text-xs text-zinc-500">{monthLabel}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="border-b border-zinc-200 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-zinc-500">이번 달 합계</span>
          <span className="text-2xl font-bold text-zinc-900">
            {formatKRW(total)}
          </span>
        </div>
      </div>

      {/* 자녀: 입력 폼 (지급 완료 전까진 작성·편집 가능) */}
      {isMe && status !== "paid" && (
        <ChildAddForm familyId={familyId} childUid={childUid} />
      )}

      {/* 지출 목록 */}
      <EntriesList
        entries={entries}
        familyId={familyId}
        canEdit={isMe && status !== "paid"}
      />

      {/* 자녀: 마감 버튼 */}
      {isMe && status === "open" && entries.length > 0 && (
        <div className="border-t border-zinc-200 p-4">
          <button
            onClick={async () => {
              if (
                !confirm(
                  "이번 달 용돈 정리를 마감할까요? 마감 후엔 지출 추가/수정이 불가능합니다."
                )
              )
                return;
              await submitPeriod(familyId, pid);
            }}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
          >
            이번 달 마감 (부모님께 제출)
          </button>
        </div>
      )}

      {/* 부모: 지급 처리 폼 */}
      {isParent && status === "submitted" && period && (
        <ParentPayForm
          familyId={familyId}
          pid={pid}
          total={total}
          periodYear={period.year}
          periodMonth={period.month}
        />
      )}

      {/* 자녀: 제출 후 대기 */}
      {isMe && status === "submitted" && (
        <div className="border-t border-zinc-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
          <p>부모님 확인 대기 중...</p>
          <p className="mt-1 text-xs text-amber-700">
            지급 전까진 추가·수정 가능해요. 바뀐 내용은 부모님께 실시간으로 보입니다.
          </p>
        </div>
      )}

      {/* 지급 완료 표시 (모두에게) */}
      {status === "paid" && period && (
        <div className="border-t border-zinc-200 bg-green-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-green-800">
              ✓ 지급 완료
            </span>
            <span className="font-bold text-green-900">
              {formatKRW(period.paidAmount ?? 0)}
            </span>
          </div>
          {period.parentFeedback && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-green-700">
              "{period.parentFeedback}"
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: "open" | "submitted" | "paid" }) {
  const map = {
    open: { text: "작성 중", cls: "bg-zinc-100 text-zinc-700" },
    submitted: { text: "확인 대기", cls: "bg-amber-100 text-amber-800" },
    paid: { text: "지급 완료", cls: "bg-green-100 text-green-800" },
  } as const;
  const { text, cls } = map[status];
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>
      {text}
    </span>
  );
}

function ChildAddForm({
  familyId,
  childUid,
}: {
  familyId: string;
  childUid: string;
}) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    try {
      await addEntry(familyId, {
        childUid,
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
      <div className="border-b border-zinc-200 p-4">
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-lg border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          + 지출 추가
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 border-b border-zinc-200 bg-zinc-50 p-4"
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
          {CATEGORIES.map((c) => (
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
        placeholder="메모 (예: 친구랑 분식)"
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

function EntriesList({
  entries,
  familyId,
  canEdit,
}: {
  entries: AllowanceEntry[];
  familyId: string;
  canEdit: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="border-b border-zinc-200 p-6 text-center text-sm text-zinc-400">
        지출 내역이 없어요.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100">
      {entries.map((e) => (
        <EntryItem key={e.id} entry={e} familyId={familyId} canEdit={canEdit} />
      ))}
    </ul>
  );
}

function EntryItem({
  entry,
  familyId,
  canEdit,
}: {
  entry: AllowanceEntry;
  familyId: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(entry.amount));
  const [category, setCategory] = useState(entry.category);
  const [memo, setMemo] = useState(entry.memo);
  const [date, setDate] = useState(entry.date);
  const [submitting, setSubmitting] = useState(false);

  // Restrict date editing to the same month as the entry's current period,
  // so the entry doesn't accidentally jump to another period.
  const [yearStr, monthStr] = entry.date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  const minDate = `${yearStr}-${monthStr}-01`;
  const maxDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    try {
      await updateEntry(familyId, entry.id, {
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
              onChange={(ev) => setAmount(ev.target.value.replace(/[^0-9]/g, ""))}
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
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
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
      {canEdit && (
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
                void deleteEntry(familyId, entry.id);
              }
            }}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          >
            삭제
          </button>
        </div>
      )}
    </li>
  );
}

function ParentPayForm({
  familyId,
  pid,
  total,
  periodYear,
  periodMonth,
}: {
  familyId: string;
  pid: string;
  total: number;
  periodYear: number;
  periodMonth: number;
}) {
  const [paidAmount, setPaidAmount] = useState(String(total));
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Earliest payable date: 1st of the month following the period.
  // periodMonth is 1-indexed; JS Date uses 0-indexed month, so
  // new Date(year, periodMonth, 1) = (periodMonth+1)th month, 1st day.
  const earliestPay = new Date(periodYear, periodMonth, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isLocked = today < earliestPay;

  if (isLocked) {
    const formatted = earliestPay.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return (
      <div className="border-t border-zinc-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
        <p className="font-medium">⏰ 지급 대기 중</p>
        <p className="mt-1 text-xs text-amber-700">
          {formatted}부터 지급 처리할 수 있어요.
        </p>
      </div>
    );
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(paidAmount.replace(/[^0-9]/g, ""), 10);
    if (!amt || amt < 0) return;
    if (
      !confirm(
        `${formatKRW(amt)} 지급을 확정합니다. 외부 송금(카카오페이 등)은 이미 보내셨나요?`
      )
    )
      return;
    setSubmitting(true);
    try {
      await payPeriod(familyId, pid, amt, feedback.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handlePay}
      className="space-y-3 border-t border-zinc-200 bg-amber-50 p-4"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-amber-900">
          지급 금액
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={paidAmount}
            onChange={(e) =>
              setPaidAmount(e.target.value.replace(/[^0-9]/g, ""))
            }
            className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          />
          <span className="self-center text-sm text-amber-800">원</span>
        </div>
        <p className="mt-1 text-xs text-amber-700">
          (지출 합계: {formatKRW(total)})
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-amber-900">
          한 줄 피드백 (선택)
        </label>
        <textarea
          rows={2}
          maxLength={200}
          placeholder="예: 이번 달 잘 정리했네 :)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full resize-none rounded-md border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {submitting ? "처리 중..." : "지급 처리하기"}
      </button>
      <p className="text-center text-xs text-amber-700">
        (실제 송금은 카카오페이 등 외부 앱으로)
      </p>
    </form>
  );
}
