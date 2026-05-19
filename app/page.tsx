"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Family } from "@/lib/types";

export default function Home() {
  const { user, userDoc, loading, logout } = useAuth();
  const router = useRouter();
  const [family, setFamily] = useState<Family | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (userDoc && !userDoc.familyId) {
      router.replace("/onboarding");
    }
  }, [loading, user, userDoc, router]);

  useEffect(() => {
    if (!userDoc?.familyId) {
      setFamily(null);
      return;
    }
    return onSnapshot(doc(db, "families", userDoc.familyId), (snap) => {
      if (snap.exists()) {
        setFamily({ id: snap.id, ...(snap.data() as Omit<Family, "id">) });
      }
    });
  }, [userDoc?.familyId]);

  if (loading || !user || !userDoc || !userDoc.familyId || !family) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-400">불러오는 중...</p>
      </div>
    );
  }

  const memberEntries = Object.entries(family.members);
  const isParent = userDoc.role === "parent";

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            가족
          </p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-zinc-900">
            {family.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {userDoc.displayName}님 · {isParent ? "부모" : "자녀"}
          </p>
        </div>
        <button
          onClick={() => logout()}
          className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
        >
          로그아웃
        </button>
      </header>

      <section className="mb-8 rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">가족 구성원</h2>
          <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] text-zinc-600">
            초대 코드{" "}
            <span className="ml-1 font-mono text-xs font-bold text-zinc-900">
              {family.inviteCode}
            </span>
          </div>
        </div>
        <ul className="space-y-3.5">
          {memberEntries.map(([uid, m]) => (
            <li key={uid} className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: m.color }}
              >
                {m.displayName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900">
                  {m.displayName}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {m.role === "parent" ? "부모" : "자녀"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <FeatureCard
          href="/board"
          emoji="📝"
          title="가족 게시판"
          desc="공지·중요 정보 보관"
        />
        <FeatureCard
          href="/calendar"
          emoji="📅"
          title="가족 캘린더"
          desc="시험·출장·행사 한눈에"
        />
        <FeatureCard
          href="/allowance"
          emoji="💰"
          title="용돈 기입장"
          desc="자녀 지출 → 부모 확인"
        />
        <FeatureCard
          href="/safety"
          emoji="🏠"
          title="안심 귀가"
          desc="늦는 시간·귀가 상태 공유"
        />
        {isParent && (
          <FeatureCard
            href="/ledger"
            emoji="🔒"
            title="내 가계부"
            desc="비공개 — 나만 봐요"
          />
        )}
      </section>
    </main>
  );
}

function FeatureCard({
  href,
  emoji,
  title,
  desc,
  hint,
}: {
  href?: string;
  emoji?: string;
  title: string;
  desc: string;
  hint?: string;
}) {
  const inner = (
    <>
      <div className="mb-3 flex items-start justify-between">
        {emoji && <span className="text-xl">{emoji}</span>}
        {hint && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
            {hint}
          </span>
        )}
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">
        {title}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">{desc}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group rounded-[22px] border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-[22px] border border-zinc-200/70 bg-white p-5 opacity-50">
      {inner}
    </div>
  );
}
