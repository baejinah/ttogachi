"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function OnboardingPage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (userDoc?.familyId) {
      router.replace("/");
    }
  }, [loading, user, userDoc, router]);

  if (loading || !user || userDoc?.familyId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">시작하기</h1>
          <p className="mt-1 text-sm text-zinc-500">
            가족을 새로 만들거나, 받은 초대 코드로 합류해주세요.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/family/create"
            className="rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800"
          >
            가족 새로 만들기
          </Link>
          <Link
            href="/family/join"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            초대 코드로 합류하기
          </Link>
        </div>
      </div>
    </div>
  );
}
