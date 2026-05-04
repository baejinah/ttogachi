"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  getMyLocation,
  requestLocation,
  setArrived,
  setLate,
  shareLocation,
  subscribeSafety,
  type SafetyDoc,
} from "@/lib/safety";
import { getPermission, requestPermission } from "@/lib/notifications";
import { callNotify, registerForPush } from "@/lib/fcm";
import type { Family, FamilyMember } from "@/lib/types";

export default function SafetyPage() {
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

  const childMembers = Object.entries(family.members).filter(
    ([, m]) => m.role === "child"
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 메인
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">안심 귀가</h1>
      </header>

      <NotificationBanner />

      {childMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">
            가족에 자녀 역할의 멤버가 없어요.
          </p>
        </div>
      ) : userDoc.role === "child" ? (
        <ChildSafetyCard
          familyId={userDoc.familyId}
          childUid={user.uid}
          childMember={family.members[user.uid]}
          isMe={true}
        />
      ) : (
        <div className="space-y-4">
          {childMembers.map(([uid, m]) => (
            <ChildSafetyCard
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

function ChildSafetyCard({
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
  const { user, userDoc } = useAuth();
  const isParent = userDoc?.role === "parent";

  const [safety, setSafety] = useState<SafetyDoc | null>(null);
  const [showLateForm, setShowLateForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // late form state
  const [expectedTime, setExpectedTime] = useState("23:00");
  const [message, setMessage] = useState("");

  useEffect(() => {
    return subscribeSafety(familyId, childUid, setSafety);
  }, [familyId, childUid]);

  const status = safety?.status ?? "normal";

  const handleSetLate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expectedTime) return;
    setBusy(true);
    setError(null);
    try {
      const [hh, mm] = expectedTime.split(":").map(Number);
      const expected = new Date();
      expected.setHours(hh, mm, 0, 0);
      if (expected.getTime() < Date.now()) {
        expected.setDate(expected.getDate() + 1);
      }
      await setLate(familyId, childUid, expected, message);
      void callNotify({
        type: "safety_late",
        familyId,
        childUid,
        title: `${childMember.displayName} 늦어요`,
        body: message || "오늘 늦게 들어와요",
      });
      setShowLateForm(false);
      setMessage("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  };

  const handleArrived = async () => {
    setBusy(true);
    setError(null);
    try {
      await setArrived(familyId, childUid);
      void callNotify({
        type: "safety_arrived",
        familyId,
        childUid,
        title: `${childMember.displayName} 귀가 완료`,
        body: "안전하게 도착했어요",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  };

  const handleShareLocation = async () => {
    setBusy(true);
    setError(null);
    try {
      const { lat, lng } = await getMyLocation();
      await shareLocation(familyId, childUid, lat, lng);
      void callNotify({
        type: "safety_location_shared",
        familyId,
        childUid,
        title: `${childMember.displayName} 위치 공유`,
        body: "지도에서 확인해보세요",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "위치 공유 실패");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestLocation = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await requestLocation(familyId, childUid, user.uid);
      void callNotify({
        type: "safety_location_requested",
        familyId,
        childUid,
        title: "📍 위치 요청",
        body: "부모님이 지금 어디 있는지 궁금해해요",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  };

  const expectedArrivalText = safety?.expectedArrival
    ? safety.expectedArrival.toDate().toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const arrivedAtText = safety?.arrivedAt
    ? safety.arrivedAt.toDate().toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const lastLocationTimeText = safety?.lastLocation?.timestamp
    ? safety.lastLocation.timestamp.toDate().toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const hasPendingRequest = !!safety?.locationRequest;

  return (
    <section
      className={`rounded-2xl border bg-white ${
        status === "out_late"
          ? "border-amber-300"
          : "border-zinc-200"
      }`}
    >
      <header className="flex items-center justify-between border-b border-zinc-200 p-4">
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: childMember.color }}
          />
          <div>
            <h2 className="font-semibold text-zinc-900">
              {childMember.displayName}
            </h2>
            {arrivedAtText && status === "normal" && (
              <p className="text-xs text-zinc-500">
                마지막 귀가: {arrivedAtText}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={status} />
      </header>

      {/* Out late status detail */}
      {status === "out_late" && (
        <div className="border-b border-zinc-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <span className="font-medium">예상 귀가:</span>{" "}
            {expectedArrivalText}
          </p>
          {safety?.message && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800">
              "{safety.message}"
            </p>
          )}
        </div>
      )}

      {/* Location info */}
      {safety?.lastLocation && (
        <div className="border-b border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-700">최근 공유 위치</span>
            <span className="text-xs text-zinc-500">
              {lastLocationTimeText}
            </span>
          </div>
          <a
            href={`https://www.google.com/maps?q=${safety.lastLocation.lat},${safety.lastLocation.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-sm text-blue-600 hover:underline"
          >
            지도에서 보기 ({safety.lastLocation.lat.toFixed(5)},{" "}
            {safety.lastLocation.lng.toFixed(5)})
          </a>
        </div>
      )}

      {/* Pending location request banner (visible to child) */}
      {isMe && hasPendingRequest && (
        <div className="border-b border-zinc-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">
            📍 부모님이 위치를 요청했어요
          </p>
          <button
            onClick={handleShareLocation}
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "위치 가져오는 중..." : "내 위치 보내기"}
          </button>
        </div>
      )}

      {/* Child actions */}
      {isMe && (
        <div className="space-y-2 p-4">
          {status === "normal" && !showLateForm && (
            <button
              onClick={() => setShowLateForm(true)}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-medium text-white hover:bg-amber-600"
            >
              오늘 늦어요
            </button>
          )}

          {showLateForm && (
            <form onSubmit={handleSetLate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  예상 귀가 시간
                </label>
                <input
                  type="time"
                  required
                  value={expectedTime}
                  onChange={(e) => setExpectedTime(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <textarea
                placeholder="메모 (예: 친구 생일이라 좀 늦어요)"
                rows={2}
                maxLength={150}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLateForm(false);
                    setMessage("");
                  }}
                  className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {busy ? "..." : "보내기"}
                </button>
              </div>
            </form>
          )}

          {status === "out_late" && (
            <button
              onClick={handleArrived}
              disabled={busy}
              className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy ? "..." : "✓ 귀가 완료"}
            </button>
          )}

          <button
            onClick={handleShareLocation}
            disabled={busy}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            📍 지금 위치 공유
          </button>
        </div>
      )}

      {/* Parent actions */}
      {isParent && !isMe && (
        <div className="p-4">
          <button
            onClick={handleRequestLocation}
            disabled={busy || hasPendingRequest}
            className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {hasPendingRequest
              ? "위치 요청 보냄 (응답 대기 중)"
              : "📍 지금 어디?"}
          </button>
        </div>
      )}

      {error && (
        <div className="border-t border-red-200 bg-red-50 p-3 text-center text-xs text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}

function NotificationBanner() {
  const [perm, setPerm] = useState<ReturnType<typeof getPermission>>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPerm(getPermission());
  }, []);

  if (perm === "granted" || perm === "denied" || perm === "unsupported") {
    return null;
  }

  const handleAllow = async () => {
    setBusy(true);
    try {
      const result = await requestPermission();
      setPerm(result);
      if (result === "granted") {
        // Best-effort FCM registration; works on most browsers,
        // may return null on iOS without PWA install
        await registerForPush().catch(() => null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="text-sm text-blue-900">
        <p className="font-medium">🔔 알림 켜기</p>
        <p className="text-xs text-blue-700">
          앱이 닫혀있어도 가족 상태 변화를 알림으로 받습니다.
        </p>
      </div>
      <button
        onClick={handleAllow}
        disabled={busy}
        className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "..." : "허용"}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: "normal" | "out_late" }) {
  if (status === "out_late") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
        늦어요
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
      평상시
    </span>
  );
}
