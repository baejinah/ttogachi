import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type SafetyStatus = "normal" | "out_late";

export type SafetyDoc = {
  childUid: string;
  status: SafetyStatus;
  expectedArrival: Timestamp | null;
  arrivedAt: Timestamp | null;
  message: string;
  lastLocation: {
    lat: number;
    lng: number;
    timestamp: Timestamp;
  } | null;
  locationRequest: {
    requestedBy: string;
    requestedAt: Timestamp;
  } | null;
  updatedAt: Timestamp | null;
};

const safetyDoc = (familyId: string, childUid: string) =>
  doc(db, "families", familyId, "safety", childUid);

export async function setLate(
  familyId: string,
  childUid: string,
  expectedArrival: Date,
  message: string
): Promise<void> {
  await setDoc(
    safetyDoc(familyId, childUid),
    {
      childUid,
      status: "out_late" as SafetyStatus,
      expectedArrival,
      arrivedAt: null,
      message: message.trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setArrived(
  familyId: string,
  childUid: string
): Promise<void> {
  await setDoc(
    safetyDoc(familyId, childUid),
    {
      childUid,
      status: "normal" as SafetyStatus,
      expectedArrival: null,
      arrivedAt: serverTimestamp(),
      message: "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function requestLocation(
  familyId: string,
  childUid: string,
  requestedBy: string
): Promise<void> {
  await setDoc(
    safetyDoc(familyId, childUid),
    {
      childUid,
      locationRequest: {
        requestedBy,
        requestedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function shareLocation(
  familyId: string,
  childUid: string,
  lat: number,
  lng: number
): Promise<void> {
  await setDoc(
    safetyDoc(familyId, childUid),
    {
      childUid,
      lastLocation: {
        lat,
        lng,
        timestamp: serverTimestamp(),
      },
      locationRequest: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeSafety(
  familyId: string,
  childUid: string,
  callback: (doc: SafetyDoc | null) => void
): () => void {
  return onSnapshot(safetyDoc(familyId, childUid), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(snap.data() as SafetyDoc);
  });
}

/** Browser geolocation as a Promise. */
export function getMyLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("이 기기는 위치 정보를 지원하지 않아요."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(`위치 가져오기 실패: ${err.message}`)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}
