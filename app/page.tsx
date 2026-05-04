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
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  const memberEntries = Object.entries(family.members);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{family.name}</h1>
          <p className="text-sm text-zinc-500">
            {userDoc.displayName}님 ({userDoc.role === "parent" ? "부모" : "자녀"})
          </p>
        </div>
        <button
          onClick={() => logout()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          로그아웃
        </button>
      </header>

      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">가족 구성원</h2>
          <span className="text-xs text-zinc-500">
            초대 코드: <span className="font-mono font-bold">{family.inviteCode}</span>
          </span>
        </div>
        <ul className="space-y-2">
          {memberEntries.map(([uid, m]) => (
            <li key={uid} className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              <span className="font-medium text-zinc-900">{m.displayName}</span>
              <span className="text-xs text-zinc-500">
                {m.role === "parent" ? "부모" : "자녀"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <FeatureCard
          href="/board"
          title="가족 게시판"
          desc="공지·중요 정보 고정 보관"
        />
        <FeatureCard
          href="/calendar"
          title="가족 캘린더"
          desc="시험·출장·행사 한눈에"
        />
        <FeatureCard
          href="/allowance"
          title="용돈 기입장"
          desc="자녀 지출 → 부모 확인"
        />
        <FeatureCard
          href="/safety"
          title="안심 귀가"
          desc="늦는 시간·귀가 상태 공유"
        />
      </section>
    </main>
  );
}

function FeatureCard({
  href,
  title,
  desc,
  hint,
}: {
  href?: string;
  title: string;
  desc: string;
  hint?: string;
}) {
  const inner = (
    <>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900">{title}</h3>
        {hint && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
            {hint}
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-500">{desc}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 hover:shadow-sm"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 opacity-60">
      {inner}
    </div>
  );
}
