"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { joinFamily } from "@/lib/family";
import { MEMBER_COLORS, type Role } from "@/lib/types";

export default function JoinFamilyPage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [role, setRole] = useState<Role>("child");
  const [color, setColor] = useState<string>(MEMBER_COLORS[2].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await joinFamily({
        uid: user.uid,
        displayName: userDoc.displayName,
        inviteCode: code,
        role,
        color,
      });
      router.replace("/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "합류에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-bold text-zinc-900">가족에 합류</h1>
          <p className="mt-1 text-sm text-zinc-500">
            받은 초대 코드와 내 역할을 입력해주세요.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            초대 코드
          </label>
          <input
            type="text"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: ABC234"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-zinc-500 focus:outline-none"
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
            내 색상
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
          disabled={submitting || code.length !== 6}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? "합류 중..." : "합류하기"}
        </button>
      </form>
    </div>
  );
}
