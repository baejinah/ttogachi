import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Family, Role } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 6): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join("");
}

export async function createFamily(args: {
  uid: string;
  displayName: string;
  familyName: string;
  role: Role;
  color: string;
}): Promise<{ familyId: string; inviteCode: string }> {
  const familyRef = doc(db, "families", crypto.randomUUID());
  const familyId = familyRef.id;
  let inviteCode = generateInviteCode();

  // Retry up to 5 times if collision (extremely unlikely with 32^6 ≈ 1B codes)
  for (let i = 0; i < 5; i++) {
    const codeSnap = await getDoc(doc(db, "inviteCodes", inviteCode));
    if (!codeSnap.exists()) break;
    inviteCode = generateInviteCode();
  }

  const batch = writeBatch(db);

  batch.set(familyRef, {
    name: args.familyName,
    createdBy: args.uid,
    inviteCode,
    members: {
      [args.uid]: {
        role: args.role,
        displayName: args.displayName,
        color: args.color,
        joinedAt: serverTimestamp(),
      },
    },
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, "inviteCodes", inviteCode), {
    familyId,
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, "users", args.uid), {
    familyId,
    role: args.role,
  });

  await batch.commit();
  return { familyId, inviteCode };
}

export async function joinFamily(args: {
  uid: string;
  displayName: string;
  inviteCode: string;
  role: Role;
  color: string;
}): Promise<{ familyId: string }> {
  const code = args.inviteCode.trim().toUpperCase();
  const codeSnap = await getDoc(doc(db, "inviteCodes", code));
  if (!codeSnap.exists()) {
    throw new Error("초대 코드를 찾을 수 없어요. 다시 확인해주세요.");
  }

  const familyId = codeSnap.data().familyId as string;
  const familyRef = doc(db, "families", familyId);
  const familySnap = await getDoc(familyRef);
  if (!familySnap.exists()) {
    throw new Error("가족 정보를 불러올 수 없어요.");
  }

  const family = familySnap.data() as Family;
  if (family.members[args.uid]) {
    // Already a member — just sync user doc and return
    await updateDoc(doc(db, "users", args.uid), { familyId, role: args.role });
    return { familyId };
  }

  await updateDoc(familyRef, {
    [`members.${args.uid}`]: {
      role: args.role,
      displayName: args.displayName,
      color: args.color,
      joinedAt: serverTimestamp(),
    },
  });

  await updateDoc(doc(db, "users", args.uid), {
    familyId,
    role: args.role,
  });

  return { familyId };
}

export async function getFamily(familyId: string): Promise<Family | null> {
  const snap = await getDoc(doc(db, "families", familyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Family, "id">) };
}

