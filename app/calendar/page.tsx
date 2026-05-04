"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  createEvent,
  deleteEvent,
  getMonthGrid,
  setEventGoogleId,
  subscribeEvents,
  ymd,
  type CalendarEvent,
} from "@/lib/calendar";
import {
  convertGoogleEvent,
  createGoogleEvent,
  deleteGoogleEvent,
  ensureTtogachiCalendar,
  getStoredToken,
  listCalendarEvents,
  requestCalendarAccess,
} from "@/lib/google-calendar";
import { setGoogleCalendarId } from "@/lib/user";
import type { Family } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Toast = { kind: "info" | "error" | "success"; msg: string };

export default function CalendarPage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(ymd(today));

  const [family, setFamily] = useState<Family | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Google sync
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

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

  useEffect(() => {
    if (!userDoc?.familyId) return;
    return subscribeEvents(userDoc.familyId, (evts) => {
      setEvents(evts);
      setEventsLoaded(true);
    });
  }, [userDoc?.familyId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const grid = useMemo(() => getMonthGrid(year, monthIndex), [year, monthIndex]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (!a.time && b.time) return -1;
        if (a.time && !b.time) return 1;
        return a.time.localeCompare(b.time);
      });
    }
    return map;
  }, [events]);

  const dayEvents = eventsByDate.get(selectedDate) ?? [];
  const todayYmd = ymd(today);

  const goPrevMonth = () => {
    if (monthIndex === 0) {
      setYear(year - 1);
      setMonthIndex(11);
    } else {
      setMonthIndex(monthIndex - 1);
    }
  };
  const goNextMonth = () => {
    if (monthIndex === 11) {
      setYear(year + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex(monthIndex + 1);
    }
  };

  const syncFromGoogle = async (manual = false) => {
    if (
      !user ||
      !userDoc?.familyId ||
      !userDoc.googleCalendarId ||
      !family ||
      !eventsLoaded
    ) {
      return;
    }
    const me = family.members[user.uid];
    if (!me) return;

    setSyncing(true);
    try {
      if (!getStoredToken()) await requestCalendarAccess();

      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      const end = new Date();
      end.setMonth(end.getMonth() + 6);

      const googleEvents = await listCalendarEvents(
        userDoc.googleCalendarId,
        start.toISOString(),
        end.toISOString()
      );

      const existingIds = new Set(
        events.filter((e) => e.googleEventId).map((e) => e.googleEventId)
      );

      let imported = 0;
      for (const ge of googleEvents) {
        if (ge.status === "cancelled") continue;
        if (existingIds.has(ge.id)) continue;

        const converted = convertGoogleEvent(ge);
        const eventId = await createEvent(userDoc.familyId, {
          ...converted,
          authorUid: user.uid,
          authorName: me.displayName,
          authorColor: me.color,
        });
        await setEventGoogleId(userDoc.familyId, eventId, ge.id);
        imported++;
      }

      if (manual || imported > 0) {
        setToast({
          kind: "success",
          msg:
            imported > 0
              ? `Google에서 ${imported}개 가져왔어요`
              : "이미 모두 동기화되어 있어요",
        });
      }
    } catch (err) {
      console.warn("Sync from Google failed:", err);
      setToast({ kind: "error", msg: "Google에서 가져오기 실패" });
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync on mount when connected
  useEffect(() => {
    if (!userDoc?.googleCalendarId || !eventsLoaded || !family) return;
    void syncFromGoogle(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDoc?.googleCalendarId, eventsLoaded, family?.id]);

  const handleConnectGoogle = async () => {
    if (!user) return;
    setConnecting(true);
    try {
      await requestCalendarAccess();
      const calId = await ensureTtogachiCalendar();
      await setGoogleCalendarId(user.uid, calId);
      setToast({ kind: "success", msg: "Google 캘린더 연동 완료!" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "연동 실패";
      setToast({ kind: "error", msg });
    } finally {
      setConnecting(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userDoc?.familyId || !family) return;
    const me = family.members[user.uid];
    if (!me) return;
    setSubmitting(true);
    try {
      const eventData = {
        title: title.trim(),
        date: selectedDate,
        time,
        memo: memo.trim(),
        authorUid: user.uid,
        authorName: me.displayName,
        authorColor: me.color,
      };
      const eventId = await createEvent(userDoc.familyId, eventData);

      // Sync to Google (best-effort, non-blocking failure)
      if (userDoc.googleCalendarId) {
        try {
          if (!getStoredToken()) await requestCalendarAccess();
          const googleId = await createGoogleEvent(
            userDoc.googleCalendarId,
            eventData
          );
          await setEventGoogleId(userDoc.familyId, eventId, googleId);
        } catch (err) {
          console.warn("Google sync failed:", err);
          setToast({
            kind: "error",
            msg: "앱엔 등록됐지만 Google 캘린더 동기화 실패",
          });
        }
      }

      setTitle("");
      setTime("");
      setMemo("");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (ev: CalendarEvent) => {
    if (!userDoc?.familyId) return;
    if (!confirm("이 일정을 삭제할까요?")) return;
    await deleteEvent(userDoc.familyId, ev.id);

    if (userDoc.googleCalendarId && ev.googleEventId) {
      try {
        if (!getStoredToken()) await requestCalendarAccess();
        await deleteGoogleEvent(userDoc.googleCalendarId, ev.googleEventId);
      } catch (err) {
        console.warn("Google delete failed:", err);
        setToast({
          kind: "error",
          msg: "앱에선 삭제됐지만 Google 캘린더에 남음",
        });
      }
    }
  };

  if (loading || !user || !userDoc || !userDoc.familyId || !family) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  const isConnected = !!userDoc.googleCalendarId;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← 메인
          </Link>
          <h1 className="text-xl font-bold text-zinc-900">가족 캘린더</h1>
        </div>
      </header>

      {/* Google Calendar 연동 배너 */}
      {!isConnected && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm text-blue-900">
            <p className="font-medium">Google 캘린더와 연동하세요</p>
            <p className="text-xs text-blue-700">
              일정이 본인 Google 캘린더의 "따로또같이" 캘린더에 자동 추가됩니다.
            </p>
          </div>
          <button
            onClick={handleConnectGoogle}
            disabled={connecting}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {connecting ? "연동 중..." : "연동하기"}
          </button>
        </div>
      )}

      {isConnected && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
          <span className="flex items-center gap-2">
            <span>✓</span>
            <span>Google 캘린더 연동됨 (새 일정은 자동 동기화)</span>
          </span>
          <button
            onClick={() => syncFromGoogle(true)}
            disabled={syncing}
            className="rounded bg-white px-2 py-1 text-xs text-green-700 hover:bg-green-100 disabled:opacity-50"
          >
            {syncing ? "동기화 중..." : "🔄 새로고침"}
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            toast.kind === "success"
              ? "bg-green-100 text-green-800"
              : toast.kind === "error"
                ? "bg-red-100 text-red-800"
                : "bg-zinc-100 text-zinc-800"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={goPrevMonth}
          className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          ← 이전
        </button>
        <h2 className="text-lg font-semibold text-zinc-900">
          {year}년 {monthIndex + 1}월
        </h2>
        <button
          onClick={goNextMonth}
          className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          다음 →
        </button>
      </div>

      {/* Weekday header */}
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((date, i) => {
          const dateStr = ymd(date);
          const isCurrentMonth = date.getMonth() === monthIndex;
          const isToday = dateStr === todayYmd;
          const isSelected = dateStr === selectedDate;
          const cellEvents = eventsByDate.get(dateStr) ?? [];
          const dayOfWeek = i % 7;
          const dayNumColor = !isCurrentMonth
            ? "text-zinc-300"
            : dayOfWeek === 0
              ? "text-red-500"
              : dayOfWeek === 6
                ? "text-blue-500"
                : "text-zinc-900";

          return (
            <button
              key={dateStr + i}
              onClick={() => {
                setSelectedDate(dateStr);
                setShowForm(false);
              }}
              className={`flex aspect-square flex-col items-center gap-1 rounded-lg border p-1.5 text-left transition ${
                isSelected
                  ? "border-zinc-900 bg-zinc-50"
                  : "border-transparent hover:border-zinc-200"
              }`}
            >
              <span
                className={`text-xs font-medium ${dayNumColor} ${
                  isToday
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white"
                    : ""
                }`}
              >
                {date.getDate()}
              </span>
              {cellEvents.length > 0 && (
                <div className="flex w-full flex-wrap items-center gap-0.5">
                  {cellEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: ev.authorColor }}
                    />
                  ))}
                  {cellEvents.length > 3 && (
                    <span className="text-[9px] text-zinc-500">
                      +{cellEvents.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">
            {selectedDate.replace(/-/g, ".")} 일정
          </h3>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              + 추가
            </button>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleAddEvent}
            className="mb-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
          >
            <input
              type="text"
              placeholder="제목 (예: 시험, 출장, 가족 모임)"
              required
              maxLength={60}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
              <span className="self-center text-xs text-zinc-500">
                (시간 비우면 종일)
              </span>
            </div>
            <textarea
              placeholder="메모 (선택)"
              maxLength={500}
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setTitle("");
                  setTime("");
                  setMemo("");
                }}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {submitting ? "등록 중..." : "등록"}
              </button>
            </div>
          </form>
        )}

        {dayEvents.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">
            등록된 일정이 없어요.
          </p>
        ) : (
          <ul className="space-y-2">
            {dayEvents.map((ev) => (
              <li
                key={ev.id}
                className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3"
              >
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: ev.authorColor }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">
                      {ev.title}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {ev.time || "종일"}
                    </span>
                    {ev.googleEventId && (
                      <span
                        className="text-[10px] text-blue-500"
                        title="Google 캘린더 동기화됨"
                      >
                        ⓖ
                      </span>
                    )}
                  </div>
                  {ev.memo && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">
                      {ev.memo}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400">{ev.authorName}</p>
                </div>
                {ev.authorUid === user.uid && (
                  <button
                    onClick={() => handleDeleteEvent(ev)}
                    className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                  >
                    삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
