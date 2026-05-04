"use client";

import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  const handleGoogle = async () => {
    setError(null);
    setSigning(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "로그인 실패");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">따로또같이</h1>
          <p className="mt-2 text-sm text-zinc-500">분거가족 통합 관리</p>
        </div>
        <button
          onClick={handleGoogle}
          disabled={signing}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          {signing ? "로그인 중..." : "Google 계정으로 시작하기"}
        </button>
        {error && <p className="text-center text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
