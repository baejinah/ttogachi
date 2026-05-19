import type { Timestamp } from "firebase/firestore";

export type Role = "parent" | "child";

export type UserDoc = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  familyId: string | null;
  role: Role | null;
  googleCalendarId?: string | null;
  googleSyncToken?: string | null;
  ledgerExpenseCategories?: string[];
  ledgerIncomeCategories?: string[];
  createdAt?: Timestamp;
};

export type FamilyMember = {
  role: Role;
  displayName: string;
  color: string;
  joinedAt: Timestamp;
};

export type Family = {
  id: string;
  name: string;
  createdBy: string;
  inviteCode: string;
  members: Record<string, FamilyMember>;
  createdAt?: Timestamp;
};

export type InviteCodeDoc = {
  familyId: string;
  createdAt: Timestamp;
};

export const MEMBER_COLORS = [
  { name: "파랑", value: "#3b82f6" },
  { name: "초록", value: "#10b981" },
  { name: "주황", value: "#f97316" },
  { name: "보라", value: "#a855f7" },
  { name: "분홍", value: "#ec4899" },
  { name: "노랑", value: "#eab308" },
  { name: "청록", value: "#06b6d4" },
  { name: "빨강", value: "#ef4444" },
] as const;
