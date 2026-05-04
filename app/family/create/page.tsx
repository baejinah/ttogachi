"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createFamily } from "@/lib/family";
import { MEMBER_COLORS, type Role } from "@/lib/types";

export default function CreateFamilyPage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();
  const [familyName, setFamilyName] = useState("");
  const [role, setRole] = useState<Role>("parent");
  const [color, setColor] = useState<string>(MEMBER_COLORS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (userDoc?.familyId) router.replace("/");
  }, [loading, user, userDoc, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userDoc) return;
    setSubmitting(true);
    setError(null);
    try {
      const { inviteCode } = await createFamily({
        uid: user.uid,
        displayName: userDoc.displayName,
        familyName: familyName.trim(),
        role,
        color,
      });
      setCreatedCode(inviteCode);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "가족 생성에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">가족 생성 완료!</h1>
            <p className="mt-1 text-sm text-zinc-500">
              아래 초대 코드를 다른 가족에게 공유해주세요.
            </p>
          </div>
          <div className="rounded-xl bg-zinc-100 p-6 text-center">
            <p className="font-mono text-3xl font-bold tracking-widest text-zinc-900">
              {createdCode}
            </p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(createdCode)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            코드 복사
          </button>
          <button
            onClick={() => router.replace("/")}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
          >
            메인으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-bold text-zinc-900">가족 만들기</h1>
          <p className="mt-1 text-sm text-zinc-500">
            가족 이름과 내 역할을 정해주세요.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            가족 이름
          </label>
          <input
            type="text"
            required
            maxLength={20}
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="예: 우리 가족"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            내 역할
          </label>
          <div className="flex gap-2">
            {(["parent", "child"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${
                  role === r
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {r === "parent" ? "부모" : "자녀"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            내 색상 (캘린더 표시용)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {MEMBER_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                aria-label={c.name}
                className={`h-9 rounded-lg border-2 transition ${
                  color === c.value ? "border-zinc-900" : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !familyName.trim()}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? "생성 중..." : "가족 만들기"}
        </button>
      </form>
    </div>
  );
}
