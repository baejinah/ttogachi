import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm or empty for all-day
  memo: string;
  authorUid: string;
  authorName: string;
  authorColor: string;
  googleEventId?: string | null;
  createdAt: Timestamp | null;
};

const eventsCol = (familyId: string) =>
  collection(db, "families", familyId, "events");

/** Create a new event. Returns the new doc id. */
export async function createEvent(
  familyId: string,
  data: Omit<CalendarEvent, "id" | "createdAt" | "googleEventId">
): Promise<string> {
  const ref = await addDoc(eventsCol(familyId), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setEventGoogleId(
  familyId: string,
  eventId: string,
  googleEventId: string
): Promise<void> {
  await updateDoc(doc(db, "families", familyId, "events", eventId), {
    googleEventId,
  });
}

/** Update event content from a Google sync — does not touch author fields. */
export async function updateEventFromGoogle(
  familyId: string,
  eventId: string,
  data: { title: string; date: string; time: string; memo: string }
): Promise<void> {
  await updateDoc(doc(db, "families", familyId, "events", eventId), data);
}

export async function deleteEvent(
  familyId: string,
  eventId: string
): Promise<void> {
  await deleteDoc(doc(db, "families", familyId, "events", eventId));
}

export function subscribeEvents(
  familyId: string,
  callback: (events: CalendarEvent[]) => void
): () => void {
  return onSnapshot(eventsCol(familyId), (snap) => {
    const events: CalendarEvent[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CalendarEvent, "id">),
    }));
    callback(events);
  });
}

/** Format Date as YYYY-MM-DD in local time. */
export function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns 42 Date cells for a 6-week month grid (starting Sunday). */
export function getMonthGrid(year: number, monthIndex: number): Date[] {
  const firstDay = new Date(year, monthIndex, 1);
  const startOffset = firstDay.getDay();
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, monthIndex, 1 - startOffset + i);
    return d;
  });
}
