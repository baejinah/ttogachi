import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "./firebase";
import { ymd } from "./calendar";

const TOKEN_KEY = "google_calendar_token";
const CALENDAR_NAME = "따로또같이";
const SCOPE = "https://www.googleapis.com/auth/calendar";

/**
 * Trigger Google sign-in popup with Calendar scope.
 * Stores the access token in sessionStorage. Returns the token.
 * If user is already signed in, uses reauthenticateWithPopup so the same
 * Firebase user identity is preserved.
 */
export async function requestCalendarAccess(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.addScope(SCOPE);

  const result = auth.currentUser
    ? await reauthenticateWithPopup(auth.currentUser, provider)
    : await signInWithPopup(auth, provider);

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  if (!token) throw new Error("Google 캘린더 접근 토큰을 받지 못했어요.");
  sessionStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** Wrapper for fetch that auto-reauths on 401 (token expired). */
async function callApi(
  url: string,
  init: RequestInit,
  retried = false
): Promise<Response> {
  const token = getStoredToken();
  if (!token) {
    throw new Error("NO_TOKEN");
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401 && !retried) {
    clearStoredToken();
    await requestCalendarAccess();
    return callApi(url, init, true);
  }
  return res;
}

/**
 * Find or create the "따로또같이" calendar in user's Google account.
 * Returns the calendar ID.
 */
export async function ensureTtogachiCalendar(): Promise<string> {
  const listRes = await callApi(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=owner",
    { method: "GET" }
  );
  if (!listRes.ok) {
    throw new Error(`캘린더 목록 조회 실패: ${listRes.status}`);
  }
  const list = (await listRes.json()) as {
    items?: Array<{ id: string; summary: string }>;
  };
  const existing = list.items?.find((c) => c.summary === CALENDAR_NAME);
  if (existing) return existing.id;

  const createRes = await callApi(
    "https://www.googleapis.com/calendar/v3/calendars",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: CALENDAR_NAME,
        description: "따로또같이 가족 앱에서 동기화된 일정",
        timeZone: "Asia/Seoul",
      }),
    }
  );
  if (!createRes.ok) {
    throw new Error(`캘린더 생성 실패: ${createRes.status}`);
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

/** Build Google Calendar event body from our event data. */
function buildEventBody(data: {
  title: string;
  date: string;
  time: string;
  memo: string;
}) {
  const isAllDay = !data.time;
  const body: Record<string, unknown> = {
    summary: data.title,
  };
  if (data.memo) body.description = data.memo;

  if (isAllDay) {
    const startDate = new Date(`${data.date}T00:00:00`);
    const next = new Date(startDate);
    next.setDate(next.getDate() + 1);
    body.start = { date: data.date };
    body.end = { date: ymd(next) };
  } else {
    const start = `${data.date}T${data.time}:00+09:00`;
    const startDt = new Date(`${data.date}T${data.time}:00`);
    const endDt = new Date(startDt.getTime() + 60 * 60 * 1000); // +1 hour
    const eh = String(endDt.getHours()).padStart(2, "0");
    const em = String(endDt.getMinutes()).padStart(2, "0");
    const end = `${ymd(endDt)}T${eh}:${em}:00+09:00`;
    body.start = { dateTime: start, timeZone: "Asia/Seoul" };
    body.end = { dateTime: end, timeZone: "Asia/Seoul" };
  }
  return body;
}

export async function createGoogleEvent(
  calendarId: string,
  data: { title: string; date: string; time: string; memo: string }
): Promise<string> {
  const body = buildEventBody(data);
  const res = await callApi(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google 일정 생성 실패: ${err}`);
  }
  const created = (await res.json()) as { id: string };
  return created.id;
}

export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  updated?: string;
};

/** List events in the given calendar within [timeMin, timeMax). */
export async function listCalendarEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events`
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("orderBy", "startTime");

  const res = await callApi(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`Google 일정 조회 실패: ${res.status}`);
  }
  const data = (await res.json()) as { items?: GoogleEvent[] };
  return data.items ?? [];
}

/** Convert a Google Calendar event into our app's event shape. */
export function convertGoogleEvent(ge: GoogleEvent): {
  title: string;
  date: string;
  time: string;
  memo: string;
} {
  const title = ge.summary ?? "(제목 없음)";
  const memo = ge.description ?? "";

  if (ge.start.date) {
    return { title, date: ge.start.date, time: "", memo };
  }
  if (ge.start.dateTime) {
    const dt = new Date(ge.start.dateTime);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    const h = String(dt.getHours()).padStart(2, "0");
    const mi = String(dt.getMinutes()).padStart(2, "0");
    return { title, date: `${y}-${m}-${d}`, time: `${h}:${mi}`, memo };
  }
  // Fallback: today, all-day
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { title, date: `${y}-${m}-${d}`, time: "", memo };
}

export async function deleteGoogleEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await callApi(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );
  // 404/410 means the event was already gone — treat as success
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google 일정 삭제 실패: ${res.status}`);
  }
}
